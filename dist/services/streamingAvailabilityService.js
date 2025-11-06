import axios from 'axios';
import * as logger from '../utils/logger.js';
export class StreamingAvailabilityService {
    apiKey;
    baseUrl = 'https://streaming-availability.p.rapidapi.com';
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async searchByTitle(title, country = 'us') {
        try {
            logger.log(`🔍 Recherche de "${title}" sur Streaming Availability...`);
            // Recherche de films
            const movieResponse = await axios.get(`${this.baseUrl}/shows/search/title`, {
                params: {
                    title: title,
                    country: country,
                    series_granularity: 'show',
                    show_type: 'movie',
                    output_language: 'fr'
                },
                headers: {
                    'x-rapidapi-host': 'streaming-availability.p.rapidapi.com',
                    'x-rapidapi-key': this.apiKey
                }
            });
            // Recherche de séries
            const seriesResponse = await axios.get(`${this.baseUrl}/shows/search/title`, {
                params: {
                    title: title,
                    country: country,
                    series_granularity: 'show',
                    show_type: 'series',
                    output_language: 'fr'
                },
                headers: {
                    'x-rapidapi-host': 'streaming-availability.p.rapidapi.com',
                    'x-rapidapi-key': this.apiKey
                }
            });
            const movies = movieResponse.data || [];
            const series = seriesResponse.data || [];
            const allResults = [...movies, ...series];
            if (allResults.length === 0) {
                logger.log(`❌ Aucun résultat trouvé pour "${title}"`);
                return null;
            }
            // Prendre le premier résultat (le plus pertinent)
            const show = allResults[0];
            const streamingOptions = show.streamingOptions[country] || [];
            // Grouper par service et type pour éviter les doublons
            const uniqueOptions = new Map();
            for (const option of streamingOptions) {
                const key = `${option.service.id}-${option.type}`;
                if (!uniqueOptions.has(key)) {
                    uniqueOptions.set(key, option);
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
                streamingOptions: Array.from(uniqueOptions.values()).map(opt => ({
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
