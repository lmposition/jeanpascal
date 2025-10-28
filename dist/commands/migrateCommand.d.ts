import { ChatInputCommandInteraction } from 'discord.js';
import { ReviewDatabase } from '../database/database.js';
export declare class MigrateCommand {
    private db;
    constructor(db: ReviewDatabase);
    getSlashCommand(): import("discord.js").SlashCommandOptionsOnlyBuilder;
    execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
