import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";

@Entity('poketmon_skill')
export class PoketmonSkill {
    @PrimaryColumn()
    pokemon_id: number;

    @PrimaryColumn()
    skill_id: number;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'varchar', length: 100 })
    type: string;

    @Column({ type: 'int' })
    damage: number;

    @Column({ type: 'varchar', length: 100 })
    target: string;

    @Column({ type: 'int' })
    pp: number;
}