export interface IGDBGame {
    id: number;
    name: string;
    releaseDate?: Date;
    coverUrl?: string;
    screenshotUrl?: string;
    screenshotUrls?: string[];
    summary?: string;
}
export declare class IGDBService {
    private clientId;
    private accessToken;
    private baseUrl;
    constructor(clientId: string, accessToken: string);
    private makeRequest;
    getGameById(gameId: number, includeDetails?: boolean): Promise<IGDBGame | null>;
    getGameBySlug(slug: string, includeDetails?: boolean): Promise<IGDBGame | null>;
    searchGame(query: string): Promise<IGDBGame[]>;
    extractSlugFromUrl(url: string): string | null;
}
