import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Request, Response } from "express";
import { Socket } from "socket.io";

//NestJS에게 해당 클래스가 예외 처리 필터임을 알려준다.
//Catch()의 괄호를 비워두면, 처리되지 않은 모든 종류의 예외를 잡아내는 전역필터로 동작한다.
@Catch()
export class MyGlobalExceptionFilter implements ExceptionFilter {
    //오류를 기록하는 객체, 해당 클래스의 이름을 표시함으로서 해당 클래스에서 로그가 발생했음을 알려준다.
    private readonly logger = new Logger(MyGlobalExceptionFilter.name);

    //ExceptionFilter 인터페이스가 요구하는 메서드
    //예외가 발생했을 때, 실제 호출되는 부분
    //exception의 경우, unknown으로 처리하여 어떤 종류의 예외든 처리할 수 있도록 한다.
    //host의 경우, 실행 컨텍스트에 대한 정보를 담으며, 해당 객체를 통해 요청이 HTTP인지 WS인지 파악한다.
    catch(exception: unknown, host: ArgumentsHost) {
        //실행 컨텍스트의 타입을 문자열로 반환하며, http인지, ws인지확인한다.
        const type = host.getType<'http' | 'ws'>();
        //예외 객체에서 message 속성을 추출한다. message 속성이 없으면 예외 객체 자체를 메시지로 설정한다.
        const message = (exception as any)?.message ?? exception;

        //http 타입인 경우
        if (type === 'http') {
            this.handleHttpException(exception, host, message);
        }
        //websocket 타입인 경우
        else if (type === 'ws') {
            this.handleWsException(exception, host, message);
        }
    }

    //HTTP 요청 중에 발생한 예외를 처리한다.
    private handleHttpException(exception: unknown, host: ArgumentsHost, message: any) {
        //ArgumentsHost를 HTTP 전용 컨텍스트로 전환하여 Request와 Response 객체에 접근할 수 있도록 한다.
        const ctx = host.switchToHttp();
        //response, request 객체를 받아온다.
        const res = ctx.getResponse<Response>();
        const req = ctx.getRequest<Request>();

        //기본적으로 500(내부 서버 오류)로 상태 코드를 설정한다.
        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        //만약 발생한 예외가 NestJS에서 제공하는 HttpException 
        // 혹은 이를 상속받은 예외(NotFoundException 등)인 경우, 해당 예외로 상태 설정
        if (exception instanceof HttpException) {
            status = exception.getStatus();
        }

        //Logger에 오류 정보 기입(HTTP 메서드, 요청 URL, 오류 메시지, 스택 트레이스)
        this.logger.error(
            `[HTTP] ${req?.method} ${req?.url} - ${message}`,
            (exception as any)?.stack,
        );

        //클라이언트에게 JSON 형식으로 표준화된 오류 응답을 보낸다.
        res.status(status).json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: req.url,
            message,
        });
    }

    //WebSocket 요청 중에 발생한 예외를 처리한다.
    private handleWsException(exception: unknown, host: ArgumentsHost, message: any) {
        //ArgumentsHost를 WebSocket 전용 컨택스트로 전환한다.
        const wsCtx = host.switchToWs();
        //오류를 발생시킨 클라이언트의 소켓 객체를 가져온다.
        const client = wsCtx.getClient<Socket>();
        //오류를 유발한 데이터를 가져온다.
        const data = wsCtx.getData();

        //logger에 오류 정보 기입(오류 발생 클라이언트 ID, 오류 데이터, 오류 메시지, 스택 트레이스)
        this.logger.error(
            `[WS] Client : ${client?.id} - Data: ${JSON.stringify(data)} - ${message}`,
            (exception as any)?.stack,
        );

        //소켓을 통해 client에게 'error'라는 이름의 이벤트를 보낸다.
        client.emit('error', {
            status: 'error',
            message,
            timestamp: new Date().toISOString(),
        })
    }
}