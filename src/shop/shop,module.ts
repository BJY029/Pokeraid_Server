import { Controller, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Poketmon } from "src/pokemon/pokemon.entity";
import { PoketmonModule } from "src/pokemon/pokemon.module";
import { UserModule } from "src/user/user.module";
import { ShopController } from "./shop.controller";
import { Shop } from "./shop.entity";
import { ShopService } from "./shop.service";
import { BlockchainModule } from "src/blockchain/blockchain.module";

@Module({
    imports: [TypeOrmModule.forFeature([Shop, Poketmon]), PoketmonModule, UserModule, BlockchainModule],
    controllers: [ShopController],
    providers: [ShopService],
})
export class ShopModule { }