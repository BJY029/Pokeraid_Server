//JS/TS에서 사용할 수 있도록 정의하는 스마트 컨트렉트 함수 정의 배열
export const ERC20ABI = [
    {
        //특정 주소의 토큰 잔액을 조회하는 함수
        //constant를 true로 설정하여 상태를 변경하지 않고 조회만 가능하도록 함
        constant: true,
        //주소를 입력으로 받음
        inputs: [{ name: "account", type: "address" }],
        //함수이름
        name: "balanceOf",
        //uint256 타입의 잔액을 반환
        outputs: [{ name: "", type: "uint256" }],
        type: "function"
    },
    {
        //현재 사용자가 다른 주소로 토큰을 전송하는 함수
        //constant를 false로 설정하여 변경 가능하도록 설정
        constant: false,
        //recipient : 받는 사람 주소, amount : 보낼 토큰 수량
        inputs: [
            { name: "recipient", type: "address" },
            { name: "amount", type: "uint256" }
        ],
        //함수 이름
        name: "transfer",
        //성공 여부를 bool 형으로 반환
        outputs: [{ name: "", type: "bool" }],
        type: "function"
    },
    {
        //토큰을 영구히 소각하여 유통량을 줄이는 함수(커스텀 확장 함수)
        //constant를 false로 설정하여 변경 가능하도록 설정
        constant: false,
        //소각할 amount를 입력으로 받음
        inputs: [{ name: "amount", type: "uint256" }],
        name: "burn",
        outputs: [],
        type: "function"
    }
];