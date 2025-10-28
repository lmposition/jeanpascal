export interface TranslationResult {
    originalText: string;
    translatedText: string;
    detectedLanguage: string;
    wasTranslated: boolean;
}
export declare class TranslationService {
    private apiKey;
    private baseUrl;
    constructor(apiKey: string);
    /**
     * Détecte si un texte est en anglais en utilisant des heuristiques simples
     * @param text Texte à analyser
     * @returns true si le texte semble être en anglais
     */
    private isEnglishText;
    /**
     * Traduit un texte de l'anglais vers le français si nécessaire
     * @param text Texte à traduire
     * @returns Résultat de la traduction avec informations
     */
    translateIfNeeded(text: string): Promise<TranslationResult>;
    /**
     * Teste la connexion à l'API DeepL
     * @returns true si la connexion fonctionne
     */
    testConnection(): Promise<boolean>;
}
