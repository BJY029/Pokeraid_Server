import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { BlockchainService } from "./blockchain.service"
import { HttpSessionGuard } from "src/guard/http.session.guard";

//블록체인 api
@Controller('blockchain')
export class BlockchainController {
    constructor(
        private readonly blockchainService: BlockchainService
    ) { }

    //잔액 확인 api
    @Get('balance')
    //guard를 사용하여 session 인증 후, user 정보 받아온다.
    @UseGuards(HttpSessionGuard)
    async getBalance(@Req() request: any) {
        //특정 user의 잔액을 확인하는 서비스 호출
        return this.blockchainService.getBalance(request.user);
    }

    //출금 api
    @Post('deduct')
    //guard를 사용하여 session 인증 후, user 정보 받아온다.
    @UseGuards(HttpSessionGuard)
    //body로 amount 정보 받아온다.
    async deductTokens(@Req() req: any, @Body('amount') amount: string) {
        //특정 user 계좌에서 금액을 감소시키는 서비스 호출
        return this.blockchainService.deductToTokens(req.user, amount);
    }

    @Post('grant')
    //guard를 사용하여 session 인증 후, user 정보 받아온다.
    @UseGuards(HttpSessionGuard)
    //body로 amount 정보 받아온다.
    async grantToken(@Req() req: any, @Body('amount') amount: string) {
        //특정 user 계좌에서 금액을 추가시키는 서비스 호출
        return this.blockchainService.grantToken(req.user, amount);
    }
}