import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { GamesDatabase } from '../database/gamesDatabase.js';
import { IGDBService } from '../services/igdbService.js';
export declare const data: SlashCommandBuilder;
export declare function execute(interaction: ChatInputCommandInteraction, gamesDb: GamesDatabase, igdbService: IGDBService): Promise<void>;
