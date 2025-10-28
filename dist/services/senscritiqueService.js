import * as cheerio from 'cheerio';
import axios from 'axios';
import { TMDBService } from './tmdbService.js';
export class SensCritiqueService {
    baseUrl = 'https://www.senscritique.com';
    tmdbService;
    constructor(tmdbApiKey) {
        this.tmdbService = new TMDBService(tmdbApiKey);
    }
    /**
     * Récupère les avis d'un utilisateur SensCritique depuis le web
     * @param username Nom d'utilisateur SensCritique
     * @param onlyLatest Si true, ne récupère que le dernier avis
     * @returns Liste des avis trouvés
     */
    async getUserReviews(username, onlyLatest = false) {
        try {
            const url = `${this.baseUrl}/${username}`;
            console.log(`🔍 Récupération des avis SensCritique depuis: ${url}${onlyLatest ? ' (dernier uniquement)' : ''}`);
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                validateStatus: function (status) {
                    return status < 500; // Accepter les codes 404 pour les gérer proprement
                }
            });
            // Gérer les erreurs 404 (utilisateur inexistant)
            if (response.status === 404) {
                console.log(`❌ Utilisateur SensCritique '${username}' introuvable (404)`);
                return [];
            }
            if (response.status !== 200) {
                console.log(`⚠️ Statut HTTP ${response.status} pour l'utilisateur SensCritique '${username}'`);
                return [];
            }
            console.log(`✅ Page SensCritique récupérée avec succès pour ${username}`);
            const reviews = this.parseUserReviews(response.data, onlyLatest, username);
            console.log(`📊 ${reviews.length} avis trouvé(s) pour ${username}`);
            // Pour chaque avis trouvé, essayer de récupérer le contenu complet
            const enrichedReviews = [];
            for (const review of reviews) {
                console.log(`🔍 Avis avant enrichissement: "${review.title}"`);
                console.log(`   - reviewUrl: ${review.reviewUrl}`);
                console.log(`   - fullReviewContent initial: ${review.fullReviewContent ? review.fullReviewContent.substring(0, 50) + '...' : 'VIDE'}`);
                if (review.reviewUrl && review.reviewUrl.includes('/critique/')) {
                    console.log(`🔍 Récupération du contenu complet depuis: ${review.reviewUrl}`);
                    const fullContent = await this.getFullReviewContent(review.reviewUrl);
                    if (fullContent) {
                        review.fullReviewContent = fullContent;
                        console.log(`📝 Contenu complet récupéré: "${fullContent.substring(0, 100)}..."`);
                    }
                    else {
                        console.log(`⚠️ Aucun contenu récupéré depuis la page individuelle`);
                    }
                }
                else {
                    console.log(`⚠️ Pas d'URL de critique ou URL invalide: ${review.reviewUrl}`);
                }
                console.log(`✅ Avis après enrichissement: fullReviewContent = ${review.fullReviewContent ? review.fullReviewContent.substring(0, 50) + '...' : 'VIDE'}`);
                enrichedReviews.push(review);
            }
            return enrichedReviews;
        }
        catch (error) {
            console.error(`❌ Erreur lors de la récupération des avis SensCritique pour ${username}:`, error);
            return [];
        }
    }
    /**
     * Récupère le contenu complet d'un avis depuis sa page individuelle
     * @param reviewUrl URL de la page de critique individuelle
     * @returns Le contenu complet de l'avis ou null
     */
    async getFullReviewContent(reviewUrl) {
        try {
            // S'assurer que l'URL est complète
            const fullUrl = reviewUrl.startsWith('http') ? reviewUrl : `${this.baseUrl}${reviewUrl}`;
            console.log(`🔍 Récupération du contenu depuis: ${fullUrl}`);
            const response = await axios.get(fullUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                validateStatus: function (status) {
                    return status < 500;
                }
            });
            if (response.status !== 200) {
                console.log(`⚠️ Statut HTTP ${response.status} pour l'URL: ${fullUrl}`);
                return null;
            }
            const $ = cheerio.load(response.data);
            // Chercher le contenu de l'avis avec le sélecteur spécifique
            const contentSelectors = [
                '[data-testid="review-content"]', // Sélecteur principal observé
                '.sc-cfcc05b8-0.jBYdEn', // Classe CSS observée
                '.review-content',
                '.critique-content',
                '.content p',
                'p'
            ];
            for (const selector of contentSelectors) {
                const contentElement = $(selector).first();
                if (contentElement.length > 0) {
                    // Remplacer les <br> et </p> par des sauts de ligne avant d'extraire le texte
                    let html = contentElement.html() || '';
                    html = html.replace(/<br\s*\/?>/gi, '\n');
                    html = html.replace(/<\/p>/gi, '\n');
                    // Créer un élément temporaire avec le HTML modifié
                    const tempElement = cheerio.load(`<div>${html}</div>`)('div');
                    const content = tempElement.text().trim();
                    if (content && content.length > 20) { // Au moins 20 caractères
                        console.log(`✅ Contenu trouvé avec sélecteur '${selector}': ${content.length} caractères`);
                        return content;
                    }
                }
            }
            console.log(`⚠️ Aucun contenu trouvé sur la page: ${fullUrl}`);
            return null;
        }
        catch (error) {
            console.error(`❌ Erreur lors de la récupération du contenu complet:`, error);
            return null;
        }
    }
    /**
     * Parse les avis depuis la page d'un utilisateur SensCritique
     * @param htmlContent Contenu HTML de la page utilisateur
     * @param onlyLatest Si true, ne récupère que le dernier avis
     * @param username Nom d'utilisateur pour les URLs de fallback
     * @returns Liste des avis parsés
     */
    parseUserReviews(htmlContent, onlyLatest = false, username = '') {
        try {
            const $ = cheerio.load(htmlContent);
            const reviews = [];
            // Chercher les avis dans différentes sections possibles
            const reviewSelectors = [
                '.elco-collection-item', // Sélecteur principal pour les avis
                '.elco-anchor',
                '.elco-product',
                '[data-testid*="review"]',
                '.review-item',
                '.critique-item'
            ];
            let reviewsFound = false;
            for (const selector of reviewSelectors) {
                const elements = $(selector);
                console.log(`🔍 Recherche avec sélecteur '${selector}': ${elements.length} éléments trouvés`);
                if (elements.length > 0) {
                    elements.each((index, element) => {
                        if (onlyLatest && index > 0)
                            return false; // Arrêter après le premier si onlyLatest
                        try {
                            const $element = $(element);
                            const review = this.extractReviewFromElement($element, $, username);
                            if (review) {
                                reviews.push(review);
                                reviewsFound = true;
                                console.log(`✅ Avis trouvé: "${review.title}" (${review.rating}/10)`);
                            }
                        }
                        catch (error) {
                            console.error(`Erreur lors de l'extraction d'un avis:`, error);
                        }
                    });
                    if (reviewsFound)
                        break; // Arrêter si on a trouvé des avis avec ce sélecteur
                }
            }
            if (!reviewsFound) {
                console.log(`⚠️ Aucun avis trouvé avec les sélecteurs standards. Recherche alternative...`);
                // Essayer une recherche plus large
                this.debugPageStructure($);
            }
            return reviews;
        }
        catch (error) {
            console.error('Erreur lors du parsing des avis SensCritique:', error);
            return [];
        }
    }
    /**
     * Extrait les données d'un avis depuis un élément HTML
     * @param $element Élément jQuery contenant l'avis
     * @param $ Instance Cheerio pour la page complète
     * @param username Nom d'utilisateur pour l'URL de fallback
     * @returns Objet SensCritiqueReview ou null
     */
    extractReviewFromElement($element, $, username = '') {
        try {
            // Extraction du titre
            let title = '';
            const titleSelectors = [
                '[data-testid="productReviewTitle"]',
                '.elco-title',
                '.product-title',
                'h3 a',
                'h2 a',
                '.title a',
                'a[href*="/film/"]',
                'a[href*="/serie/"]',
                'a[href*="/livre/"]'
            ];
            for (const selector of titleSelectors) {
                const titleElement = $element.find(selector).first();
                if (titleElement.length > 0) {
                    title = titleElement.text().trim();
                    if (title)
                        break;
                }
            }
            if (!title) {
                console.log('⚠️ Titre non trouvé pour cet élément');
                return null;
            }
            // Extraction de la note
            let rating = 0;
            const ratingSelectors = [
                '[data-testid="Rating"]',
                '.rating',
                '.note',
                '.score',
                '.elco-rating'
            ];
            for (const selector of ratingSelectors) {
                const ratingElement = $element.find(selector).first();
                if (ratingElement.length > 0) {
                    const ratingText = ratingElement.text().trim();
                    const parsedRating = parseInt(ratingText);
                    if (!isNaN(parsedRating)) {
                        rating = parsedRating;
                        break;
                    }
                }
            }
            // Extraction du lien vers l'avis
            let reviewUrl = '';
            const linkSelectors = [
                'a[data-testid="link"]', // Sélecteur principal observé
                '.sc-9c2f7502-8.djqroE a', // Classe CSS observée
                'a[href*="/critique/"]',
                'a[href*="/avis/"]',
                '.review-link a',
                'a'
            ];
            for (const selector of linkSelectors) {
                const linkElement = $element.find(selector).first();
                if (linkElement.length > 0) {
                    const href = linkElement.attr('href');
                    if (href && (href.includes('/critique/') || href.includes('/avis/'))) {
                        reviewUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
                        console.log(`🔗 Lien critique trouvé avec '${selector}': ${reviewUrl}`);
                        break;
                    }
                }
            }
            // Essayer d'extraire le contenu de l'avis depuis l'élément actuel
            let fullReviewContent = '';
            const contentSelectors = [
                '.elco-review-content',
                '.review-content',
                '.critique-content',
                '.avis-content',
                '.content',
                'p',
                '.text'
            ];
            for (const selector of contentSelectors) {
                const contentElement = $element.find(selector).first();
                if (contentElement.length > 0) {
                    fullReviewContent = contentElement.text().trim();
                    if (fullReviewContent && fullReviewContent.length > 10) { // Au moins 10 caractères
                        console.log(`📝 Contenu d'avis trouvé avec '${selector}': "${fullReviewContent.substring(0, 100)}..."`);
                        break;
                    }
                }
            }
            // Si pas de contenu trouvé, chercher dans l'élément parent
            if (!fullReviewContent) {
                const parentText = $element.text().trim();
                // Extraire le texte qui pourrait être un avis (plus de 20 caractères, pas juste le titre)
                const cleanText = parentText.replace(title, '').replace(/\d+\/10/g, '').trim();
                if (cleanText && cleanText.length > 20) {
                    fullReviewContent = cleanText;
                    console.log(`📝 Contenu d'avis extrait du parent: "${fullReviewContent.substring(0, 100)}..."`);
                }
            }
            return {
                title,
                rating,
                reviewUrl: reviewUrl || `${this.baseUrl}/${username}`, // URL de fallback vers le profil utilisateur
                fullReviewContent: fullReviewContent || undefined
            };
        }
        catch (error) {
            console.error('Erreur lors de l\'extraction des données d\'avis:', error);
            return null;
        }
    }
    /**
     * Debug la structure de la page pour comprendre l'organisation
     * @param $ Instance Cheerio
     */
    debugPageStructure($) {
        console.log('🔍 Debug de la structure de la page SensCritique:');
        // Chercher des éléments qui pourraient contenir des avis
        const potentialSelectors = [
            'div[class*="review"]',
            'div[class*="critique"]',
            'div[class*="avis"]',
            'div[class*="elco"]',
            'article',
            '.item',
            '[data-testid]'
        ];
        potentialSelectors.forEach(selector => {
            const elements = $(selector);
            if (elements.length > 0) {
                console.log(`  - ${selector}: ${elements.length} éléments`);
                // Afficher les classes des premiers éléments
                elements.slice(0, 3).each((i, el) => {
                    const classes = $(el).attr('class') || 'no-class';
                    const text = $(el).text().trim().substring(0, 100);
                    console.log(`    [${i}] classes: ${classes}, texte: "${text}..."`);
                });
            }
        });
    }
    /**
     * Vérifie si un utilisateur SensCritique existe
     * @param username Nom d'utilisateur à vérifier
     * @returns true si l'utilisateur existe
     */
    async isValidUsername(username) {
        try {
            const url = `${this.baseUrl}/${username}`;
            console.log(`🔍 Vérification de l'utilisateur SensCritique: ${url}`);
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                validateStatus: function (status) {
                    return status < 500;
                }
            });
            const isValid = response.status === 200;
            console.log(`${isValid ? '✅' : '❌'} Utilisateur SensCritique '${username}': ${isValid ? 'trouvé' : 'introuvable'}`);
            return isValid;
        }
        catch (error) {
            console.error(`Erreur lors de la validation de l'utilisateur SensCritique ${username}:`, error);
            return false;
        }
    }
    /**
     * Extrait les données d'une critique depuis la page principale SensCritique
     * @param htmlContent Contenu HTML de la page principale
     * @returns Objet contenant le titre, la note et l'URL de la critique
     */
    static extractReviewData(htmlContent) {
        try {
            const $ = cheerio.load(htmlContent);
            // Extraction du titre du film/série
            const titleElement = $('[data-testid="productReviewTitle"]').first();
            const title = titleElement.text().trim();
            if (!title) {
                console.log('Titre non trouvé');
                return null;
            }
            // Extraction de la note
            const ratingElement = $('[data-testid="Rating"]').first();
            const ratingText = ratingElement.text().trim();
            const rating = parseInt(ratingText);
            if (isNaN(rating)) {
                console.log('Note non trouvée ou invalide:', ratingText);
                return null;
            }
            // Extraction du lien vers la critique complète
            const reviewLinkElement = $('.sc-9c2f7502-8.djqroE a[data-testid="link"]').first();
            const reviewUrl = reviewLinkElement.attr('href') || '';
            if (!reviewUrl) {
                console.log('Lien de critique non trouvé');
                return null;
            }
            return {
                title,
                rating,
                reviewUrl
            };
        }
        catch (error) {
            console.error('Erreur lors de l\'extraction des données:', error);
            return null;
        }
    }
    /**
     * Extrait le contenu complet de la critique depuis la page de contenu
     * @param htmlContent Contenu HTML de la page de critique complète
     * @returns Texte de la critique complète
     */
    static extractFullReviewContent(htmlContent) {
        try {
            const $ = cheerio.load(htmlContent);
            // Extraction du contenu de la critique
            const reviewContentElement = $('[data-testid="review-content"]').first();
            const fullContent = reviewContentElement.text().trim();
            if (!fullContent) {
                console.log('Contenu de critique non trouvé');
                return null;
            }
            return fullContent;
        }
        catch (error) {
            console.error(`❌ Erreur lors de la récupération du contenu complet:`, error);
            return null;
        }
    }
}
