//canActivate : Guard를 구현하기 위한 인터페이스, ExecutionContext : 요청 정보에 접근하기 위한 NestJS의 Context 객체
//Ingectable : 의존성 주입 데코레이터, UnauthorizedException : 인증 실패 시 발생시킬 예외
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Observable } from "rxjs";
import { RedisService } from "src/redis/redis.service";
import { User } from "src/user/user.entity";
import { UserService } from "src/user/user.service";
import { Request } from "express";

//기본 Request 객체에 user 필드를 확장하여 타입으로 정의
//이후 request.user로 접근할 때 타입 추론을 명확하게 하기 위해 사용
export interface AuthenticatedRequest extends Request {
    user: User;
}

@Injectable()
//NestJS에서 해당 클래스를 Guard로 인식하게 만든다.
//CanActivate를 구현함으로써 Guard로 사용이 가능하다.
//이 Guard는 요청이 특정 컨트롤러/핸들러에 접근하기 직전 실행된다.
export class HttpSessionGuard implements CanActivate {
    //의존성 주입
    constructor(
        //세션ID를 기반으로 사용자 세션을 Redis에서 조회
        private readonly redisService: RedisService,
        //세션에서 얻은 사용자 ID(seq)를 바탕으로 DB에서 user 정보 조회
        private readonly userService: UserService,
    ) { }

    //Guard가 실행되는 메서드, 요청을 허용할지 여부를 boolean으로 반환
    async canActivate(context: ExecutionContext): Promise<boolean> {
        //Request 객체 추출
        //ExecutionContext는 HTTP, GraphQL, RPC등 다양한 Context 지원
        //switchToHTTP()를 통해 HTTP Context로 전환, Express의 Request 객체를 추출
        const request: Request = context.switchToHttp().getRequest();
        //세션 ID를 요청 Header의 authorization 혹은 쿼리 파라미터에서 추출
        //접근 방법 : Authorizztion : abc123 혹은 GET/api?sessionId=abc123
        const sessionId = request.headers['authorization'] || request.query.sessionId;

        //세션 ID가 존재하지 않거나 문자열이 아니면 401 예외 발생
        if (!sessionId || typeof sessionId !== 'string') {
            throw new UnauthorizedException("Missing session Id");
        }

        //Redis에 저장된 세션 데이터(ex : {seq : 1})를 조회
        //존재하지 않으면 인증 실패로 간주
        const session = await this.redisService.getSession(sessionId);
        if (!session) {
            throw new Error('redis sesion handler is empty');
        }

        //세션 객체에서 사용자 ID(seq)를 꺼내 DB에 사용자 정보를 조회
        //조회된 user 객체를 Express의 request 객체에 주입
        const user = await this.userService.findByIdOrFail(session.seq);
        request['user'] = user;

        //최종 인증 성공(true 반환)
        return true;
    }
}