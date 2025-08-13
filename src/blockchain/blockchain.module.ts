import { UserModule } from "src/user/user.module";
import { BlockchainController } from "./blockchain.controller";
import { BlockchainService } from "./blockchain.service";
import { Module } from "@nestjs/common";

@Module({
    imports: [UserModule],
    providers: [BlockchainService],
    controllers: [BlockchainController],
    exports: [BlockchainService],
})
export class BlockchainModule { }