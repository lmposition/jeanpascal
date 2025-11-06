import { Client } from 'discord.js';
export declare class StreamingMonitor {
    private client;
    private streamingService;
    private channelId;
    private messageTimers;
    private userCooldowns;
    private cooldownDuration;
    constructor(client: Client, rapidApiKey: string);
    start(): void;
    private createStreamingEmbed;
    private createStreamingButtons;
    private getTypeEmoji;
    private scheduleMessageDeletion;
    stop(): void;
}
