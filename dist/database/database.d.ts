import { User, Review } from '../types/index.js';
export declare class ReviewDatabase {
    private db;
    constructor(dbPath?: string);
    private initTables;
    addUser(discordId: string, platform: 'steam' | 'letterboxd' | 'senscritique', platformUserId: string, platformUsername: string): User | null;
    getUserById(id: number): User | null;
    getUserByDiscordAndPlatform(discordId: string, platform: 'steam' | 'letterboxd' | 'senscritique'): User | null;
    getAllUsers(): User[];
    getUserByPlatformUsername(username: string, platform: 'steam' | 'letterboxd' | 'senscritique'): User | null;
    addReview(review: Omit<Review, 'id' | 'createdAt'>): Review | null;
    getReviewById(id: number): Review | null;
    getReviewsByUser(userId: number): Review[];
    getReviewByUserAndUrl(userId: number, reviewUrl: string): Review | null;
    reviewExists(userId: number, reviewUrl: string): boolean;
    getLatestReviewByUser(userId: number): Review | null;
    getLatestReviewByUserAndPlatform(userId: number, platform: string): Review | null;
    getUnpostedReviews(maxRetries?: number): Review[];
    markReviewAsPosted(reviewId: number): boolean;
    incrementRetryCount(reviewId: number): boolean;
    close(): void;
}
