import axios from 'axios';
import * as logger from '../utils/logger.js';

interface StreamingService {
  id: string;
  name: string;
  homePage: string;
  themeColorCode: string;
  imageSet: {
    lightThemeImage: string;
    darkThemeImage: string;
    whiteImage: string;
  };
}

interface StreamingOption {
  service: StreamingService;
  type: 'subscription' | 'rent' | 'buy' | 'addon' | 'free';
  link: string;
  quality?: string;
  price?: {
    amount: string;
    currency: string;
    formatted: string;
  };
}

interface Show {
  itemType: string;
  showType: 'movie' | 'series';
  id: string;
  imdbId: string;
  tmdbId: string;
  title: string;
  overview: string;
  releaseYear?: number;
  firstAirYear?: number;
  lastAirYear?: number;
  originalTitle: string;
  genres: Array<{ id: string; name: string }>;
  directors?: string[];
  creators?: string[];
  cast: string[];
  rating: number;
  seasonCount?: number;
  episodeCount?: number;
  imageSet: {
    verticalPoster: {
      w240: string;
      w360: string;
      w480: string;
      w600: string;
      w720: string;
    };
    horizontalPoster?: {
      w360: string;
      w480: string;
      w720: string;
      w1080: string;
      w1440: string;
    };
  };
  streamingOptions: {
    [country: string]: StreamingOption[];
  };
}

export interface StreamingResult {
  title: string;
  originalTitle: string;
  type: 'movie' | 'series';
  year: number;
  overview: string;
  posterUrl: string;
  rating: number;
  genres: string[];
  cast: string[];
  directors?: string[];
  creators?: string[];
  streamingOptions: {
    service: string;
    type: string;
    link: string;
    price?: string;
    logoUrl: string;
  }[];
}

export class StreamingAvailabilityService {
  private apiKey: string;
  private baseUrl = 'https://streaming-availability.p.rapidapi.com';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchByTitle(title: string, country: string = 'fr'): Promise<StreamingResult | null> {
    try {
      logger.log(`🔍 Recherche de "${title}" sur Streaming Availability (${country.toUpperCase()})...`);

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

      const movies: Show[] = movieResponse.data || [];
      const series: Show[] = seriesResponse.data || [];
      const allResults = [...movies, ...series];

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
      const serviceMap = new Map<string, StreamingOption>();
      
      for (const option of streamingOptions) {
        const serviceId = option.service.id;
        const existing = serviceMap.get(serviceId);
        
        // Priorité des types
        const typePriority: { [key: string]: number } = {
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

      const result: StreamingResult = {
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

    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(`❌ Erreur API Streaming Availability: ${error.response?.status} - ${error.response?.statusText}`);
        if (error.response?.data) {
          logger.error('Détails:', error.response.data);
        }
      } else {
        logger.error('❌ Erreur lors de la recherche:', error);
      }
      return null;
    }
  }
}
