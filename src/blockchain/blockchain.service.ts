import { Injectable } from "@nestjs/common";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, OWNER_PRIVATE_KEY, RPC_URL } from "./blockchain.constrans";
import { ERC20ABI } from "./abi/erc.20";
import { User } from "src/user/user.entity";
import { decrypt } from "src/utlis/util.crypto";

@Injectable()
export class BlockchainService {
    //Kaia 체인의 JSON-RPC 노드에 연결할 변수
    private provider: ethers.providers.JsonRpcProvider;
    //OWNER_PRIVATE_KEY를 가진 지갑 변수
    private ownerWallet: ethers.Wallet;
    //각 변수 연결
    constructor() {
        this.provider = new ethers.providers.JsonRpcProvider(RPC_URL);
        this.ownerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY, this.provider);
    }

    //signerOrProvider로 signer(지갑) 혹은 provider로 연결된 ERC-20 컨트랙트 인스턴스를 받아온다.
    //signer인 경우 서명이 가능하며, provider인 경우 조회만 가능하다.
    private getContract(signerOrProvider: ethers.Signer | ethers.providers.Provider): ethers.Contract {
        return new ethers.Contract(CONTRACT_ADDRESS, ERC20ABI, signerOrProvider);
    }

    //사용자의 토큰 잔액을 조회한다.
    async getBalance(user: User) {
        //해당 user 테이블에서 의 지갑 주소를 가져온다.
        if (!user.address)
            throw new Error('no address');

        //provider로 ERC-20 컨트랙트 인스턴스를 받아온다.
        const contract = this.getContract(this.provider);
        //해당 provider로 balanceOf 함수 호출
        const balance = await contract.balanceOf(user.address);
        return {
            //블록체인에서는 소수점 없이 18자리 숫자로 표현한다.
            //즉, 1000000000000000000 == 1.00000000000000000와 같다.
            //따라서 다음과 같이 소수점으로 변환하는 작업을 통해 읽을 수 있도록 해서 반환
            balance: ethers.utils.formatUnits(balance, 18)
        }
    }

    //사용자의 토큰을 차감하여 Owner로 전송하는 서비스
    async deductToTokens(user: User, amount: string) {
        //user 테이블에서 privatekey를 가져와서 복호화한다.
        const decrypted = decrypt(user.private_key);
        //복호화된 privatekey와 읽기 전용 provider로 지갑 정보를 가져와서
        const userWallet = new ethers.Wallet(decrypted, this.provider);
        //해당 signer(지갑) 정보를 토대로  ERC-20 컨트렉트 인스턴스를 받아온다.
        const contract = this.getContract(userWallet);

        //입력한 amount를 18자리 단위로 변환한다.(소수점을 없애는 작업)
        const value = ethers.utils.parseUnits(amount, 18);
        //transfer 함수를 통해 거래를 진행한다.
        const tx = await contract.transfer(this.ownerWallet.address, value);
        //해당 거래가 완료될 때까지 대기한다.
        await tx.wait();
        //반환 값으로 거래 해시값을 반환한다.
        return {
            txHash: tx.txHash
        }
    }

    //Owner가 특정 사용자에게 토큰을 지급하는 서비스
    async grantToken(user: User, amount: string) {
        //ownerWallet(singer)로 ERC-20 컨트랙트 인스턴스를 받아온다.
        const contract = this.getContract(this.ownerWallet);
        //amount를 18자리 숫자로 변환 후
        const value = ethers.utils.parseUnits(amount, 18);
        //거래 함수를 호출한다.
        const tx = await contract.transfer(user.address, value);
        //거래가 완료될 때까지 대기 후
        await tx.wait();
        //거래 해시 값을 반환한다.
        return {
            txHash: tx.Hash
        }
    }
}