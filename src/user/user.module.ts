import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "./user.entity";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { PoketmonModule } from "src/pokemon/pokemon.module";
import { RedisModule } from "src/redis/redis.module";

//NestJS의 UserModule 정의
//해당 모듈은 사용자 관련 기능(회원가입, 로그인 등)을 관리하며, 
//주로 컨트롤러, 서비스, 엔티티를 등록하고 TypeORM 연동을 설정하는 역할 수행

//Module 데코레이터를 통해 NestJS 모듈 정의, 해당 데코레이터 안에는 4개의 주요 항목 존재
//imports : 외부 모듈 또는 하위 모듈을 불러올 때 사용
//controllers : 라우팅 요청을 처리하는 컨트롤러 등록
//providers : 주입 가능한 서비스 등록
//exports : 다른 모듈에서 사용할 수 있도록 provider 공개
@Module({
    //해당 모듈에서 사용될 User 엔티티 등록. 즉 User 엔티티를 TypeORM으로 사용하겠다라고 NestJS에게 알려줌
    imports: [TypeOrmModule.forFeature([User]), PoketmonModule, RedisModule],
    //HTTP 요청을 받을 컨트롤러 등록
    controllers: [UserController],
    //해당 모듈에서 사용할 서비스를 등록
    providers: [UserService],
    exports: [UserService],
})
//위에서 정의한 내용을 바탕으로 UserModule 정의
//AppModule 등 상위 모듈에서 해당 모듈을 imports에 등록하여 사용한다.
export class UserModule { }