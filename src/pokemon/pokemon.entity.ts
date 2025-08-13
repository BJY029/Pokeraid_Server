import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('user_poketmon')
export class UserPoketmon {
    @PrimaryGeneratedColumn()
    seq: number;

    @Column()
    user_seq: number;

    @Column()
    pokemon_id: number;
}

@Entity('poketmon')
export class Poketmon {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column()
    hp: number;
}