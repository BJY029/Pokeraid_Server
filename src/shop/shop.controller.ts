import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ShopService } from "./shop.service";
import { HttpSessionGuard } from "src/guard/http.session.guard";

@Controller('shop')
export class ShopController {
    constructor(private readonly shopService: ShopService) { }

    //상점 둘러보기 api
    @Get('/items')
    async getShopItems() {
        //판매 가능한 포켓몬들을 조회해서 반환한다.
        return await this.shopService.getAvailablePokemonItems();
    }

    //구매 api
    //Guard를 통해 세션인증 진행
    @Post('/purchase')
    @UseGuards(HttpSessionGuard)
    //인증된 세션 정보와 추가 바디 json 정보 사용
    async purchaseItem(@Req() req, @Body('itemId') itemId: number) {
        //구매를 진행하고 관련 정보를 반환한다.
        return await this.shopService.purchaseItem(req.user, itemId);
    }
}