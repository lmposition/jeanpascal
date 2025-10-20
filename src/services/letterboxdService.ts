import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { LetterboxdReview } from '../types/index.js';
import { TMDBService } from './tmdbService.js';

export class LetterboxdService {
  private baseUrl = 'https://letterboxd.com';
  private tmdbService: TMDBService;

  constructor(tmdbApiKey: string) {
    this.tmdbService = new TMDBService(tmdbApiKey);
  }

  async getUserReviews(username: string, onlyLatest: boolean = false): Promise<LetterboxdReview[]> {
    try {
      const url = `${this.baseUrl}/${username}/films/reviews/`;
      console.log(`Fetching Letterboxd reviews from: ${url}${onlyLatest ? ' (latest only)' : ''}`);

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        validateStatus: function (status) {
          return status < 500; // Accepter les codes 404 pour les gérer proprement
        }
      });

      // Gérer les erreurs 404 (utilisateur inexistant)
      if (response.status === 404) {
        console.log(`❌ Utilisateur Letterboxd '${username}' introuvable (404)`);
        return [];
      }

      const $ = cheerio.load(response.data);
      const reviews: LetterboxdReview[] = [];

      // Parcourir chaque avis sur la page (limiter au premier si onlyLatest)
      $('.listitem').each((index: number, element: any) => {
        if (onlyLatest && index > 0) return false; // Arrêter après le premier avis
        try {
          const $element = $(element);
          
          // L'image sera récupérée via TMDB plus tard avec le titre
          
          // Extraire le titre du film
          let title = '';
          
          // D'abord essayer avec data-item-name
          const dataItemName = $element.find('[data-item-name]').attr('data-item-name');
          if (dataItemName) {
            title = dataItemName.trim();
          }
          
          // Sinon, essayer les sélecteurs classiques
          if (!title) {
            const titleElement = $element.find('h2.name a, .frame-title');
            title = titleElement.text().trim();
          }
          
          // En dernier recours, essayer avec l'attribut alt de l'image
          if (!title) {
            const imgWithAlt = $element.find('img[alt]');
            if (imgWithAlt.length) {
              const altText = imgWithAlt.attr('alt') || '';
              if (altText && !altText.includes('empty-poster')) {
                title = altText.trim();
              }
            }
          }

          // Extraire l'URL de l'avis (pas du film)
          const reviewLink = $element.find('a.review-link, .review .date a, h2.name a').attr('href') || '';
          let reviewUrl = '';
          
          if (reviewLink) {
            // Si c'est un lien relatif, ajouter le domaine
            reviewUrl = reviewLink.startsWith('/') ? `${this.baseUrl}${reviewLink}` : reviewLink;
            
            // Si c'est un lien vers le film, construire l'URL de l'avis
            if (reviewLink.includes('/film/') && !reviewLink.includes('/reviews/')) {
              // Construire l'URL de l'avis à partir du lien du film
              const filmPath = reviewLink.replace('/film/', '');
              reviewUrl = `${this.baseUrl}/${username}/film/${filmPath}`;
            }
          }
          
          // URL du film pour référence
          const movieUrl = $element.find('h2.name a, .frame').attr('href') || '';
          const fullMovieUrl = movieUrl.startsWith('/') ? `${this.baseUrl}${movieUrl}` : movieUrl;

          // Extraire la note (étoiles)
          const ratingElement = $element.find('.rating');
          let rating: number | undefined;
          
          if (ratingElement.length) {
            const ratingText = ratingElement.text().trim();
            rating = this.parseLetterboxdRating(ratingText);
          }

          // Extraire la date
          const dateElement = $element.find('.date time, time.timestamp');
          const reviewDate = dateElement.attr('datetime') || dateElement.text().trim() || new Date().toISOString();

          // Extraire le texte de l'avis
          const reviewTextElement = $element.find('.body-text p, .js-review-body p');
          const reviewText = reviewTextElement.text().trim() || '';

          // Vérifier qu'on a au moins un titre et du contenu
          if (title && (reviewText || rating)) {
            const review = {
              title,
              rating,
              reviewText,
              reviewDate: this.formatDate(reviewDate),
              coverImage: '', // Sera rempli par TMDB
              movieUrl: fullMovieUrl,
              reviewUrl: reviewUrl // URL de l'avis spécifique
            };
            
            reviews.push(review);
          }
        } catch (error) {
          console.error('Error parsing review element:', error);
        }
      });

