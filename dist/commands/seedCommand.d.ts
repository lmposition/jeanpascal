import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ReviewDatabase } from '../database/database.js';
import { SteamService } from '../services/steamService.js';
import { LetterboxdService } from '../services/letterboxdService.js';
import { SensCritiqueService } from '../services/senscritiqueService.js';
export declare class SeedCommand {
    private db;
    private steamService;
    private letterboxdService;
    private sensCritiqueService;
    constructor(db: ReviewDatabase, steamService: SteamService, letterboxdService: LetterboxdService, sensCritiqueService: SensCritiqueService);
    getSlashCommand(): SlashCommandBuilder;
    execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
