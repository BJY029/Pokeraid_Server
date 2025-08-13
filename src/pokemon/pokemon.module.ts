import { TypeOrmModule } from "@nestjs/typeorm";
import { PoketmonService } from "./pokemon.service";
import { Poketmon, UserPoketmon } from "./pokemon.entity";
import { PoketmonSkill } from "./pokemon.skill.entity";
import { Module } from "@nestjs/common";


@Module({
    providers: [PoketmonService],
    exports: [PoketmonService],
    imports: [TypeOrmModule.forFeature([Poketmon, PoketmonSkill, UserPoketmon])],
})
export class PoketmonModule { }