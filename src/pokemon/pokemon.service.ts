import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Poketmon, UserPoketmon } from "./pokemon.entity";
import { PoketmonSkill } from "./pokemon.skill.entity";
import { BadRequestException, Injectable } from "@nestjs/common";


@Injectable()
export class PoketmonService {
    //의존성 주입
    constructor(
        //포켓몬 테이블 레포
        @InjectRepository(Poketmon)
        private pokemonRepo: Repository<Poketmon>,
        //포켓몬 스킬 테이블 레포
        @InjectRepository(PoketmonSkill)
        private PokemonSkillRepo: Repository<PoketmonSkill>,
        //각 유저 보유 포켓몬 테이블 레포
        @InjectRepository(UserPoketmon)
        private userPokemonRepo: Repository<UserPoketmon>,
    ) { }

    //userSeq를 통해 유저의 보유 포켓몬을 반환해주는 함수
    async getUserPokemons(userSeq: number) {
        //UserPoketmon 테이블에서, user_seq가 전달받은 userSeq인 모든 레코드를 조회
        const userPokemons = await this.userPokemonRepo.find({ where: { user_seq: userSeq } });

        /*
        map() 함수는 배열의 각 요소에 대해 주어진 함수를 실행 후, 그 결과로 새로운 배열을 만들어 반환하는 함수
        userPokemons는 user가 소유한 포켓몬 정보들의 배열이다.
        map 함수의 콜백의 첫 번째 인자는 현재 반복죽인 배열 요소이다.(up)
            즉, up은 userPokemon 배열의 각 개별 요소가 된다.
        */
        //각 포켓몬 정보를 병렬로 조회
        //Promise.all(..)는 배열을 병렬로 처리하기 위해 사용, 모든 await가 병렬로 실행되고, 결과 배열이 result에 담긴다.
        const result = await Promise.all(
            //각 유저-포켓몬 조함에 대해서 반복 처리
            userPokemons.map(async (up) => {
                //포켓몬 기본 정보(name, hp 등)를 조회
                const pokemon = await this.pokemonRepo.findOne({ where: { id: up.pokemon_id } });
                //해당 포켓몬의 스킬 정보 조회
                const skills = await this.PokemonSkillRepo.find({ where: { pokemon_id: up.pokemon_id } });

                //조회된 정보를 하나읭 객체로 리턴
                return {
                    pokemonId: up.pokemon_id,
                    name: pokemon?.name,
                    hp: pokemon?.hp,
                    skills,
                };
            }),
        );

        //위에서 map으로 만든 포켓몬 정보 객체들을 담은 배열을 반환
        return result;
    }

    //스타터 포켓몬을 지급하는 서비스
    async giveStarterPokemon(userseq: number) {
        //pokemon 테이블에서 id=1 인 포켓몬을 찾는다.
        const starter = await this.pokemonRepo.findOne({ where: { id: 1 } });
        //없으면 예외 던짐
        if (!starter) throw new BadRequestException('Starter pokemon not found');

        //해당 스타터 포켓몬을 user_pokemon 테이블에 user_seq와 함께 레코드를 삽입한다.
        const userPokemon = this.userPokemonRepo.create({
            user_seq: userseq,
            pokemon_id: starter.id,
        });

        //새로 만든 유저 포켓몬 데이터를 DB에 저장하고, 해당 데이터 객체를 반환한다.
        return this.userPokemonRepo.save(userPokemon);
    }

    //특정 포켓몬의 스킬 정보를 지급하는 서비스
    async getPokemonWithSkills(id: number) {
        //해당 id의 포켓몬을 pokemon 테이블에서 조회한다.
        const pokemon = await this.pokemonRepo.findOne({ where: { id } });
        //없으면 null 반환
        if (!pokemon) return null;

        //pokemon_id가 일치하는 스킬들을 모두 조회
        const skills = await this.PokemonSkillRepo.find({ where: { pokemon_id: pokemon.id } });

        return {
            //... : pokemon 객체 안에 있는 모든 키-값 쌍을 하나씩 풀어서 복사하는 스프레드 연산자.
            ...pokemon,
            skills: skills,
        }
    }

    //특정 포켓몬을 특정 유저에게 부여하는 함수
    async givePokemon(userSeq: number, pokemonId: number) {
        const pokemon = await this.pokemonRepo.findOne({ where: { id: pokemonId } });
        if (!pokemon) throw new BadRequestException('Pokemon not found');

        const userPokemon = this.userPokemonRepo.create({
            user_seq: userSeq,
            pokemon_id: pokemon.id,
        });

        return this.userPokemonRepo.save(userPokemon);
    }
}