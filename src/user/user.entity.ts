import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

//데코레이터를 통해 해당 User 클래스가 DB의 'uesr'라는 테이블과 연결됨을 나타낸다.
//@Entity()에 인자가 없으면 클래스 이름 그대로 테이블 이름으로 사용한다.
@Entity('user')
//User는 사용자의 정보를 표현하는 도메인 객체이다.
export class User {
    //기본키 역할을 하는 Column이며, Primary Generated는 숫자가 자동 증가(AUTO_INCREMENT) 되도록 하는 것
    @PrimaryGeneratedColumn()
    seq: number;

    //일반 컬럼 정의에 Unique 옵션을 추가한 것. 중복 불가 한 컬럼이다.
    @Column({ unique: true })
    id: string;

    @Column()
    password: string;

    @Column()
    created_at: number;

    @Column({ nullable: true })
    address: string;

    @Column()
    private_key: string;
}