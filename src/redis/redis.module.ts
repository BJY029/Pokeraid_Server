//기본 nestjs 모듈 임포트
import { DynamicModule, Global, Module } from '@nestjs/common';
//우리가 만든 Redis 관련 서비스
import { RedisService } from 'src/redis/redis.service';
//실제 Redis와 통신하는 라이브러리
import Redis from 'ioredis';

//해당 모듈이 전역으로 사용되게 만든다는 데코레이터
//자동으로 다른 모듈에서 import 하지 않아도 자동으로 주입된다.
@Global()
//해당 클래스가 NetsJS 모듈이라는 표시, 안에 imports, providers, controller 등을 넣을 수 있다.
@Module({})
export class RedisModule {
    //동적으로 모듈을 생성하는 함수, 해당 함수가 반환하는 객체가 실제로 NestJS에 모듈로 등록된다.
    static forRootAsync(): DynamicModule {
        return {
            module: RedisModule,
            //providers 배열
            providers: [
                {
                    //NestJS가 이존성 주입할 때 사용할 이름
                    provide: 'REDIS_CLIENT', //나중에 @Inject('REDIS_CLIENT') 사용 가능
                    //실제 객체를 생성하는 함수(Redis 연결 객체)
                    useFactory: async () => {
                        //실제 ioredis 클라이언트를 생성
                        return new Redis({
                            host: 'localhost',
                            port: 6379,
                        });
                    },

                },
                //앞서 만든 RedisService 클래스도 해당 모듈에서 같이 제공
                RedisService,
            ],
            //exports 배열 : 해당 모율이 외부에 내보내는 것들
            //다른 모듈에서도 해당 REDIS_CLIENT와 RedisService를 사용할 수 있게 한다.
            exports: ['REDIS_CLIENT', RedisService],
        };
    }
}