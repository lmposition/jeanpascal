import { Client } from 'discord.js';
import { GamesDatabase } from '../database/gamesDatabase.js';
import { IGDBService } from './igdbService.js';
export declare class GameCountdownService {
    private client;
    private gamesDb;
    private igdbService;
    private channelId;
    private messageId;
    private updateInterval;
    private checkInterval;
    private cleanupInterval;
    private currentScreenshotIndex;
    private allScreenshots;
    private updateCounter;
    private currentGameId;
    constructor(client: Client, gamesDb: GamesDatabase, igdbService: IGDBService, channelId: string);
    private formatCountdown;
    private getRandomColor;
    private createEmbed;
    start(): Promise<void>;
    private updateCountdown;
    private checkForReleasedGames;
    private checkReleasesAndUpdate;
    private announceRelease;
    private cleanupOldReleaseMessages;
    stop(): void;
}
