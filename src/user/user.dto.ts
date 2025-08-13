//회원가입 요청 DTO
export class RegistrationReqDto {
    id: string;
    password: string;
}

//회원가입 응답 DTO
export class RegistartionResDto {

}

//로그인 요청 DTO
export class LogInReqDto {
    id: string;
    password: string;
}

//로그인 응답 DTO
export class LogInResDto {
    sessionId: string;
    seq: number;
    id: string;
}

export class WalletLinkReqDto {
    privateKey: string;
}