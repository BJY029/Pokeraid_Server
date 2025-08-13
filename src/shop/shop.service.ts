import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Shop } from "./shop.entity";
import { PoketmonService } from "src/pokemon/pokemon.service";
import { User } from "src/user/user.entity";
import { BlockchainController } from "src/blockchain/blockchain.controller";
import { BlockchainService } from "src/blockchain/blockchain.service";

@Injectable()
export class ShopService {
    constructor(
        @InjectRepository(Shop) private readonly shopRepo: Repository<Shop>,
        private readonly poketmonService: PoketmonService,
        private readonly blockchainService: BlockchainService,
    ) { }

    //판매 가능한 포켓몬 아이템들을 가져오는 서비스
    async getAvailablePokemonItems() {
        //shop 테이블에서 type이 POKEMON인 아이템들을 shopItem에 저장한다.
        const shopItem = await this.shopRepo.find({ where: { type: 'POKETMON' } });

        //비동기 병렬 처리 실행
        //각 item의 target_id에 해당하는 포켓몬 정보 및 스킬을 가져온다.
        const result = await Promise.all(
            shopItem.map(async (item) => {
                const pokemon = await this.poketmonService.getPokemonWithSkills(item.target_id);

                //해당 포켓몬의 상품 정보 및 스킬 정보를 객체로 반환
                return {
                    shop_id: item.id,
                    price: item.price,
                    stock: item.stock,
                    pokemon,
                };
            })
        );
        return result;
    }

    //구매 요청시 사용되는 서비스
    async purchaseItem(user: User, itemId: number) {
        //요청한 item_id 및 type이 'POKEMON'인 아이템 하나를 찾아서 item에 저장
        const item = await this.shopRepo.findOne({ where: { id: itemId, type: 'POKETMON' } });
        //만약 item이 없거나 재고가 없으면 예외 던짐
        if (!item) throw new BadRequestException('Item not found');
        if (item.stock <= 0) throw new BadRequestException('Item is out of stock');

        //해당 user의 토큰을 아이템 price 만큼 감소시키고, 해시값을 받아온다.
        const txHash = await this.blockchainService.deductToTokens(user, String(item.price));
        //요청한 유저에게 해당 아이템 포켓몬을 지급하는 서비스 호출
        await this.poketmonService.givePokemon(user.seq, item.target_id);
        //아이템 리포에서 해당되는 아이템의 stock 값을 1 감소시킨다.
        await this.shopRepo.decrement({ id: item.id }, 'stock', 1);

        //지급된 아이템 정보 반환
        return {
            itemId: item.id,
            txHash,
        };
    }
}