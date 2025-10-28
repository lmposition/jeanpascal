import https from 'https';
import * as cheerio from 'cheerio';
import { parseStringPromise } from 'xml2js';
import { LetterboxdReview } from '../types/index.js';
import { TMDBService } from './tmdbService.js';

export class LetterboxdService {
  private baseUrl = 'https://letterboxd.com';
  private tmdbService: TMDBService;

  constructor(tmdbApiKey: string) {
    this.tmdbService = new TMDBService(tmdbApiKey);
  }

  /**
   * Récupère le flux RSS d'un utilisateur Letterboxd
   */
  private async fetchRSS(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve(data);
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Récupère les avis d'un utilisateur depuis le flux RSS
   */
  async getUserReviews(username: string, onlyLatest: boolean = false): Promise<LetterboxdReview[]> {
    try {
      const rssUrl = `${this.baseUrl}/${username}/rss/`;
      console.log(`🔍 Récupération du flux RSS Letterboxd: ${rssUrl}${onlyLatest ? ' (latest only)' : ''}`);

      // Récupération du flux RSS
      const xmlData = await this.fetchRSS(rssUrl);
      
      // Parsing du XML
      const result = await parseStringPromise(xmlData, {
        explicitArray: false,
        mergeAttrs: true
      });

      const channel = result.rss?.channel;
      if (!channel) {
        console.log('❌ Pas de channel trouvé dans le flux RSS');
        return [];
      }

      // Récupérer les items
      let items = channel.item;
      if (!items) {
        console.log('📭 Aucun item trouvé dans le flux RSS');
        return [];
      }

      // S'assurer que items est un tableau
      if (!Array.isArray(items)) {
        items = [items];
      }

      // Limiter au premier item si onlyLatest
      if (onlyLatest && items.length > 0) {
        items = [items[0]];
      }

      console.log(`📝 ${items.length} item(s) trouvé(s) dans le flux RSS`);

      const reviews: LetterboxdReview[] = [];

      for (const item of items) {
        try {
          // Extraire le GUID pour identifier le type (watch vs review)
          const guid = item.guid?._ || item.guid || '';
          const isReview = guid.includes('letterboxd-review-');
          const isWatch = guid.includes('letterboxd-watch-');

          // On traite seulement les reviews et les watches avec note
          if (!isReview && !isWatch) continue;

          // Extraire les informations de base
          const filmTitle = item['letterboxd:filmTitle'] || '';
          const filmYear = item['letterboxd:filmYear'] || '';
          const memberRating = item['letterboxd:memberRating'];
          const watchedDate = item['letterboxd:watchedDate'] || '';
          const link = item.link || '';
          const tmdbId = item['tmdb:movieId'] || '';

          // Parser la description HTML pour extraire l'image et le contenu
          const description = item.description || '';
          const { posterUrl, reviewText } = this.parseDescription(description);

          // Construire le titre complet
          const fullTitle = filmYear ? `${filmTitle} (${filmYear})` : filmTitle;

          // Convertir la note
          const rating = memberRating ? parseFloat(memberRating) : undefined;

          // Si c'est juste un watch sans texte et sans note, on skip
          if (isWatch && !reviewText && !rating) {
            continue;
          }

          const review: LetterboxdReview = {
            title: fullTitle,
            year: filmYear,
            rating,
            reviewText: reviewText || '',
            reviewDate: this.formatDate(watchedDate || item.pubDate),
            coverImage: posterUrl,
            movieUrl: link,
            reviewUrl: link
          };

          reviews.push(review);

        } catch (error) {
          console.error('❌ Erreur lors du parsing d\'un item RSS:', error);
        }
      }

      console.log(`✅ ${reviews.length} review(s) extraite(s) du flux RSS`);

      // Enrichir avec TMDB si l'image n'est pas présente
      const enrichedReviews = await this.enrichReviewsWithTMDB(reviews, onlyLatest);
      return enrichedReviews;

    } catch (error) {
      console.error('❌ Erreur lors de la récupération du flux RSS Letterboxd:', error);
      return [];
    }
  }

  /**
   * Valide qu'un utilisateur existe en testant son flux RSS
   */
  async isValidUsername(username: string): Promise<boolean> {
    try {
      const rssUrl = `${this.baseUrl}/${username}/rss/`;
      console.log(`🔍 Validation du flux RSS: ${rssUrl}`);
      
      const xmlData = await this.fetchRSS(rssUrl);
      const result = await parseStringPromise(xmlData, {
        explicitArray: false,
        mergeAttrs: true
      });
      
      // Si on a un channel, l'utilisateur existe
      return !!result.rss?.channel;
    } catch (error) {
      console.error(`❌ Erreur lors de la validation de l'utilisateur Letterboxd ${username}:`, error);
      return false;
    }
  }

  /**
   * Parse la description HTML pour extraire l'URL du poster et le texte de la review
   */
  private parseDescription(description: string): { posterUrl: string; reviewText: string } {
    try {
      const $ = cheerio.load(description);
      
      // Extraire l'URL de l'image du poster
      const posterUrl = $('img').first().attr('src') || '';
      
      // Extraire le texte de la review
      // Supprimer les balises <img> et <em>This review may contain spoilers.</em>
      $('img').remove();
      $('em:contains("This review may contain spoilers")').remove();
      $('p:contains("Watched on")').remove();
      
      // Récupérer le texte restant
      const reviewText = $.text().trim();
      
      return { posterUrl, reviewText };
    } catch (error) {
      console.error('❌ Erreur lors du parsing de la description:', error);
      return { posterUrl: '', reviewText: '' };
    }
  }

  private formatDate(dateString: string): string {
    try {
      // Si c'est déjà un format ISO, on le retourne
      if (dateString.includes('T') || dateString.includes('-')) {
        return new Date(dateString).toISOString();
      }
      
      // Sinon, on essaie de parser différents formats
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    } catch (error) {
      return new Date().toISOString();
    }
  }


  // Méthode pour extraire l'année du titre si elle est incluse
  extractYearFromTitle(title: string): { title: string; year?: string } {
    const match = title.match(/^(.+?)\s*\((\d{4})\)$/);
    if (match) {
      return {
        title: match[1].trim(),
        year: match[2]
      };
    }
    return { title };
  }

  // Méthode pour parser les notes Letterboxd (★★★½ → 3.5)
  parseLetterboxdRating(ratingText: string): number | undefined {
    if (!ratingText) return undefined;
    
    // Compter les étoiles pleines (★)
    const fullStars = (ratingText.match(/★/g) || []).length;
    
    // Compter les demi-étoiles (½)
    const halfStars = (ratingText.match(/½/g) || []).length * 0.5;
    
    const totalRating = fullStars + halfStars;
    
    return totalRating > 0 ? totalRating : undefined;
  }

  // Méthode pour formater une note en étoiles emoji
  formatRatingAsEmoji(rating: number): string {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    let stars = '⭐'.repeat(fullStars);
    if (hasHalfStar) {
      stars += '✨'; // Demi-étoile
    }
    
    return `${stars} (${rating}/5)`;
  }

  /**
   * Enrichit les avis avec les images TMDB si nécessaire
   */
  private async enrichReviewsWithTMDB(reviews: LetterboxdReview[], onlyLatest: boolean = false): Promise<LetterboxdReview[]> {
    const enrichedReviews: LetterboxdReview[] = [];
    
    for (const review of reviews) {
      try {
        // Si on a déjà une image du flux RSS, on la garde
        if (review.coverImage) {
          enrichedReviews.push(review);
          continue;
        }

        // Sinon, récupérer l'image via TMDB
        console.log(`🎬 Enrichissement TMDB pour: "${review.title}"`);
        const coverImage = await this.tmdbService.getMovieImage(review.title);
        
        enrichedReviews.push({
          ...review,
          coverImage: coverImage || ''
        });
        
        // Délai pour éviter le rate limiting TMDB
        const delay = onlyLatest ? 100 : 250;
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        console.error(`❌ Erreur lors de l'enrichissement pour "${review.title}":`, error);
        enrichedReviews.push({
          ...review,
          coverImage: ''
        });
      }
    }
    
    return enrichedReviews;
  }
}
