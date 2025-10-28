import { ChatInputCommandInteraction } from 'discord.js';
export declare class SensCritiqueCommand {
    getSlashCommand(): import("discord.js").SlashCommandOptionsOnlyBuilder;
    execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
