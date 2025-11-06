import { Client } from 'discord.js';
export declare class StreamingMonitor {
    private client;
    private streamingService;
    private channelId;
    private messageTimers;
    constructor(client: Client, rapidApiKey: string);
    start(): void;
    private createStreamingEmbed;
    private createStreamingButtons;
    private getTypeEmoji;
    private scheduleMessageDeletion;
    stop(): void;
}
