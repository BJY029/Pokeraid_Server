//의존성 주입이 가능한 서비스로 등록하기 위해 Injectable 데코러이터 사용
import { Injectable } from '@nestjs/common';
//typeorm의 레포를 NestJS에서 주입받기 위한 데코레이터
import { InjectRepository } from '@nestjs/typeorm';
//비밀번호 해시 및 비교에 사용되는 라이브러리
import * as bcrypt from 'bcrypt';
import { RedisService } from 'src/redis/redis.service';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { PoketmonService } from 'src/pokemon/pokemon.service';
import { ethers } from 'ethers';
import { encrypt } from 'src/utlis/util.crypto';


@Injectable()
export class UserService {
  //생성자 의존성 주입
  //@InjectRepository(User)는 TypeORM의 User 테이블에 연결된 Repository<User> 객체를 주입한다.
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>, private redisService: RedisService,
    private readonly pokemonService: PoketmonService,
  ) { }

  //회원가입 함수
  async register(id: string, password: string) {
    //입력받은 비밀번호를 10 round로 해싱
    const hashed = await bcrypt.hash(password, 10);
    //User 객체 생성(id와 해싱된 비밀번호)
    const user = this.userRepo.create({ id: id, password: hashed });
    //생성한 user 객체를 save에 저장
    const save = await this.userRepo.save(user);
    //save에 저장한 방금 생성한 usre 객체의 id(seq) 값을 스타터 포켓몬 지급에 사용
    await this.pokemonService.giveStarterPokemon(save.seq);
    //DB에 User 객체 저장 후 저장여부 반환
    return this.userRepo.save(user);
  }

  //로그인 검증 함수(User 객체 혹은 null론 반환할것을 약속)
  async vaildateUser(id: string, password: string): Promise<User | null> {
    //주어진 ID로 DB에서 사용자를 조회
    const user = await this.userRepo.findOne({ where: { id } });
    //사용자가 없다면 null 반환
    if (!user) return null;
    //compare 함수로 입력 비밀번호와 DB 해시 비교
    const isVaild = await bcrypt.compare(password, user.password);
    //일치하면 사용자 객체 반환, 틀리면 null 반환
    return isVaild ? user : null;
  }

  //성공시 사용자 정보를, 실패시 예외를 반환하는 함수
  async findByIdOrFail(userSeq: number) {
    //this.userRepo : User 엔티티와 연결된 TypeORM의 Repository 객체
    //findOneOrFail : 조건에 맞는 엔티티를 찾으면 반환, 못 찾으면 예외 throw
    //{where : {seq:userSeq}} : User 테이블에서 seq Column이 userSeq와 일치하는 사용자만 조회한다.
    return this.userRepo.findOneOrFail({ where: { seq: userSeq } });
  }

  //사용자의 개인 키를 기반으로 이더리움 지갑을 생성하고, 주소와 암호화 키를 DB에 저장하는 서비스
  async walletLink(seq: number, privateKey: string) {
    //privateKey로부터 지갑을 생성한다.
    const wallet = new ethers.Wallet(privateKey);
    //utlis에서 구현한 함호화 함수를 이용하여 개인 키를 암호화한다.
    const encryptedPrivateKey = encrypt(privateKey);
    //user 테이블에 지갑 주소와 암호화 된 개인 키를 업데이트하나.
    const updateResult = await this.userRepo.update(seq, {
      address: wallet.address,
      private_key: encryptedPrivateKey,
    });

    return updateResult;
  }
}
