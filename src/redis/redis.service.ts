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

    //방 생성시 호출할 함수
    //해당 방의 아이디, 방장 아이디, 보스 포켓몬 아이디를 저장한다.
    async createRoom(roomId: string, leaderId: number, bossPokemonId: number) {
        await this.client.set(`room:${roomId}:leader`, leaderId);
        await this.client.set(`room:${roomId}:boss`, bossPokemonId);
        await this.client.set(`room:${roomId}:memberOrder`, '0');
    }

    //방 멤버 목록을 저장한 Redis의 리스트 요소 수를 반환한다.
    async getMemberCount(roomId: string) {
        //llen은 Redis 명령어 중 하나로, 리스트 자료구조에 저장된 요소의 개수를 반환한다.
        return await this.client.llen(`room:${roomId}:members`);
    }

    //특정 멤버가 방에 있는지 확인 후 bool 형을 반환한다.
    async isMember(roomId: string, userSeq: string): Promise<boolean> {
        //lrange는 Redis의 리스트 명령어로, 리스트에서 특정 구간의 요소들을 가져오는 기능이다.
        //방 멤버 목록 리스트를 처음(0)부터 끝(-1)까지 가져온다.(반환형은 문자열 배열이다.)
        const rawMembers = await this.client.lrange(`room:${roomId}:members`, 0, -1);
        //해당 문자열 배열의 각 요소에 대해 콜백 함수를 실행한다.
        //.some() 메서드는 배열의 각 요소에 대해 콜백 함수를 실행하고, 한번이라도 true를 반환하면
        //그 즉시 중단 후 true 반환한다.
        return rawMembers.some((raw) => {
            try {
                //raw(JSON)를 객체로 변환 후, 변환된 객체의 userSeq가 인자의 userSeq와 같은지 비교
                const parsed = JSON.parse(raw);
                return parsed.userSeq === parseInt(userSeq);
            } catch {
                return false;
            }
        });
    }

    //방 참가 함수
    async joinRoom(roomId: string, userSeq: number, pokemonId: number) {
        //참가하는 방 룸 아이디
        const key = `room:${roomId}:members`;
        //참가하는 순서
        //incr는 Redis의 명령어로, 문자열 자료형에 저장된 숫자 1을 증가시키는 명령어이다.
        const order = await this.client.incr(`room:${roomId}:memberOrder`);
        //플레이어 정보 객체를 JSON 문자열로 변환한다.(직렬화)
        const memberData = JSON.stringify({ userSeq: userSeq, pokemonId, order });
        //rpush는 Redis의 명령어로, 리스트의 끝 요소에 추가하는 명령어이다.
        await this.client.rpush(key, memberData);
        //set는 Redis의 명령어로, 문자열 값을 저장한다.
        //특정 유저가 어느 방에 속해있는지 빠르게 역조회 하기 위해 다음과 같이 해당 key에 roomId를 문자열로 저장한다.
        await this.client.set(`user:${userSeq}:room`, roomId);
    }

    //방 탈퇴 함수
    async leaveRoom(roomId: string, userSeq: number) {
        //해당 유저의 키 값을 설정하고
        const key = `room:${roomId}:members`;
        //해당 키 값에 달린 리스트의 요소들을 처음부터 끝까지 불러온다.
        const members = await this.client.lrange(key, 0, -1);

        //해당 리스트 요소 문자열을 돌아보면서
        for (const member of members) {
            try {
                const parsed = JSON.parse(member);

                console.log(userSeq);
                console.log(parsed);

                //같은 유저가 존재하면
                if (parsed.userSeq === userSeq) {
                    //lrem은 redis의 명령어로, 리스트에서 특정 값과 일치하는 요소를 삭제하는 명령어다.
                    //key, count, value로, key는 삭제할 대상 리스트 키 이름, count는 삭제 개수(0은 모든 일치 항목 삭제),
                    //value는 삭제할 값
                    await this.client.lrem(key, 0, member);
                    break;
                }
            } catch {
                continue;
            }
        }
        //해당 문자열 키 삭제(방 매핑 정보 삭제)
        await this.client.del(`user:${userSeq}:room`);
    }

    //방 삭제 함수
    async removeRoom(roomId: string) {
        //관련 문자열 키 삭제
        await this.client.del(`room:${roomId}:members`);
        await this.client.del(`room:${roomId}:leader`);
        await this.client.del(`room:${roomId}:boss`);
        await this.client.del(`room:${roomId}:memberOrder`);
    }

    //특정 user가 속한 방 아이디 조회
    async getUserRoom(userId: number) {
        return await this.client.get(`user:${userId}:room`);
    }

    //모든 방의 멤버 리스트 키를 가져오는 함수
    async getRooms() {
        return await this.client.keys('room:*:members');
    }

    //멤버 리스트의 각 요소들을 JSON 형태로 반환
    async getRoomMembers(roomId: string): Promise<string[]> {
        return await this.client.lrange(`room:${roomId}:members`, 0, -1);
    }

    //방장 아이디를 반환하는 함수
    async getRoomLeader(roomId: string): Promise<number> {
        //해당 방의 leader 정보를 가져오고
        const leader = await this.client.get(`room:${roomId}:leader`);
        //관련 정보 없으면 예외 던짐
        if (!leader) {
            throw new Error();
        }
        //int 형으로 변환하여 반환
        return parseInt(leader);
    }

    //해당 방의 보스 포켓몬 아이디를 반환하는 함수
    async getRoomBoss(roomId: string): Promise<number> {
        //해당 방의 boss id를 문자열로 가져오고
        const boss = await this.client.get(`room:${roomId}:boss`);
        //관련 정보 없을 시 예외 던짐
        if (!boss) {
            throw new Error();
        }
        //숫자로 변환하여 반환
        return parseInt(boss);
    }

    //현재 전투 상태를 관련 리스트에 직렬화하여 저장
    async setBattleState(roomId: string, battleState: Object) {
        await this.client.set(`room:${roomId}:battleState`, JSON.stringify(battleState));
    }

    //특정 방의 전투 상태를 역직렬화 해서 반환하는 함수
    async getBattleState(roomId: string) {
        const battleState = await this.client.get(`room:${roomId}:battleState`);
        if (!battleState) {
            throw new Error();
        }
        return JSON.parse(battleState);
    }

    //전투상태를 제거하는 함수
    async removeBattleState(roomId: string) {
        await this.client.del(`raid:${roomId}:battleState`);
    }

    //특정 user의 방 매핑 정보를 삭제하는 함수
    async removeUserRoomMapping(userId: number) {
        await this.client.del(`user:${userId}:room`);
    }
}