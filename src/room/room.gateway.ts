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

    //가드를 사용하여 session 검증 후, client['user'] 주입
    @UseGuards(WsSessionGuard)
    //클라가 socket.emit('startRaid', payload) 보냈을 때 이 메서드가 실행.
    @SubscribeMessage('startRaid')
    //소켓 객체와 메시지 본문에 DTO 주입
    async handleStartRaid(@ConnectedSocket() client: Socket, @MessageBody() body: { roomId: string }) {
        //client 객체의 user 정보를 가져온다.
        const user = client['user'];
        //body에서 받은 방 정보를 통해서 방 객체를 가져온다.
        const room = await this.roomService.getRoom(body.roomId, 'startRaid');
        //해당 방의 방장이 아닌 경우, 게임 시작을 막는다.
        if (room.leaderId !== user.seq) {
            throw new ForbiddenException('Only the room leader can start the raid');
        }
        //해당 방의 인원수가 충분하지 않으면 게임 시작을 막는다.
        if (!room.members || room.members.length < 2) {
            throw new Error('member length < 2');
        }
        //pokemonService를 사용하여 room 정보에 저장된 보스 포켓몬의 상세 정보를 DB에서 불러온다.
        const boss = await this.poketmonService.getPokemonWithSkills(room.bossPokemonId);
        //해당 boss 정보가 없는 경우 예외 던짐
        if (!boss) throw new Error('boss not found');

        //해당 방의 멤머를 await Promise.all을 통해 비동기적으로 동시에 조회해서 가져온다.
        //map을 통해 각 멤버에 대한 Promise 배열을 생성하고
        //promise.all은 해당 모든 promise가 완료될 때 까지 기다린다.
        const members = await Promise.all(
            //room.members 배열의 각 member에 대해서 다음 작업을 수행한다.
            room.members.map(async (member) => {
                //각 멤버의 userSeq를 이용하여 해당 user가 소유한 모든 포켓몬 목록을 가져온다.
                const pokemons = await this.poketmonService.getUserPokemons(member.userSeq);
                //해당 user가 소유한 포켓몬들 중에, 해당 멤버가 선택한 포켓몬을 찾는다.
                const selected = pokemons.find((p) => p.pokemonId == member.pokemonId);
                //만약 선택한 포켓몬이 존재하지 않으면 오류를 발생시킨다.
                if (!selected) throw new Error(`Invalid pokemon for user ${member.userSeq}`);

                //위에서 찾은 정보들을 바탕으로 전투 상태에 사용될 표준화된 멤버 객체를 생성해 반환한다.
                return {
                    //해당 멤버의 순서
                    order: member.order,
                    //해당 멤버 id
                    userSeq: member.userSeq,
                    //연결 상태(on으로 고정)
                    connectionStatus: 'on',
                    //해당 user의 보유 포켓몬 정보
                    poketmon: {
                        seq: selected.pokemonId,
                        hp: selected.hp,
                        skills: selected.skills.map((s) => ({
                            seq: s.skill_id,
                            pp: s.pp,
                        })),
                    },
                };
            }),
        );

        //보스 또한 전투에 참여하는 하나의 '멤버'로 취급하기 위해, 플레이어 멤버들과 동일한 구조를 가진
        //bossMember 객체를 생성한다.
        const bossMember = {
            order: 0,
            userSeq: 0,
            connectionStatus: 'on',
            poketmon: {
                seq: boss.id,
                hp: boss.hp,
                skills: boss.skills.map((s) => ({
                    seq: s.skill_id,
                    count: s.pp,
                })),
            },
        };

        //이제 불러온 멤버들을 order 프로퍼티를 기준으로 오름차순으로 정렬한다.(턴 순서 결정)
        const sortedMembers = [...members].sort((a, b) => a.order - b.order);
        //레이드의 모든 상태 정보를 담을 객체를 생성한다.
        const battleState = {
            //정렬된 멤버 및 보스 멤버를 포함한 멤버 배열
            members: [...sortedMembers, bossMember],
            //현재 턴에 대한 정보 및 다음에 행동을 할 user의 id를 저장한다.
            turn: { count: 1, next: sortedMembers[0].userSeq },
            //전투의 현재 상태
            action: null,
            status: 'fighting',
            eventType: 'startRaid'
        };

        //위에서 생성한 전투 상태 정보 객체를 Redis에 저장한다.
        await this.redisService.setBattleState(body.roomId, battleState);
        //해당 핸들러가 속한 서버에 이벤트를 보낸다.
        //'chageTurn'이라는 이름의 이벤트를 전송하며, 현재 전투 상태 정보 객체를 보낸다.
        //클라이언트는 해당 이벤트를 받아서 전투 UI 및 첫 번째 턴을 시작하게 된다.
        this.server.to(body.roomId).emit('changeTurn', battleState);
    }

    //가드를 사용하여 session 검증 후, client['user'] 주입
    @UseGuards(WsSessionGuard)
    //클라가 socket.emit('action', payload) 보냈을 때 이 메서드가 실행.
    @SubscribeMessage('action')
    //소켓 객체와 메시지 본문에 DTO 주입
    async handleAction(@ConnectedSocket() client: Socket, @MessageBody() body: { roomId: string, skillSeq: number }) {
        //client 객체의 user 정보를 가져온다.
        const user = client['user'];
        //방에서 현재 전투 상태 정보 객체를 가져온다.
        const state = await this.redisService.getBattleState(body.roomId);

        console.log(user);
        console.log("state");
        console.log(state);

        //현재 내 turn이 아니면 실행하지 않는다.
        if (state.turn.next !== user.seq) {
            throw new ForbiddenException('Not your ture');
        }
        //스킬 시전자를 가져온다.
        const actor = state.members.find((m) => m.userSeq == user.seq);
        //보스 포켓몬을 가져온다.
        const boss = state.members.find((m) => m.userSeq == 0);
        //const skill = actor.poketmon.skills.find((s) => s.seq == body.skillSeq);

        //스킬 시전자의 포켓몬을 가져온다.
        const actorPoketmon = await this.poketmonService.getPokemonWithSkills(actor.poketmon.seq);
        //시전할  스킬 정보를 가져온다.
        const actionSkill = actorPoketmon?.skills.find(s => s.skill_id == body.skillSeq);
        //스킬 정보가 없으면 에러 발생
        if (!actionSkill) {
            throw new Error();
        }

        console.log("boss");
        console.log(boss);

        //보스 포켓몬의 hp를 기술 공격력에 맞게 계산한다.
        boss.poketmon.hp = Math.max(0, boss.poketmon.hp - actionSkill.damage);

        //현재 레이드 상태를 체크한다.
        const status = this.checkBattleStatus(state);
        //다음 turn의 user 정보를 가져온다.
        const nextUser = this.getNextAliveUser(state, user.seq);

        //레이드의 전투 상태를 저장할 객체를 다음과 같이 선언한다.
        const updateState = {
            //현재 레이드 상태
            ...state,
            //스킬 시전 정보
            action: {
                actor: user.seq,
                skill: body.skillSeq,
                target: [0],
            },
            //turn 정보
            turn: {
                count: state.turn.count + 1,
                next: nextUser,
            },
            status,
            eventType: 'action'
        };

        //해당 방에 위에서 설정한 레이드 전투 상태를 업데이트 한다.
        await this.redisService.setBattleState(body.roomId, updateState);
        //'chageTurn'이라는 이름의 이벤트를 전송하며, 현재 전투 상태 정보 객체를 보낸다.
        this.server.to(body.roomId).emit('changeTurn', updateState);

        //만약 다음 턴이 boss이며, 현재 전투 중이라면
        if ((nextUser === 0) && (status === 'fighting')) {
            //보스 턴을 실행한다.
            this.executeBossTurn(body.roomId);
        }

        //전투가 끝난 경우
        if (status !== 'fighting') {
            //member 중 보스를 제외한 플레이어를 가져오고
            const players = state.members.filter((m) => m.id !== 0);
            //전투를 끝낸다.
            this.finalizeBattle(body.roomId, players);
        }
    }

    //보스 turn을 처리하는 함수
    private async executeBossTurn(roomId: string) {
        //현재 레이드의 상태 정보를 받아온다.
        const state = await this.redisService.getBattleState(roomId);
        //보스 포켓몬 정보를 받아온다.
        const boss = state.members.find((m) => m.userSeq === 0);
        //현재 살아있는 플레이어들의 정보를 받아온다.
        //members 배열에서 boss가 아니고, hp가 0보다 큰 모든 멤버를 필터링하여 배열에 답는다.
        const alivePlayers = state.members.filter((m) => m.userSeq !== 0 && m.poketmon.hp > 0);

        //보스 포켓몬의 스킬들을 가져온다.
        const skills = boss.poketmon.skills;
        //보스가 시전할 스킬을 무작위로 선택한다.
        //Math.random()은 0이상 1 미만의 부동 소수점 난수를 생성
        //해당 난수에 스킬의 길이를 곱해서 스킬 개수 범위의 난수를 생성하게 됨
        //그리고 소수점을 버려서 최종 인덱스를 가져온다.
        const selectedSkill = skills[Math.floor(Math.random() * skills.length)];
        //해당 방의 보스 포켓몬 아이디를 가져온다.
        const bossPokemonId = await this.redisService.getRoomBoss(roomId);
        //해당 보스 포켓몬의 정보를 가져온다.
        const actorPoketmon = await this.poketmonService.getPokemonWithSkills(bossPokemonId);
        //아까 난수로 생성한 스킬 인덱스를 통해 시전할 스킬을 가져온다.
        const actionSkill = actorPoketmon?.skills.find(s => s.skill_id === selectedSkill.seq);
        if (!actionSkill) throw new Error();

        //alivePlayer의 배열 형태로 target을 선언한다.
        let targets: typeof alivePlayers = [];
        //만약 스킬 시전 범위가 싱글이면
        if (actionSkill.target === 'SINGLE') {
            //생존한 플레이어 중 랜덤으로 하나의 target 플레이어를 고른다.
            const randomIndex = Math.floor(Math.random() * Number(alivePlayers.length));
            targets = [alivePlayers[randomIndex]];
            //스킬 시전 범위가 all이면
        } else if (actionSkill.target === 'ALL') {
            //모든 플레이어를 target으로 선정한다.
            targets = alivePlayers;
        }

        //target의 포켓몬 체력을 감소시킨다.
        for (const target of targets) {
            target.poketmon.hp = Math.max(0, target.poketmon.hp - actionSkill.damage);
        }

        //전투 상태와 다음 턴 user를 업데이트 한다.
        const status = this.checkBattleStatus(state);
        const nextUser = this.getNextAliveUser(state, 0);

        //레이드의 전투 상태를 저장할 객체를 다음과 같이 선언한다.
        const updateState = {
            //현재 레이드 상태
            ...state,
            //스킬 시전 정보
            action: {
                actor: 0,
                skill: selectedSkill.seq,
                target: targets.map((t) => t.userSeq),
            },
            //turn 정보
            turn: {
                count: state.turn.count + 1,
                next: nextUser,
            },
            status,
            eventType: 'boss_action'
        };

        //해당 업데이트된 전투 정보를 재설정한다.
        await this.redisService.setBattleState(roomId, updateState);
        //'chageTurn'이라는 이름의 이벤트를 전송하며, 현재 전투 상태 정보 객체를 보낸다.
        this.server.to(roomId).emit('changeTurn', updateState);

        //전투 상태가 아니라면
        if (status !== 'fighting') {
            const players = state.members.filter((m) => m.userSeq !== 0);
            this.finalizeBattle(roomId, players);
        }
    }

    //현재 전투 상태를 파악하고 반환하는 함수
    private checkBattleStatus(state): 'fighting' | 'win' | 'defeat' {
        //보스 포켓몬을 가져온다.
        const boss = state.members.find((m) => m.userSeq === 0);
        //생존한 플레이어 들을 가져온다.
        const alivePlayers = state.members.filter((m) => m.userSeq !== 0 && m.poketmon.hp > 0);
        //만약 보스 포켓몬의 체력이 0 이하이면, win을 반환
        if (boss.poketmon.hp <= 0) return 'win';
        //만약 생존한 플레이어가 없다면 defeat 반환
        if (alivePlayers.length === 0) return 'defeat';
        //그외 전투중 반환
        return 'fighting';
    }

    //다음 턴 플레이어를 반환하는 함수
    private getNextAliveUser(state, currentId): number {
        //보스 포켓몬을 제외한 생존한 멤버들을 order순으로 정렬한다.
        const ordered = state.members.filter((m) => m.userSeq !== 0 && m.poketmon.hp > 0).sort((a, b) => a.order - b.order);
        //현재 턴에서 플레이한 유저의 위치를 정렬된 배열에서 찾는다.
        const currentIndex = ordered.findIndex((m) => m.userSeq === currentId);
        //만약 현재 플레이한 user가 멤버들 턴의 마지막에 위치했었다면, 다음 턴은 boss로 설정
        //아니면, 다음 위치의 user를 다음 턴 플레이어로 설정한다.
        return currentIndex === ordered.length - 1 ? 0 : ordered[currentIndex + 1].userSeq;
    }

    //보상을 지급하는 함수
    private distrubuteRewards(members: { userSeq: number }[], status: 'win' | 'defeat') {
        //승리 여부에 따라서 지급할 보상을 책정한다.
        const amount = status === 'win' ? '30' : '10';
        //각 멤버에게 보상을 지급한다.
        for (const member of members) {
            //각 user를 찾아서, grantToken을 시도한다.
            this.userService.findByIdOrFail(member.userSeq).then((user) => {
                this.blockchainService.grantToken(user, amount).catch((err) => {
                    console.error(`Failed to send tokens to user ${user.id}:`, err);
                });
            });
        }
    }

    //전투를 종료하는 함수
    private async finalizeBattle(roomId: string, members: { userSeq: number }[]) {
        //전투 상태 관련 객체를 삭제한다.
        await this.redisService.removeBattleState(roomId);
        //방을 파괴한다.
        await this.redisService.removeRoom(roomId);
        //각 user에 연결된 방 매핑 정보를 삭제한다.
        for (const member of members) {
            await this.redisService.removeUserRoomMapping(member.userSeq);
        }
    }
}