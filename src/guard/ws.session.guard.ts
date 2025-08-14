import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { RedisService } from "src/redis/redis.service";

@Injectable()
export class WsSessionGuard implements CanActivate {
    constructor(private readonly redisService: RedisService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        //WebSocket 컨텍스트로 전환, Socket 객체를 받아온다.
        const client = context.switchToWs().getClient();
        //handshake 헤더는 Socket.io에서 클라이언트가 서버로 최초 연결을 시도할 때 주고받는 요청/응답 정보를 말한다.
        //(네트워크에서 handshake는 연결을 확립하는 초기 단계를 뜻한다.)
        //handshake.header 에는 첫 연결 요청시 HTTP 헤더에 포함된 모든 정보를 담고 있다.
        //해당 헤더에서 session Id를 가져온다.
        const sessionId = client.handshake.headers['sessionid'];

        //예외 처리
        if (!sessionId || typeof sessionId !== 'string') {
            throw new UnauthorizedException('Missing session ID');
        }

        //해당 세션ID를 통해서 세션을 가져온다.
        const session = await this.redisService.getSession(sessionId);
        if (!session) {
            throw new UnauthorizedException('Invalid or expired session');
        }

        //해당 소켓 객체에 사용자 정보(session)를 탑재하고 true를 반환한다.
        client['user'] = session;
        return true;
    }
}