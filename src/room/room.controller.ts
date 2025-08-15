import { Controller, Get, UseGuards } from '@nestjs/common';
import { HttpSessionGuard } from 'src/guard/http.session.guard';
import { RoomService } from './room.service';

@Controller('rooms')
export class RoomController {
    constructor(private readonly roomService: RoomService) { }

    //방 레이드 목록을 조회하는 API
    @Get()
    @UseGuards(HttpSessionGuard)
    async getRooms() {
        //모든 방의 정보를 조회한다.
        return await this.roomService.getRooms();
    }
}