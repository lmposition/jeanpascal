export interface TrackedGame {
    id?: number;
    igdbId: number;
    name: string;
    releaseDate: Date;
    createdAt?: string;
}
export declare class GamesDatabase {
    private db;
    constructor(dbPath?: string);
    private initTables;
    addGame(igdbId: number, name: string, releaseDate: Date): TrackedGame | null;
    getGameByIgdbId(igdbId: number): TrackedGame | null;
    getAllGames(): TrackedGame[];
    getUpcomingGames(): TrackedGame[];
    getReleasedGames(): TrackedGame[];
    removeGame(igdbId: number): boolean;
    updateReleaseDate(igdbId: number, releaseDate: Date): boolean;
    addReleaseMessage(igdbId: number, messageId: string): boolean;
    getOldReleaseMessages(hoursOld?: number): Array<{
        id: number;
        messageId: string;
        igdbId: number;
    }>;
    deleteReleaseMessage(id: number): boolean;
    close(): void;
}
