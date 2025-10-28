import { CommandInteraction } from 'discord.js';
import { ReviewDatabase } from '../database/database.js';
import { SteamService } from '../services/steamService.js';
import { LetterboxdService } from '../services/letterboxdService.js';
import { SensCritiqueService } from '../services/senscritiqueService.js';
export declare class LastReviewCommand {
    private db;
    private steamService;
    private letterboxdService;
    private tmdbService;
    private sensCritiqueService;
    constructor(db: ReviewDatabase, steamService: SteamService, letterboxdService: LetterboxdService, sensCritiqueService: SensCritiqueService);
    getSlashCommand(): import("discord.js").SlashCommandOptionsOnlyBuilder;
    execute(interaction: CommandInteraction): Promise<void>;
    private createReviewEmbed;
    private getReviewContent;
    private formatLetterboxdRating;
    private formatSensCritiqueRating;
    private getReviewColor;
    private getPlatformIcon;
    private createActionButtons;
    private getTMDBUrl;
    private getTrailerUrl;
    private getValidReviewUrl;
    private isValidUrl;
    private enrichReviewIfNeeded;
}
