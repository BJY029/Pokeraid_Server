//nestjs의 기본 기능을 입포트
import { Inject, Injectable } from '@nestjs/common'
//redis와 통신하기 위한 라이브러리 임포트
import Redis from 'ioredis'

//해당 데코레이터를 통해 해당 클래스를 서비스로 등록한다.
@Injectable()
export class RedisService {
    //해당 클래스를 만들 때 자동으로 실행되는 생성자 함수로, 외부에서 필요한 것을 주입 받을 수 있다.
    //REDIS_CLIENT라는 이름으로 등록된 Redis 객체를 해당 클래스에 전달하고, 
    // 받아온 Redis 인스턴스를 this.client로 사용할 수 있게 저장한다.
    /*NestJS에게
    "REDIS_CLIENT"라는 이름으로 등록된 객체를 주세요.
    그러면 이 클래스 안에서 this.client로 쓸게요.*/
    constructor(@Inject('REDIS_CLIENT') private readonly client: Redis) { }

    //async는 비동기 함수, 비동기 함수에선 await 을 사용할 수 있다.
    //await는 Redis에서 데이터를 받아올 때까지 기다린다.

    //Redis에 데이터를 저장하는 비동기 함수
    //세션(session) ID를 키로해서, Redis에 문자열로 데이터를 저장한다.(Redis는 문자열 기반 저장소)
    async setSession(sessionId: string, data: any, ttlSeconds = 3600) {
        await this.client.set(
            `session:${sessionId}`, //session ID를 키로
            JSON.stringify(data),   //데이터를 문자열로 저장
            'EX',                   //Expire의 줄임말로, x초 후에 만료되도록 하라는 명령어 옵션
            ttlSeconds,             //해당 ttlSeconds 후에 만료된다.
        );
    }

    //Redis에서 세션 데이터를 가져오는 비동기 함수
    async getSession(sessionId: string) { //sessionId를 키로 해서 접근한다.
        //Redis에서 세션 데이터를 키로 해서 접근해서 raw에 저장
        const raw = await this.client.get(`session:${sessionId}`);
        //저장된 값이 있으면, 문자열로 저장된 JSON 데이터를 다시 객체로 변환해서 반환
        //값이 없으면 null을 반환
        return raw ? JSON.parse(raw) : null;
    }

    //Redis에서 해당 sessionId를 키로 가진 세션 데이터를 삭제하는 비동기 함수
    async deleteSession(sessionId: string) {
        await this.client.del(`session:${sessionId}`);
    }

    //Redis에서 특정 user가 어떤 세션을 쓰고 있는지 확인하는 비동기 함수
    //promise는 해당 T형 자료형을 비동기 작업이 끝나고 반환하겠다는 약속으로
    //반환되는 결과는 string 혹은 null이다.
    async getSessionIdByUserId(userId: number): Promise<string | null> {
        //Redis에서 userId를 키로해서 접근하고, 값이 존재하면 데이터 반환, 없으면 null 반환
        return await this.client.get(`user:${userId}`);
    }

    //userId를 키로 해서 어떤 세션 ID를 사용하는지 Redis에 저장하는 비동기 함수
    //로그인 시 유저와 세션을 연결할 때 사용한다. EX 설정을 통해 자동 만료되도록 설정
    async setUserSessionMap(userId: number, sessionId: string, ttl = 3600) {
        await this.client.set(`user:${userId}`, sessionId, 'EX', ttl);
    }
}