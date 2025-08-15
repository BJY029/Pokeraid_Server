import { Injectable } from "@nestjs/common";
import { RedisService } from "src/redis/redis.service";
import { UserService } from "src/user/user.service";

@Injectable()
export class RoomService {
    constructor(
        private readonly redisService: RedisService,
        private readonly userService: UserService,
    ) { }

    //특정 방에 정보를 반환한다.
    async getRoom(roomId: string, eventType: string) {
        //Redis 리스트(room:{roomid}:members)의 문자열 요소들을 가져온다.
        const raw = await this.redisService.getRoomMembers(roomId);
        //가저온 문자열 요소 배열 전체를 객체화
        //map은 JS의 배열 메서드로, 배열의 각 요소를 순회하며 콜백 함수의 반환값으로 변환한 새 배열 생상
        const members = raw.map((data) => JSON.parse(data));
        //각 맴버 객체를 돌면서, 해당 user가 정말 존재하는지 확인
        await Promise.all(members.map((m) => this.userService.findByIdOrFail(m.id)));

        //반환 객체
        return {
            //해당 방 ID
            roomId,
            //해당 방의 방장
            leaderId: await this.redisService.getRoomLeader(roomId),
            //해당 방의 보스
            bossPokemonId: await this.redisService.getRoomBoss(roomId),
            //해당 방의 멤버들
            members: members,
            //현재 해당 방의 이벤트 타입
            eventType: eventType,
        };
    }

    //모든 방의 정보를 반환한다.
    async getRooms() {
        //KEYS room:*:members로 모든 방 멤버 리스트 키를 가져온다.
        const rooms = await this.redisService.getRooms();
        //각 roomID를 추출한다.("room:A1:members" => ["room", "A1", "members"] => "A1")
        const roomIds = rooms.map((key) => key.split(':')[1]);
        //roomID들을 돌면서, 해당되는 Room의 상세 정보들을 반환한다.(이벤트 타입 : Http)
        return Promise.all(roomIds.map((roomId) => this.getRoom(roomId, "http")));
    }
}