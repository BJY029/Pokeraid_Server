//NestJS에서 HTTP 요청을 처리할 때 사용하는 데코레이터들을 impory
//Contorller : 클래스를 컨트롤러로 정의, Post : HTTP 메서드와 경로를 매핑
//Body : 요청 body의 데이터를 가져옴
import { Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
//의존성 주입을 위한 서비스 및 DTO import
import { UserService } from './user.service';
import { RedisService } from 'src/redis/redis.service';
import { LogInReqDto, LogInResDto, RegistrationReqDto, WalletLinkReqDto } from './user.dto';
import { v4 as uuidv4, v4 } from 'uuid';
import { AuthenticatedRequest, HttpSessionGuard } from 'src/guard/http.session.guard';
import { PoketmonService } from 'src/pokemon/pokemon.service';

//해당 클래스가 HTTP 요청의 엔트포인트 컨트롤러임을 나타낸다.
// /users/* 로 URL 경로 적용
@Controller('users')
export class UserController {
  constructor( //의존성 주입
    //private readonly는 해당 인스턴스 변수들을 클래스 내에서 읽기 전용으로 사용한다는 의미
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly pokemonService: PoketmonService,
  ) { }

  // POST/users/register 경로와 해당 메서드를 매핑
  @Post('register')
  //#Body()는 클라이언트로부터 JSON으로 전달된 본문을 파싱하여 dto에 주입
  //RegisterationReqDto에 정의된 본문이 dto로 전달
  async register(@Body() dto: RegistrationReqDto) {
    //해당 dto 내의 id와 password를 userService.register로 전달하고 그 결과를 반환
    return this.userService.register(dto.id, dto.password);
  }
  //위 메서드는 회원가입 로직

  //로그인 요청을 받아 사용자를 검증하고, Redis에 세션을 저장하는 함수
  @Post('login')
  //LogInReqDto로 dto를 받아오고, 반환형을 LogInResDto로 약속한다.
  async login(@Body() dto: LogInReqDto): Promise<LogInResDto> {
    //userService의 vaildateUser 함수를 통해서 사용자 검증 진행
    const user = await this.userService.vaildateUser(
      dto.id,
      dto.password,
    );
    //일치하는 사용자가 없으면 401 예외 발생
    if (!user) throw new UnauthorizedException('Invalid credentials');

    //기존 세션을 제거하기 위해 해당 함수 호출
    const existingSessionId = await this.redisService.getSessionIdByUserId(
      user.seq,
    );
    //세션이 존재하면, 해당 세션 종료
    if (existingSessionId) {
      await this.redisService.deleteSession(existingSessionId);
    }

    //새로운 UUID 세션 ID 생성
    const sessionId = uuidv4();
    //세션 ID에 사용자 정보 저장
    await this.redisService.setSession(sessionId, {
      seq: user.seq,
      id: user.id,
    });

    //user seq를 key로 하여셔 sessionId 역매핑 저장
    await this.redisService.setUserSessionMap(user.seq, sessionId);

    //응답 반환
    return {
      sessionId: sessionId,
      seq: user.seq,
      id: user.id
    };
  }

  //NestJS에서 HTTP GET 요청의 라우터 경로 정의
  @Get('pokemons')
  //해당 핸들러에 Guard를 적용하여 접근 제어 수행
  //HttpSessionGuard는 세션 ID를 Redis에서 검증하고, 사용자의 인증 여부를 확인하는 Guard
  //Guard 내부에서 검증 후, 사용자 정보를 reauest['user'] = user로 정보 저장
  //Guard에서 AuthenticatedRequest 인터페이스는 user 타입을 정의
  @UseGuards(HttpSessionGuard)
  async getUserPoketmons(@Req() request: AuthenticatedRequest) {
    //해당 유저의 정보를 pokemonService의 getUserPokemons 함수로 넘기고, 반환되는
    //유저 포켓몬 정보를 반환한다.
    return this.pokemonService.getUserPokemons(request['user'].seq);
  }

  //지갑 주소를 연결하는 api
  @Post('wallet/link')
  //가드를 사용하여 사용자 인증을 하고, 유저 정보를 가져온다.
  @UseGuards(HttpSessionGuard)
  //body dto 정보를 활용하여 private key를 받아온다.
  async walletLine(@Req() request: AuthenticatedRequest, @Body() dto: WalletLinkReqDto) {
    //user 정보와 private key를 지갑 연결 서비스에 넘긴다.
    return this.userService.walletLink(request['user'].seq, dto.privateKey);
  }
}
