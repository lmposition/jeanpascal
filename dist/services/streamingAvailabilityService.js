import axios from 'axios';
import * as logger from '../utils/logger.js';
export class StreamingAvailabilityService {
    apiKey;
    baseUrl = 'https://streaming-availability.p.rapidapi.com';
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async searchByTitle(title, country = 'fr') {
        try {
            logger.log(`🔍 Recherche de "${title}" sur Streaming Availability (${country.toUpperCase()})...`);
            // Recherche de films ET séries en une seule requête
            const response = await axios.get(`${this.baseUrl}/shows/search/title`, {
                params: {
                    title: title,
                    country: country,
                    series_granularity: 'show',
                    output_language: 'fr'
                    // show_type non spécifié = recherche films + séries
                },
                headers: {
                    'x-rapidapi-host': 'streaming-availability.p.rapidapi.com',
                    'x-rapidapi-key': this.apiKey
                }
            });
            const allResults = response.data || [];
            if (allResults.length === 0) {
                logger.log(`❌ Aucun résultat trouvé pour "${title}"`);
                return null;
            }
            // Prendre le premier résultat (le plus pertinent)
            const show = allResults[0];
            const streamingOptions = show.streamingOptions[country] || [];
            logger.log(`📊 ${streamingOptions.length} options de streaming trouvées pour "${show.title}"`);
            // Grouper par service pour éviter les doublons de qualité
            // On garde la meilleure option par service (priorité: subscription > free > rent > buy)
            const serviceMap = new Map();
            for (const option of streamingOptions) {
                const serviceId = option.service.id;
                const existing = serviceMap.get(serviceId);
                // Priorité des types
                const typePriority = {
                    'subscription': 1,
                    'free': 2,
                    'addon': 3,
                    'rent': 4,
                    'buy': 5
                };
                if (!existing || (typePriority[option.type] || 99) < (typePriority[existing.type] || 99)) {
                    serviceMap.set(serviceId, option);
                    logger.log(`  ✓ ${option.service.name} - ${option.type}${option.price ? ' (' + option.price.formatted + ')' : ''}`);
                }
            }
            const result = {
                title: show.title,
                originalTitle: show.originalTitle,
                type: show.showType,
                year: show.releaseYear || show.firstAirYear || 0,
                overview: show.overview,
                posterUrl: show.imageSet.verticalPoster.w480,
                rating: show.rating,
                genres: show.genres.map(g => g.name),
                cast: show.cast.slice(0, 5),
                directors: show.directors,
                creators: show.creators,
                streamingOptions: Array.from(serviceMap.values()).map(opt => ({
                    service: opt.service.name,
                    type: opt.type,
                    link: opt.link,
                    price: opt.price?.formatted,
                    logoUrl: opt.service.imageSet.lightThemeImage
                }))
            };
            logger.log(`✅ Trouvé: ${result.title} (${result.type}) - ${result.streamingOptions.length} options de streaming`);
            return result;
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                logger.error(`❌ Erreur API Streaming Availability: ${error.response?.status} - ${error.response?.statusText}`);
                if (error.response?.data) {
                    logger.error('Détails:', error.response.data);
                }
            }
            else {
                logger.error('❌ Erreur lors de la recherche:', error);
            }
            return null;
        }
    }
}
