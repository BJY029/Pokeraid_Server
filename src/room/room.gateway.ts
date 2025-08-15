import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { BlockchainService } from "src/blockchain/blockchain.service";
import { PoketmonService } from "src/pokemon/pokemon.service";
import { RedisService } from "src/redis/redis.service";
import { UserService } from "src/user/user.service";
import { RoomService } from "./room.service";
import { Server, Socket } from "socket.io";
import { WsSessionGuard } from "src/guard/ws.session.guard";
import { ConflictException, ForbiddenException, UseGuards } from "@nestjs/common";
import { CreateRoomDto, JoinRoomDto, LeaveRoomDto, TestRoomDto } from "./room.dto";
import { v4 as uuidv4 } from 'uuid';

//'/rooms' 네임스페이스에서만 연결/이벤트 처리
@WebSocketGateway({ namespace: '/rooms', cors: true })
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
    //Socket.IO 서버 인스턴스
    @WebSocketServer()
    server: Server;
    //각 방의 최대 멤버수
    private readonly maxMemberCount = 4;

    constructor(
        private readonly roomService: RoomService,
        private readonly userService: UserService,
        private readonly redisService: RedisService,
        private readonly poketmonService: PoketmonService,
        private readonly blockchainService: BlockchainService,
    ) { }

    //연결을 관리하는 핸들러
    handleConnection(client: Socket) {
        //클라이언트가 연결되며, Socket.IO가 handshake 객체를 채워서 전달
        //해당 header에는 sessionID가 들어있음
        const sessionId = client.handshake.headers['sessionid'];
        //sessionID가 비어있거나 문자열이 아니면
        if (!sessionId || typeof sessionId !== 'string') {
            //검증 실패로 간주, 연결을 끊는다.
            console.log(`Client disconnected1: ${client.id}`);
            client.disconnect();
            return;
        }

        //Redis에 저장된 세션 조회
        this.redisService.getSession(sessionId).then((session) => {
            //만약 해당 세션이 유효한 세션이 아니라면
            //즉, 세션 목록에 객체에 들어있던 세션 정보가 없는 경우
            if (!session) {
                //검증 실패로 간주, 연결을 끊는다.
                console.log(`Client disconnected2: ${client.id}`);
                client.disconnect();
            } else {
                //연결 성공
                console.log(`Client connected: ${client.id}`);
            }
        });
    }

    //연결 해제를 관리하는 핸들러
    async handleDisconnect(client: Socket) {
        //Socket.IO 서버에서 user 정보를 받아온다.(해당 정보는 Guard에서 설정하는걸로 알고 있는데, Guard를 호출하지 않았는데 우째 있음?)
        const user = client['user'];
        //user가 존재하면
        if (user) {
            //Redis에서 해당 user가 속한 방 ID를 알아낸다. 값이 없으면 ''로 대체.
            const userRoom = await this.redisService.getUserRoom(user.seq) || '';
            //Redis에서 해당 user의 방 연결을 해제한다.
            await this.redisService.leaveRoom(userRoom, user.seq);
            //해당 방의 맴버 수를 가져온다.
            const memberCount = await this.redisService.getMemberCount(userRoom);
            //만약 멤버 수가 0명 이하라면
            if (memberCount <= 0) {
                //해당 방을 파괴한다.
                await this.redisService.removeRoom(userRoom);
            }
            //Socket.IO의 방(namespace 레벨 room)에서 socket을 탈퇴
            client.leave(userRoom);
        }
        console.log(`client disconnected : ${client.id}`);
    }

    //가드를 사용하여 session 검증 후, client['user'] 주입
    @UseGuards(WsSessionGuard)
    //클라가 socket.emit('createRoom', payload) 보냈을 때 이 메서드가 실행.
    @SubscribeMessage('createRoom')
    //소켓 객체와 메시지 본문에 DTO 주입
    async handleCreateRoom(@ConnectedSocket() client: Socket, @MessageBody() body: CreateRoomDto) {
        console.log(body.boosId);
        //user 정보를 받아온다.
        const user = client['user'];
        console.log(user);

        //해당 user가 속한 방 정보를 받아온다.(없어야지 정상)
        const userRoom = await this.redisService.getUserRoom(user.seq);
        console.log(userRoom);
        //만약 방 정보가 존재하면, 이미 속한 방이 있으므로 오류 던짐
        if (userRoom) {
            throw new Error('already member');
        }

        //DTO에서 넘어온 보스 포켓몬의 정보를 받아온다.
        const boss = await this.poketmonService.getPokemonWithSkills(body.boosId);
        console.log(boss);
        //해당 보스 정보가 존재하지 않으면 에러 던짐
        if (!boss) {
            throw new Error();
        }
        //user가 가지고 있는 포켓몬들을 가져온다.
        const myPoketmons = await this.poketmonService.getUserPokemons(user.seq);
        console.log(myPoketmons);
        //해당 user가 실제 보유한 포켓몬 중에, 내가 특정 룸에 들고갈 포켓몬이 없으면 에러 던짐
        if (!myPoketmons.some(p => p.pokemonId == body.myPoketmonId)) {
            throw new Error();
        }
        //새로운 방 ID를 생성한다.
        const roomId = uuidv4();
        //DTO와 user 정보를 토대로 방을 생성
        await this.redisService.createRoom(roomId, user.seq, boss.id);
        //해당 방에 조인한다.
        await this.redisService.joinRoom(roomId, user.seq, body.myPoketmonId);
        //해당 방의 정보를 받아온다.
        const updateRoom = await this.roomService.getRoom(roomId, 'createRoom');
        console.log(updateRoom);
        //Socket.IO의 Room에 참가
        client.join(roomId);

        console.log(updateRoom);
        //해당 roomId 방에 존재하는 모든 소켓에게 해당 정보를 브로드캐스트한다.
        this.server.to(roomId).emit('roomUpdate', updateRoom);
    }

    ////가드를 사용하여 session 검증 후, client['user'] 주입
    @UseGuards(WsSessionGuard)
    //클라가 socket.emit('joinRoom', payload) 보냈을 때 이 메서드가 실행.
    @SubscribeMessage('joinRoom')
    //소켓 객체와 메시지 본문에 DTO 주입
    async handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() body: JoinRoomDto) {
        //user 정보를 받아온다.
        const user = client['user'];
        //DTO로 넘어온 방 ID를 통해 방을 조회한다.
        const room = await this.roomService.getRoom(body.roomId, "joinRoom");
        //조회된 방이 없으면 에러 던짐
        if (!room) {
            throw new ForbiddenException('room not found');
        }

        //DTO로 넘어온 방 ID를 통해 해당 방의 현재 멤버수를 가져온다.
        const memberCount = await this.redisService.getMemberCount(body.roomId);
        //조회된 방의 멤버수가 최대 멤버수인 경우 에러 던짐
        if (memberCount >= this.maxMemberCount) {
            throw new ForbiddenException('max member count');
        }

        //해당 user가 속한 방 정보를 받아온다.(없어야지 정상)
        const userRoom = await this.redisService.getUserRoom(user.id);
        //속한 방이 존재하면 에러 던짐
        if (userRoom) {
            throw new ConflictException('already member');
        }

        //검증이 완료되었기 때문에, 해당 방에 참여를 한다.
        await this.redisService.joinRoom(body.roomId, user.seq, body.myPoketmonId);
        //Socket.IO Room에 조인
        client.join(body.roomId);
        //해당 방 정보를 가져온다.
        const roomUpdate = await this.roomService.getRoom(body.roomId, 'joinRoom');
        //해당 roomId 방에 존재하는 모든 소켓에게 해당 정보를 브로드캐스트한다.
        this.server.to(body.roomId).emit('roomUpdate', roomUpdate);
    }

    //테스트용
    ////가드를 사용하여 session 검증 후, client['user'] 주입
    @UseGuards(WsSessionGuard)
    //클라가 socket.emit('testRoom', payload) 보냈을 때 이 메서드가 실행.
    @SubscribeMessage('testRoom')
    async handleTestRoom(
        //소켓 객체와 메시지 본문에 DTO 주입
        @ConnectedSocket() client: Socket,
        @MessageBody() body: TestRoomDto,
    ) {
        //해당 roomId 방에 존재하는 모든 소켓에게 DTO의 메시지를 브로드캐스트한다.
        this.server.to(body.roomId).emit('roomUpdate', body.message);
    }

    //가드를 사용하여 session 검증 후, client['user'] 주입
    @UseGuards(WsSessionGuard)
    //클라가 socket.emit('leaveRoom', payload) 보냈을 때 이 메서드가 실행.
    @SubscribeMessage('leaveRoom')
    //소켓 객체와 메시지 본문에 DTO 주입
    async handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() body: LeaveRoomDto) {
        //user 정보 받아옴
        const user = client['user'];

        console.log(body.roomId);
        console.log(user.seq);

        //해당 유저가 DTO에서 넘어온 방의 실제 유저인지 확인한다.
        const isMember = await this.redisService.isMember(body.roomId, String(user.seq));
        console.log(isMember);
        //아니면 에러 던짐
        if (!isMember) {
            throw new Error('not member');
        }
        //해당 방에서 나간다.
        await this.redisService.leaveRoom(body.roomId, user.seq);
        //나간 방의 정보를 가져온다.
        const room = await this.roomService.getRoom(body.roomId, 'leaveRoom');
        //나간 방의 현재 멤버수를 확인한다.
        const memberCount = await this.redisService.getMemberCount(body.roomId);
        //roomUpdate 초기화
        let roomUpdate = {};
        //만약 0명 이하이면
        if (memberCount <= 0) {
            //해당 방을 제거하고
            await this.redisService.removeRoom(body.roomId);
            //roomUpdate 객체를 다음과 같이 초기화
            roomUpdate = {
                ...room,
                members: []
            }
        } else {//멤버 수가 유효하면, 해당 방의 정보 받아옴
            roomUpdate = await this.roomService.getRoom(body.roomId, 'leaveRoom');
        }
        //해당 roomId 방에 존재하는 모든 소켓에게 해당 정보를 브로드캐스트한다.
        this.server.to(body.roomId).emit('roomUpdate', roomUpdate);
        //Socket.IO Room에서 탈퇴
        client.leave(body.roomId);
        return room;
    }
}