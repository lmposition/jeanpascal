import axios from 'axios';

export interface TMDBMovie {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
}

export interface TMDBSearchResult {
  results: TMDBMovie[];
  total_results: number;
}

export class TMDBService {
  private apiKey: string;
  private baseUrl = 'https://api.themoviedb.org/3';
  private imageBaseUrl = 'https://image.tmdb.org/t/p';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchMovie(title: string, year?: string): Promise<TMDBMovie | null> {
    try {
      console.log(`🔍 Searching TMDB for: "${title}"${year ? ` (${year})` : ''}`);
      
      const params: any = {
        api_key: this.apiKey,
        query: title,
        language: 'fr-FR' // Français en priorité
      };

      // Ajouter l'année si disponible pour une recherche plus précise
      if (year) {
        params.year = year;
      }

      const response = await axios.get<TMDBSearchResult>(`${this.baseUrl}/search/movie`, {
        params
      });

      const results = response.data.results;
      
      if (results.length === 0) {
        console.log(`❌ No TMDB results for: "${title}"`);
        return null;
      }

      // Prendre le premier résultat (le plus pertinent)
      const movie = results[0];
      console.log(`✅ Found TMDB movie: "${movie.title}" (${movie.release_date?.split('-')[0]})`);
      
      return movie;
    } catch (error) {
      console.error('Error searching TMDB:', error);
      return null;
    }
  }

  getPosterUrl(posterPath: string | null, size: 'w154' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'): string | null {
    if (!posterPath) return null;
    return `${this.imageBaseUrl}/${size}${posterPath}`;
  }

  getBackdropUrl(backdropPath: string | null, size: 'w300' | 'w780' | 'w1280' | 'original' = 'w780'): string | null {
    if (!backdropPath) return null;
    return `${this.imageBaseUrl}/${size}${backdropPath}`;
  }

  // Méthode pour extraire l'année du titre s'il est au format "Titre (YYYY)"
  parseMovieTitle(fullTitle: string): { title: string; year?: string } {
    const match = fullTitle.match(/^(.+?)\s*\((\d{4})\)$/);
    if (match) {
      return {
        title: match[1].trim(),
        year: match[2]
      };
    }
    return { title: fullTitle.trim() };
  }

  // Méthode pour obtenir une image de film à partir du titre
  async getMovieImage(movieTitle: string): Promise<string | null> {
    const { title, year } = this.parseMovieTitle(movieTitle);
    const movie = await this.searchMovie(title, year);
    
    if (!movie) return null;
    
    // Préférer le poster, sinon le backdrop
    return this.getPosterUrl(movie.poster_path, 'w500') || 
           this.getBackdropUrl(movie.backdrop_path, 'w780');
  }
}
