import { LetterboxdReview } from '../types/index.js';
export declare class LetterboxdService {
    private baseUrl;
    private tmdbService;
    constructor(tmdbApiKey: string);
    /**
     * Récupère le flux RSS d'un utilisateur Letterboxd
     */
    private fetchRSS;
    /**
     * Récupère les avis d'un utilisateur depuis le flux RSS
     */
    getUserReviews(username: string, onlyLatest?: boolean): Promise<LetterboxdReview[]>;
    /**
     * Valide qu'un utilisateur existe en testant son flux RSS
     */
    isValidUsername(username: string): Promise<boolean>;
    /**
     * Parse la description HTML pour extraire l'URL du poster et le texte de la review
     */
    private parseDescription;
    private formatDate;
    extractYearFromTitle(title: string): {
        title: string;
        year?: string;
    };
    parseLetterboxdRating(ratingText: string): number | undefined;
    formatRatingAsEmoji(rating: number): string;
    /**
     * Enrichit les avis avec les images TMDB si nécessaire
     */
    private enrichReviewsWithTMDB;
}
