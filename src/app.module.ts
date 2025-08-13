import { TypeOrmModule } from "@nestjs/typeorm";
import { RedisModule } from "./redis/redis.module";
import { UserModule } from "./user/user.module";
import { User } from "./user/user.entity";
import { Module } from "@nestjs/common";
import { ShopModule } from "./shop/shop,module";
import { BlockchainModule } from "./blockchain/blockchain.module";

@Module({
  imports: [
    //MySQL 연결 설정
    TypeOrmModule.forRoot({
      type: 'mysql',        //사용자 DB 유형 
      host: 'localhost',   //DB 호스트 주소
      port: 3307,           //MySQL 포트
      username: 'user',     //DB 로그인 정보
      password: 'secret123',
      database: 'pokeraid', //사용할 DB이름
      //src 또는 dist 폴더 내의 모든 *.entity.ts 또는 *.entity.js 파일을 자동으로 찾아서 엔티티로 등록
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
    }),
    //Redis 클라이언트 설정 및 모듈
    RedisModule.forRootAsync(),
    //사용자 기능 모듈(회원가입, 비밀번호 검증 등등 구현했던 기능들)
    UserModule,
    ShopModule,
    BlockchainModule,
  ]
})
export class AppModule { }