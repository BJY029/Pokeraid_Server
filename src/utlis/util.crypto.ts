import * as crypto from 'crypto';

//사용할 암호화 알고리즘
const algorithm = 'aes-256-cbc';
//private key 대칭키
const key = Buffer.from('4a656e6e79426c6f636b436861696e566f6c747a6369706572aabbccddeeff11', 'hex');
//첫 블록에 사용될 패턴 iv
const iv = Buffer.from('aabbccddeeff11223344556677889900', 'hex');

//암호화 함수
export function encrypt(text: string): string {
    //createCipheriv로 암호화 객체를 생성
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    //입력 문자열(text)를 UIF-8로 해석해 암호화하고, 해당 결과를 HEX 문자열로 출력
    let encrypted = cipher.update(text, 'utf8', 'hex');
    //내부 버퍼에 남은 데이터를 처리하고, 결과를 합쳐 최종 암호문 완성
    encrypted += cipher.final('hex');
    return encrypted;
}

//복호화 함수
export function decrypt(encrypted: string): string {
    //createCipheriv로 암호화 객체를 생성
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    //암호화 된 HEX 문자열을 입력받아 UTF-8 문자열로 복호화
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    //남은 데이터 처리 후, 결과를 합쳐 최종 복호문 완성
    decrypted += decipher.final('utf8');
    return decrypted;
}