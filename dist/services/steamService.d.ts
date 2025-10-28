import { SteamGame } from '../types/index.js';
export declare class SteamService {
    private apiKey;
    private baseUrl;
    constructor(apiKey: string);
    getUserGames(steamId: string): Promise<SteamGame[]>;
    getRecentlyPlayedGames(steamId: string): Promise<SteamGame[]>;
    getUserReviews(steamId: string, onlyLatest?: boolean): Promise<any[]>;
    getGameDetails(appId: number): Promise<any>;
    getUserProfile(steamId: string): Promise<any>;
    isValidSteamId(steamId: string): Promise<boolean>;
    convertSteamId(steamId: string): string;
    getGameImageUrl(appId: number, imageHash?: string): string;
    private extractAppIdFromUrl;
    private getGameTitle;
    private formatSteamDate;
}
