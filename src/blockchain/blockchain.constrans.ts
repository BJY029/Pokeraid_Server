//ERC-20 토큰 스마트 컨트렉트 주소, 해당 주소를 사용해 스마트 컨트렉트 연결
export const CONTRACT_ADDRESS = '0xe21e2054827347021453e24822130dd97a7f9351';
//토큰 배포자 혹은 컨트랙트를 조작할 권한이 있는 소유자의 공개 주소
//transfer, mint, burn 등의 함수들을 트리거 할 때 사용
export const OWNER_ADDRESS = '0xd186720360294F4a7C9E601f8CC3ac94134429FF'
//위에서 정의한 권한 소유자의 공개 주소에 대응되는 개인 키
//거래에 서명할 때 사용 된다.
export const OWNER_PRIVATE_KEY = '0x29eec5cc035c288408380f522542735db5e8fedaf3219f8d99b1bbd100539bb8';
//Kaia 체인의 공개 RPC 노드 주소
export const RPC_URL = 'https://public-en-kairos.node.kaia.io';