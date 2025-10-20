import axios from 'axios';

export interface TranslationResult {
    originalText: string;
    translatedText: string;
    detectedLanguage: string;
    wasTranslated: boolean;
}

export class TranslationService {
    private apiKey: string;
    private baseUrl = 'https://api-free.deepl.com/v2';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    /**
     * Détecte si un texte est en anglais en utilisant des heuristiques simples
     * @param text Texte à analyser
     * @returns true si le texte semble être en anglais
     */
    private isEnglishText(text: string): boolean {
        if (!text || text.trim().length < 10) {
            return false; // Texte trop court pour détecter
        }

        const cleanText = text.toLowerCase().trim();
        
        // Mots anglais très communs qui sont rares en français
        const englishIndicators = [
            'the ', ' the ', 'and ', ' and ', 'that ', ' that ',
            'this ', ' this ', 'with ', ' with ', 'have ', ' have ',
            'will ', ' will ', 'they ', ' they ', 'were ', ' were ',
            'been ', ' been ', 'their ', ' their ', 'what ', ' what ',
            'said ', ' said ', 'each ', ' each ', 'which ', ' which ',
            'she ', ' she ', 'do ', ' do ', 'how ', ' how ',
            'if ', ' if ', 'up ', ' up ', 'out ', ' out ',
            'many ', ' many ', 'time ', ' time ', 'very ', ' very ',
            'when ', ' when ', 'much ', ' much ', 'new ', ' new ',
            'would ', ' would ', 'there ', ' there ', 'way ', ' way ',
            'could ', ' could ', 'people ', ' people ', 'my ', ' my ',
            'than ', ' than ', 'first ', ' first ', 'water ', ' water ',
            'been ', ' been ', 'call ', ' call ', 'who ', ' who ',
            'its ', ' its ', 'now ', ' now ', 'find ', ' find ',
            'long ', ' long ', 'down ', ' down ', 'day ', ' day ',
            'did ', ' did ', 'get ', ' get ', 'has ', ' has ',
            'him ', ' him ', 'his ', ' his ', 'had ', ' had ',
            'let ', ' let ', 'put ', ' put ', 'too ', ' too ',
            'old ', ' old ', 'any ', ' any ', 'after ', ' after ',
            'move ', ' move ', 'why ', ' why ', 'ask ', ' ask ',
            'men ', ' men ', 'change ', ' change ', 'went ', ' went ',
            'light ', ' light ', 'kind ', ' kind ', 'off ', ' off ',
            'need ', ' need ', 'house ', ' house ', 'picture ', ' picture ',
            'try ', ' try ', 'us ', ' us ', 'again ', ' again ',
            'animal ', ' animal ', 'point ', ' point ', 'mother ', ' mother ',
            'world ', ' world ', 'near ', ' near ', 'build ', ' build ',
            'self ', ' self ', 'earth ', ' earth ', 'father ', ' father '
        ];

        // Mots français très communs qui sont rares en anglais
        const frenchIndicators = [
            'le ', ' le ', 'la ', ' la ', 'les ', ' les ',
            'de ', ' de ', 'du ', ' du ', 'des ', ' des ',
            'un ', ' un ', 'une ', ' une ', 'ce ', ' ce ',
            'cette ', ' cette ', 'ces ', ' ces ', 'son ', ' son ',
            'sa ', ' sa ', 'ses ', ' ses ', 'mon ', ' mon ',
            'ma ', ' ma ', 'mes ', ' mes ', 'ton ', ' ton ',
            'ta ', ' ta ', 'tes ', ' tes ', 'notre ', ' notre ',
            'nos ', ' nos ', 'votre ', ' votre ', 'vos ', ' vos ',
            'leur ', ' leur ', 'leurs ', ' leurs ', 'je ', ' je ',
            'tu ', ' tu ', 'il ', ' il ', 'elle ', ' elle ',
            'nous ', ' nous ', 'vous ', ' vous ', 'ils ', ' ils ',
            'elles ', ' elles ', 'que ', ' que ', 'qui ', ' qui ',
            'dont ', ' dont ', 'où ', ' où ', 'quand ', ' quand ',
            'comment ', ' comment ', 'pourquoi ', ' pourquoi ',
            'avec ', ' avec ', 'sans ', ' sans ', 'pour ', ' pour ',
            'par ', ' par ', 'sur ', ' sur ', 'sous ', ' sous ',
            'dans ', ' dans ', 'vers ', ' vers ', 'chez ', ' chez ',
            'depuis ', ' depuis ', 'pendant ', ' pendant ',
            'avant ', ' avant ', 'après ', ' après ', 'mais ', ' mais ',
            'ou ', ' ou ', 'et ', ' et ', 'donc ', ' donc ',
            'or ', ' or ', 'ni ', ' ni ', 'car ', ' car ',
            'si ', ' si ', 'bien ', ' bien ', 'très ', ' très ',
            'plus ', ' plus ', 'moins ', ' moins ', 'aussi ', ' aussi ',
            'encore ', ' encore ', 'déjà ', ' déjà ', 'toujours ', ' toujours ',
            'jamais ', ' jamais ', 'souvent ', ' souvent '
        ];

        let englishScore = 0;
        let frenchScore = 0;

        // Compter les indicateurs anglais
        for (const indicator of englishIndicators) {
            const matches = (cleanText.match(new RegExp(indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
            englishScore += matches;
        }

        // Compter les indicateurs français
        for (const indicator of frenchIndicators) {
            const matches = (cleanText.match(new RegExp(indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
            frenchScore += matches;
        }

        // Vérifications supplémentaires pour l'anglais
        const hasEnglishPatterns = [
            /\b(ing\b)/g,  // Terminaisons en -ing
            /\b(ed\b)/g,   // Terminaisons en -ed
            /\b(ly\b)/g,   // Terminaisons en -ly
            /\b(tion\b)/g, // Terminaisons en -tion (communes dans les deux langues mais plus en anglais)
        ];

        for (const pattern of hasEnglishPatterns) {
            const matches = (cleanText.match(pattern) || []).length;
            englishScore += matches * 0.5; // Poids plus faible car moins spécifiques
        }

        console.log(`🔍 Détection de langue pour: "${text.substring(0, 50)}..."`);
        console.log(`📊 Score anglais: ${englishScore}, Score français: ${frenchScore}`);

        // Si le score anglais est significativement plus élevé, c'est probablement de l'anglais
        const isEnglish = englishScore > frenchScore && englishScore >= 2;
        console.log(`🌐 Langue détectée: ${isEnglish ? 'ANGLAIS' : 'FRANÇAIS'}`);
        
        return isEnglish;
    }

    /**
     * Traduit un texte de l'anglais vers le français si nécessaire
     * @param text Texte à traduire
     * @returns Résultat de la traduction avec informations
     */
    async translateIfNeeded(text: string): Promise<TranslationResult> {
        if (!text || text.trim().length === 0) {
            return {
                originalText: text,
                translatedText: text,
                detectedLanguage: 'unknown',
                wasTranslated: false
            };
        }

        // Détecter si le texte est en anglais
        const isEnglish = this.isEnglishText(text);
        
        if (!isEnglish) {
            console.log(`✅ Texte déjà en français, pas de traduction nécessaire`);
            return {
                originalText: text,
                translatedText: text,
                detectedLanguage: 'french',
                wasTranslated: false
            };
        }

        try {
            console.log(`🔄 Traduction DeepL en cours...`);
            
            const response = await axios.post(`${this.baseUrl}/translate`, null, {
                params: {
                    auth_key: this.apiKey,
                    text: text,
                    source_lang: 'EN',
                    target_lang: 'FR'
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const translatedText = response.data.translations[0].text;
            console.log(`✅ Traduction réussie: "${translatedText.substring(0, 50)}..."`);

            return {
                originalText: text,
                translatedText: translatedText,
                detectedLanguage: 'english',
                wasTranslated: true
            };

        } catch (error) {
            console.error(`❌ Erreur lors de la traduction DeepL:`, error);
            
            // En cas d'erreur, retourner le texte original
            return {
                originalText: text,
                translatedText: text,
                detectedLanguage: 'english',
                wasTranslated: false
            };
        }
    }

    /**
     * Teste la connexion à l'API DeepL
     * @returns true si la connexion fonctionne
     */
    async testConnection(): Promise<boolean> {
        try {
            const response = await axios.get(`${this.baseUrl}/usage`, {
                params: {
                    auth_key: this.apiKey
                }
            });

            console.log(`✅ Connexion DeepL OK - Utilisation: ${response.data.character_count}/${response.data.character_limit} caractères`);
            return true;
        } catch (error) {
            console.error(`❌ Erreur connexion DeepL:`, error);
            return false;
        }
    }
}
