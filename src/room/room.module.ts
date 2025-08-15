import { BlockchainModule } from "src/blockchain/blockchain.module";
import { PoketmonModule } from "src/pokemon/pokemon.module";
import { RedisModule } from "src/redis/redis.module";
import { UserModule } from "src/user/user.module";
import { RoomGateway } from "./room.gateway";
import { RoomService } from "./room.service";
import { RoomController } from "./room.controller";
import { Module } from "@nestjs/common";

@Module({
    imports: [RedisModule, UserModule, PoketmonModule, BlockchainModule],
    providers: [RoomGateway, RoomService],
    controllers: [RoomController],
})
export class RoomModule { }