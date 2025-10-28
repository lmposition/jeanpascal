export interface SensCritiqueReview {
    title: string;
    rating: number;
    reviewUrl: string;
    fullReviewContent?: string;
    content?: string;
    reviewDate?: string;
    coverImage?: string;
    movieId?: string;
}
export declare class SensCritiqueService {
    private baseUrl;
    private tmdbService;
    constructor(tmdbApiKey: string);
    /**
     * Récupère les avis d'un utilisateur SensCritique depuis le web
     * @param username Nom d'utilisateur SensCritique
     * @param onlyLatest Si true, ne récupère que le dernier avis
     * @returns Liste des avis trouvés
     */
    getUserReviews(username: string, onlyLatest?: boolean): Promise<SensCritiqueReview[]>;
    /**
     * Récupère le contenu complet d'un avis depuis sa page individuelle
     * @param reviewUrl URL de la page de critique individuelle
     * @returns Le contenu complet de l'avis ou null
     */
    private getFullReviewContent;
    /**
     * Parse les avis depuis la page d'un utilisateur SensCritique
     * @param htmlContent Contenu HTML de la page utilisateur
     * @param onlyLatest Si true, ne récupère que le dernier avis
     * @param username Nom d'utilisateur pour les URLs de fallback
     * @returns Liste des avis parsés
     */
    private parseUserReviews;
    /**
     * Extrait les données d'un avis depuis un élément HTML
     * @param $element Élément jQuery contenant l'avis
     * @param $ Instance Cheerio pour la page complète
     * @param username Nom d'utilisateur pour l'URL de fallback
     * @returns Objet SensCritiqueReview ou null
     */
    private extractReviewFromElement;
    /**
     * Debug la structure de la page pour comprendre l'organisation
     * @param $ Instance Cheerio
     */
    private debugPageStructure;
    /**
     * Vérifie si un utilisateur SensCritique existe
     * @param username Nom d'utilisateur à vérifier
     * @returns true si l'utilisateur existe
     */
    isValidUsername(username: string): Promise<boolean>;
    /**
     * Extrait les données d'une critique depuis la page principale SensCritique
     * @param htmlContent Contenu HTML de la page principale
     * @returns Objet contenant le titre, la note et l'URL de la critique
     */
    static extractReviewData(htmlContent: string): SensCritiqueReview | null;
    /**
     * Extrait le contenu complet de la critique depuis la page de contenu
     * @param htmlContent Contenu HTML de la page de critique complète
     * @returns Texte de la critique complète
     */
    static extractFullReviewContent(htmlContent: string): string | null;
}
