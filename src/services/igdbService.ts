import axios from 'axios';
import * as logger from '../utils/logger.js';

export interface IGDBGame {
  id: number;
  name: string;
  releaseDate?: Date;
  coverUrl?: string;
  screenshotUrl?: string;
  screenshotUrls?: string[];
  summary?: string;
}

export class IGDBService {
  private clientId: string;
  private accessToken: string;
  private baseUrl = 'https://api.igdb.com/v4';

  constructor(clientId: string, accessToken: string) {
    this.clientId = clientId;
    this.accessToken = accessToken;
  }

  private async makeRequest(endpoint: string, body: string): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/${endpoint}`, body, {
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'text/plain'
        }
      });
      return response.data;
    } catch (error: any) {
      logger.error(`IGDB API error for ${endpoint}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async getGameById(gameId: number, includeDetails: boolean = false): Promise<IGDBGame | null> {
    try {
      let fields = 'name, first_release_date';
      if (includeDetails) {
        fields += ', cover.url, screenshots.url, summary';
      }
      
      const body = `fields ${fields}; where id = ${gameId};`;
      const data = await this.makeRequest('games', body);
      
      if (!data || data.length === 0) {
        logger.error(`Game not found with ID: ${gameId}`);
        return null;
      }

      const game = data[0];
      
      // Récupérer tous les screenshots si disponibles
      let screenshotUrl: string | undefined;
      let screenshotUrls: string[] = [];
      if (game.screenshots && game.screenshots.length > 0) {
        screenshotUrls = game.screenshots.map((screenshot: any) => 
          `https:${screenshot.url.replace('t_thumb', 't_screenshot_big')}`
        );
        screenshotUrl = screenshotUrls[0];
      }
      
      return {
        id: game.id,
        name: game.name,
        releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000) : undefined,
        coverUrl: game.cover?.url ? `https:${game.cover.url.replace('t_thumb', 't_cover_big')}` : undefined,
        screenshotUrl: screenshotUrl,
        screenshotUrls: screenshotUrls,
        summary: game.summary
      };
    } catch (error) {
      logger.error(`Error fetching game ${gameId}:`, error);
      return null;
    }
  }

  async getGameBySlug(slug: string, includeDetails: boolean = false): Promise<IGDBGame | null> {
    try {
      let fields = 'name, first_release_date';
      if (includeDetails) {
        fields += ', cover.url, screenshots.url, summary';
      }
      
      const body = `fields ${fields}; where slug = "${slug}";`;
      const data = await this.makeRequest('games', body);
      
      if (!data || data.length === 0) {
        logger.error(`Game not found with slug: ${slug}`);
        return null;
      }

      const game = data[0];
      
      // Récupérer tous les screenshots si disponibles
      let screenshotUrl: string | undefined;
      let screenshotUrls: string[] = [];
      if (game.screenshots && game.screenshots.length > 0) {
        screenshotUrls = game.screenshots.map((screenshot: any) => 
          `https:${screenshot.url.replace('t_thumb', 't_screenshot_big')}`
        );
        screenshotUrl = screenshotUrls[0];
      }
      
      return {
        id: game.id,
        name: game.name,
        releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000) : undefined,
        coverUrl: game.cover?.url ? `https:${game.cover.url.replace('t_thumb', 't_cover_big')}` : undefined,
        screenshotUrl: screenshotUrl,
        screenshotUrls: screenshotUrls,
        summary: game.summary
      };
    } catch (error) {
      logger.error(`Error fetching game ${slug}:`, error);
      return null;
    }
  }

  async searchGame(query: string): Promise<IGDBGame[]> {
    try {
      const body = `search "${query}"; fields name, first_release_date; limit 10;`;
      const data = await this.makeRequest('games', body);
      
      if (!data || data.length === 0) {
        return [];
      }

      return data.map((game: any) => ({
        id: game.id,
        name: game.name,
        releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000) : undefined
      }));
    } catch (error) {
      logger.error(`Error searching game "${query}":`, error);
      return [];
    }
  }

  extractSlugFromUrl(url: string): string | null {
    const match = url.match(/igdb\.com\/games\/([^\/\?]+)/);
    return match ? match[1] : null;
  }
}