      console.log(`Found ${reviews.length} reviews for ${username}`);
      
      // Si onlyLatest et qu'on a un avis, récupérer le texte complet avec Puppeteer
      if (onlyLatest && reviews.length > 0) {
        // Utiliser l'URL de la page des avis de l'utilisateur
        const reviewsPageUrl = `${this.baseUrl}/${username}/films/reviews/`;
        const fullText = await this.getFullReviewTextFromReviewsPage(reviewsPageUrl);
        if (fullText) {
          reviews[0].reviewText = fullText;
          // Aussi mettre à jour le champ content pour la compatibilité
          (reviews[0] as any).content = fullText;
        }
      }
      
      // Enrichir les avis avec les images TMDB (optimisé pour onlyLatest)
      const enrichedReviews = await this.enrichReviewsWithTMDB(reviews, onlyLatest);
      return enrichedReviews;
    } catch (error) {
      console.error('Error fetching Letterboxd reviews:', error);
      return [];
    }
  }

  async isValidUsername(username: string): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/${username}/`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        validateStatus: function (status) {
          return status < 500; // Accepter les codes 404 pour les gérer proprement
        }
      });
      
      return response.status === 200;
    } catch (error) {
      console.error(`Error validating Letterboxd username ${username}:`, error);
      return false;
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

  // Méthode pour récupérer le texte complet du premier avis depuis la page des avis
  private async getFullReviewTextFromReviewsPage(reviewsPageUrl: string): Promise<string> {
    let browser;
    try {
      console.log(`🔍 Récupération du texte complet pour: ${reviewsPageUrl}`);
      
      browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Configurer le user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Aller à la page des avis
      await page.goto(reviewsPageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Chercher et cliquer sur le bouton "more" s'il existe
      const moreButton = await page.$('a.reveal[data-js-trigger="collapsible.expand"]');
      if (moreButton) {
        console.log('📖 Bouton "more" trouvé, expansion du texte...');
        await moreButton.click();
        
        // Attendre que le texte soit étendu
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Récupérer le texte complet du premier avis
      const reviewText = await page.evaluate(() => {
        // Essayer différents sélecteurs pour trouver le texte de l'avis
        const selectors = [
          '.listitem .body-text',
          '.review .body-text', 
          '.body-text',
          '.listitem .review-text',
          '.listitem p'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent && element.textContent.trim().length > 0) {
            // Supprimer les éléments "more" et autres liens
            const moreLinks = element.querySelectorAll('a.reveal');
            moreLinks.forEach(link => link.remove());
            
            return element.textContent.trim();
          }
        }
        return '';
      });
      
      console.log(`✅ Texte complet récupéré (${reviewText.length} caractères)`);
      return reviewText;
      
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du texte complet:', error);
      return '';
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // Méthode pour obtenir des informations détaillées sur un film
  async getMovieDetails(movieUrl: string): Promise<any> {
    try {
      const response = await axios.get(movieUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      return {
        title: $('h1.headline-1').text().trim(),
        year: $('.number').first().text().trim(),
        director: $('.director a').text().trim(),
        poster: $('img.image').attr('src') || ''
      };
    } catch (error) {
      console.error('Error fetching movie details:', error);
      return null;
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

  // Méthode pour enrichir les avis avec les images TMDB
  private async enrichReviewsWithTMDB(reviews: LetterboxdReview[], onlyLatest: boolean = false): Promise<LetterboxdReview[]> {
    const enrichedReviews: LetterboxdReview[] = [];
    
    for (const review of reviews) {
      try {
        // Récupérer l'image via TMDB
        console.log(`🎬 Enrichissement TMDB pour: "${review.title}"`);
        const coverImage = await this.tmdbService.getMovieImage(review.title);
        
        enrichedReviews.push({
          ...review,
          coverImage: coverImage || '' // Utiliser l'image TMDB ou chaîne vide
        });
        
        // Délai pour éviter le rate limiting TMDB (plus court si un seul avis)
        const delay = onlyLatest ? 100 : 250;
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        console.error(`Error enriching review for "${review.title}":`, error);
        // En cas d'erreur, garder l'avis sans image
        enrichedReviews.push({
          ...review,
          coverImage: ''
        });
      }
    }
    
    return enrichedReviews;
  }
}
