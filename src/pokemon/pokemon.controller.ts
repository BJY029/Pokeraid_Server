import { Controller, Get, Req } from "@nestjs/common";
import { PoketmonService } from "./pokemon.service";

@Controller('pokemons')
export class PokemonController {
    constructor(private readonly pokemonservice: PoketmonService) { }

    @Get('all')
    async getBalance(@Req() req: any) {
        return this.pokemonservice.getAllPokemonWithSkills();
    }
}