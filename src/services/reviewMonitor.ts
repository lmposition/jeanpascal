import { Client, EmbedBuilder, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import * as cron from 'node-cron';
import { ReviewDatabase } from '../database/database.js';
import { SteamService } from './steamService.js';
import { LetterboxdService } from './letterboxdService.js';
import { SensCritiqueService } from './senscritiqueService.js';
import { TMDBService } from './tmdbService.js';
import { TranslationService } from './translationService.js';
import { Review, User } from '../types/index.js';

export class ReviewMonitor {
  private client: Client;
  private db: ReviewDatabase;
  private steamService: SteamService;
  private letterboxdService: LetterboxdService;
  private sensCritiqueService: SensCritiqueService;
  private tmdbService: TMDBService;
  private translationService: TranslationService;
  private channelId: string;
  private isRunning = false;

  constructor(
    client: Client,
    db: ReviewDatabase,
    steamService: SteamService,
    letterboxdService: LetterboxdService,
    sensCritiqueService: SensCritiqueService,
    tmdbService: TMDBService,
    translationService: TranslationService,
    channelId: string
  ) {
    this.client = client;
    this.db = db;
    this.steamService = steamService;
    this.letterboxdService = letterboxdService;
    this.sensCritiqueService = sensCritiqueService;
    this.tmdbService = tmdbService;
    this.translationService = translationService;
    this.channelId = channelId;
  }

  start(): void {
    console.log('Starting review monitor...');
    
    // Vérification toutes les 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      if (this.isRunning) {
        console.log('Monitor already running, skipping...');
        return;
      }
      
      this.isRunning = true;
      try {
        await this.checkForNewReviews();
      } catch (error) {
        console.error('Error in review monitor:', error);
      } finally {
        this.isRunning = false;
      }
    });

    console.log('Review monitor started (runs every 5 minutes)');
  }

  private async checkForNewReviews(): Promise<void> {
    console.log('Checking for new reviews...');
    
    const users = this.db.getAllUsers();
    console.log(`Found ${users.length} users to monitor`);

    for (const user of users) {
      try {
        await this.checkUserReviews(user);
        // Délai entre chaque utilisateur pour éviter le rate limiting
        await this.delay(2000);
      } catch (error) {
        console.error(`Error checking reviews for user ${user.platformUsername}:`, error);
      }
    }
  }

  private async checkUserReviews(user: User): Promise<void> {
    console.log(`Checking reviews for ${user.platformUsername} on ${user.platform}`);

    let newReviews: any[] = [];

    if (user.platform === 'steam') {
      // Pour Steam, on va surveiller les jeux récemment joués et chercher des avis
      // Cette implémentation est simplifiée car Steam n'a pas d'API directe pour les avis
      newReviews = await this.checkSteamReviews(user);
    } else if (user.platform === 'letterboxd') {
      newReviews = await this.checkLetterboxdReviews(user);
    } else if (user.platform === 'senscritique') {
      newReviews = await this.checkSensCritiqueReviews(user);
    }

    // Traiter les nouveaux avis
    for (const reviewData of newReviews) {
      const review = await this.saveReview(user, reviewData);
      if (review) {
        await this.sendReviewNotification(user, review);
        // Délai entre chaque notification
        await this.delay(1000);
      }
    }
  }

  private async checkSteamReviews(user: User): Promise<any[]> {
    try {
      // Récupérer uniquement le dernier avis pour optimiser
      const reviews = await this.steamService.getUserReviews(user.platformUserId, true);
      
      if (reviews.length === 0) {
        console.log(`No reviews found for ${user.platformUsername} on Steam`);
        return [];
      }

      // Récupérer le dernier avis en base de données
      const latestReviewInDb = this.db.getLatestReviewByUser(user.id);
      
      // Prendre le premier avis (le plus récent) de Steam
      const latestReview = reviews[0];
      
      // Vérifier si c'est un nouvel avis
      if (!latestReviewInDb || 
          latestReview.title !== latestReviewInDb.title || 
          new Date(latestReview.reviewDate).getTime() !== new Date(latestReviewInDb.reviewDate).getTime()) {
        
        console.log(`Found new Steam review for ${user.platformUsername}: "${latestReview.title}"`);
        
        // Traduire le contenu si nécessaire
        let translatedReview = { ...latestReview };
        if (latestReview.content) {
          try {
            const translationResult = await this.translationService.translateIfNeeded(latestReview.content);
            if (translationResult.wasTranslated) {
              console.log(`🔄 Avis Steam traduit de l'anglais vers le français`);
              translatedReview.content = translationResult.translatedText;
            }
          } catch (error) {
            console.error(`❌ Erreur lors de la traduction Steam:`, error);
          }
        }
        
        return [translatedReview];
      }
      
      return [];
    } catch (error) {
      console.error('Error checking Steam reviews:', error);
      return [];
    }
  }

  private async checkLetterboxdReviews(user: User): Promise<any[]> {
    try {
      // Récupérer uniquement le dernier avis pour optimiser
      const reviews = await this.letterboxdService.getUserReviews(user.platformUsername, true);
      
      if (reviews.length === 0) {
        console.log(`No reviews found for ${user.platformUsername} on Letterboxd`);
        return [];
      }

      // Récupérer le dernier avis en base de données
      const latestReviewInDb = this.db.getLatestReviewByUser(user.id);
      
      // Prendre le premier avis (le plus récent) de Letterboxd
      const latestReviewOnSite = reviews[0];
      
      // Créer une URL unique pour l'avis
      const reviewUrl = `${latestReviewOnSite.movieUrl}#review-${user.platformUsername}-${latestReviewOnSite.reviewDate}`;
      
      // Si pas d'avis en DB ou si le dernier avis du site est différent de celui en DB
      if (!latestReviewInDb || 
          latestReviewInDb.title !== latestReviewOnSite.title || 
          latestReviewInDb.reviewDate !== latestReviewOnSite.reviewDate) {
        
        console.log(`Found new Letterboxd review for ${user.platformUsername}: "${latestReviewOnSite.title}"`);
        
        // Traduire le contenu si nécessaire
        let translatedContent = latestReviewOnSite.reviewText || '';
        if (translatedContent) {
          try {
            const translationResult = await this.translationService.translateIfNeeded(translatedContent);
            if (translationResult.wasTranslated) {
              console.log(`🔄 Avis Letterboxd traduit de l'anglais vers le français`);
              translatedContent = translationResult.translatedText;
            }
          } catch (error) {
            console.error(`❌ Erreur lors de la traduction Letterboxd:`, error);
          }
        }
        
        return [{
          ...latestReviewOnSite,
          reviewText: translatedContent,
          reviewUrl
        }];
      }

      console.log(`No new reviews for ${user.platformUsername} on Letterboxd`);
      return [];
    } catch (error) {
      console.error('Error checking Letterboxd reviews:', error);
      return [];
    }
  }

  private async checkSensCritiqueReviews(user: User): Promise<any[]> {
    try {
      console.log(`🔍 Vérification des avis SensCritique pour ${user.platformUsername}...`);
      
      // Récupérer uniquement le dernier avis pour optimiser
      const reviews = await this.sensCritiqueService.getUserReviews(user.platformUsername, true);
      
      if (reviews.length === 0) {
        console.log(`❌ Aucun avis trouvé pour ${user.platformUsername} sur SensCritique`);
        return [];
      }

      // Récupérer le dernier avis en base de données
      const latestReviewInDb = this.db.getLatestReviewByUser(user.id);
      
      // Prendre le premier avis (le plus récent) de SensCritique
      const latestReviewOnSite = reviews[0];
      
      console.log(`📊 Dernier avis SensCritique trouvé: "${latestReviewOnSite.title}" (${latestReviewOnSite.rating}/10)`);
      console.log(`📝 Contenu récupéré: ${latestReviewOnSite.fullReviewContent ? latestReviewOnSite.fullReviewContent.substring(0, 100) + '...' : 'VIDE'}`);
      
      // Si pas d'avis en DB ou si le dernier avis du site est différent de celui en DB
      if (!latestReviewInDb || 
          latestReviewInDb.title !== latestReviewOnSite.title || 
          latestReviewInDb.rating !== latestReviewOnSite.rating) {
        
        console.log(`✅ Nouvel avis SensCritique trouvé pour ${user.platformUsername}: "${latestReviewOnSite.title}"`);
        
        // Utiliser le contenu complet ou un fallback informatif
        const reviewContent = latestReviewOnSite.fullReviewContent || 
                             latestReviewOnSite.content || 
                             `Avis SensCritique: ${latestReviewOnSite.rating}/10`;
        
        console.log(`📝 Contenu final utilisé: "${reviewContent.substring(0, 100)}..."`);
        
        // Enrichir avec TMDB pour l'image de couverture
        console.log(`🎬 Enrichissement TMDB pour: "${latestReviewOnSite.title}"`);
        let coverImage = latestReviewOnSite.coverImage || '';
        try {
          const tmdbImage = await this.tmdbService.getMovieImage(latestReviewOnSite.title);
          if (tmdbImage) {
            coverImage = tmdbImage;
            console.log(`✅ Image TMDB récupérée pour "${latestReviewOnSite.title}"`);
          }
        } catch (error) {
          console.error(`❌ Erreur enrichissement TMDB pour "${latestReviewOnSite.title}":`, error);
        }
        
        // Traduire le contenu si nécessaire
        let translatedContent = reviewContent;
        if (translatedContent) {
          try {
            const translationResult = await this.translationService.translateIfNeeded(translatedContent);
            if (translationResult.wasTranslated) {
              console.log(`🔄 Avis SensCritique traduit de l'anglais vers le français`);
              translatedContent = translationResult.translatedText;
            }
          } catch (error) {
            console.error(`❌ Erreur lors de la traduction SensCritique:`, error);
          }
        }
        
        // Adapter le format pour la base de données
        return [{
          title: latestReviewOnSite.title,
          content: translatedContent,
          rating: latestReviewOnSite.rating,
          reviewUrl: latestReviewOnSite.reviewUrl,
          reviewDate: latestReviewOnSite.reviewDate || new Date().toISOString(),
          coverImage: coverImage,
          movieUrl: latestReviewOnSite.reviewUrl
        }];
      }

      console.log(`ℹ️ Pas de nouvel avis pour ${user.platformUsername} sur SensCritique`);
      return [];
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification des avis SensCritique pour ${user.platformUsername}:`, error);
      return [];
    }
  }

  private async saveReview(user: User, reviewData: any): Promise<Review | null> {
    try {
      const review: Omit<Review, 'id' | 'createdAt'> = {
        userId: user.id,
        platform: user.platform,
        gameId: reviewData.appId?.toString(),
        movieId: reviewData.movieId,
        title: reviewData.title,
        content: reviewData.content || reviewData.reviewText || reviewData.review || '',
        rating: reviewData.rating,
        coverImage: reviewData.coverImage,
        reviewUrl: reviewData.reviewUrl,
        reviewDate: reviewData.reviewDate || new Date().toISOString(),
        gameUrl: reviewData.gameUrl
      };

      return this.db.addReview(review);
    } catch (error) {
      console.error('Error saving review:', error);
      return null;
    }
  }

  private async sendReviewNotification(user: User, review: Review): Promise<void> {
    try {
      const channel = this.client.channels.cache.get(this.channelId) as TextChannel;
      if (!channel) {
        console.error(`Channel ${this.channelId} not found`);
        return;
      }

      // Utiliser exactement la même présentation que /lastreview
      const embed = this.createReviewEmbed(user, review);
      const actionButtons = this.createActionButtons(user, review);
      
      await channel.send({ 
        embeds: [embed],
        components: [actionButtons]
      });
      
      console.log(`Sent notification for review: ${review.title} by ${user.platformUsername}`);
    } catch (error) {
      console.error('Error sending review notification:', error);
    }
  }

  private createReviewEmbed(user: User, review: Review): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTimestamp(new Date(review.reviewDate))
      .setColor(this.getReviewColor(user.platform, review.rating ?? null) as any)
      .setFooter({ 
        text: `${user.platform.charAt(0).toUpperCase() + user.platform.slice(1)} • ${user.platformUsername}`,
        iconURL: this.getPlatformIcon(user.platform)
      });

    // Ajouter l'image de couverture en thumbnail (haut à droite)
    if (review.coverImage) {
      embed.setThumbnail(review.coverImage);
    }

    // Titre sans emoji
    embed.setAuthor({ 
      name: `Nouvel avis de ${user.platformUsername}`,
      iconURL: this.getPlatformIcon(user.platform)
    });
    embed.setTitle(review.title);

    // Ligne de séparation avec note et date
    let headerInfo = '';
    
    if (user.platform === 'letterboxd' && review.rating !== null && review.rating !== undefined) {
      const ratingDisplay = this.formatLetterboxdRating(review.rating);
      headerInfo = `${ratingDisplay} • 📅 ${this.formatDate(review.reviewDate)}`;
    } else if (user.platform === 'steam') {
      if (review.rating !== null && review.rating !== undefined) {
        const recommendation = review.rating === 1 ? '👍' : '👎';
        headerInfo = `${recommendation} • 📅 ${this.formatDate(review.reviewDate)}`;
      } else {
        headerInfo = `📅 ${this.formatDate(review.reviewDate)}`;
      }
    } else if (user.platform === 'senscritique') {
      if (review.rating !== null && review.rating !== undefined) {
        const ratingDisplay = this.formatSensCritiqueRating(review.rating);
        headerInfo = `${ratingDisplay} • 📅 ${this.formatDate(review.reviewDate)}`;
      } else {
        headerInfo = `📅 ${this.formatDate(review.reviewDate)}`;
      }
    } else {
      headerInfo = `📅 ${this.formatDate(review.reviewDate)}`;
    }

    embed.setDescription(`${headerInfo}\n\n${this.getReviewContent(review)}`);

    return embed;
  }

  private getReviewContent(review: Review): string {
    // Utiliser reviewText (texte complet de Puppeteer) en priorité, sinon content
    const text = (review as any).reviewText || review.content;
    
    if (!text || text.trim() === '') {
      return '*Aucun commentaire écrit*';
    }

    let content = text.trim();
    
    // Limite Discord : 4096 caractères pour la description
    // Garder de la marge pour les blocs de code et formatage
    if (content.length > 3800) {
      content = content.substring(0, 3797) + '...';
    }

    // Mettre dans un bloc de code comme demandé
    return `\`\`\`\n${content}\n\`\`\``;
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  private createActionButtons(user: User, review: Review): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>();

    // Bouton "Voir l'avis"
    const reviewUrl = this.getValidReviewUrl(review, user);
    if (reviewUrl) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel('Voir l\'avis')
          .setStyle(ButtonStyle.Link)
          .setURL(reviewUrl)
          .setEmoji('📝')
      );
    }

    // Bouton "Voir la page du film/jeu"
    if (user.platform === 'letterboxd') {
      // Pour Letterboxd, utiliser TMDB
      row.addComponents(
        new ButtonBuilder()
          .setLabel('Voir le film')
          .setStyle(ButtonStyle.Link)
          .setURL(this.getTMDBUrl(review.title))
          .setEmoji('🎬')
      );
    } else if (user.platform === 'steam') {
      // Pour Steam, utiliser Steam Store
      const gameUrl = `https://store.steampowered.com/app/${review.gameId || ''}/`;
      row.addComponents(
        new ButtonBuilder()
          .setLabel('Voir le jeu')
          .setStyle(ButtonStyle.Link)
          .setURL(gameUrl)
          .setEmoji('🎮')
      );
    } else if (user.platform === 'senscritique') {
      // Pour SensCritique, utiliser TMDB pour les films
      row.addComponents(
        new ButtonBuilder()
          .setLabel('Voir le film')
          .setStyle(ButtonStyle.Link)
          .setURL(this.getTMDBUrl(review.title))
          .setEmoji('🎬')
      );
    }

    // Bouton "Trailer"
    row.addComponents(
      new ButtonBuilder()
        .setLabel('Trailer')
        .setStyle(ButtonStyle.Link)
        .setURL(this.getTrailerUrl(review.title, user.platform))
        .setEmoji('🎥')
    );

    return row;
  }

  private getValidReviewUrl(review: Review, user: User): string | null {
    // Si l'URL existe et est valide, l'utiliser
    if (review.reviewUrl && this.isValidUrl(review.reviewUrl)) {
      return review.reviewUrl;
    }

    // Sinon, construire une URL basée sur la plateforme
    if (user.platform === 'letterboxd') {
      // Construire l'URL Letterboxd basée sur le username
      return `https://letterboxd.com/${user.platformUsername}/films/reviews/`;
    } else if (user.platform === 'steam') {
      // Construire l'URL Steam basée sur le SteamID
      return `https://steamcommunity.com/profiles/${user.platformUserId}/reviews/`;
    } else if (user.platform === 'senscritique') {
      // Construire l'URL SensCritique basée sur le username
      return `https://www.senscritique.com/${user.platformUsername}`;
    }

    return null;
  }

  private isValidUrl(string: string): boolean {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  private getTMDBUrl(movieTitle: string): string {
    const searchTitle = movieTitle.replace(/\s*\(\d{4}\)$/, '').trim();
    const encodedTitle = encodeURIComponent(searchTitle);
    return `https://www.themoviedb.org/search?query=${encodedTitle}`;
  }

  private getTrailerUrl(title: string, platform: string): string {
    const searchTitle = title.replace(/\s*\(\d{4}\)$/, '').trim();
    const encodedTitle = encodeURIComponent(`${searchTitle} trailer`);
    return `https://www.youtube.com/results?search_query=${encodedTitle}`;
  }

  private formatLetterboxdRating(rating: number): string {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    let stars = '⭐'.repeat(fullStars);
    if (hasHalfStar) {
      stars += '✨'; // Demi-étoile
    }
    
    return `${stars} (${rating}/5)`;
  }

  private formatSensCritiqueRating(rating: number): string {
    // Convertir la note sur 10 en étoiles sur 5
    const starsRating = rating / 2;
    const fullStars = Math.floor(starsRating);
    const hasHalfStar = starsRating % 1 >= 0.5;
    
    let stars = '⭐'.repeat(fullStars);
    if (hasHalfStar) {
      stars += '✨'; // Demi-étoile
    }
    
    return `${stars} (${rating}/10)`;
  }

  private getReviewColor(platform: string, rating: number | null): string {
    if (rating === null || rating === undefined) {
      return '#6c757d'; // Gris neutre si pas de note
    }

    let normalizedRating: number;
    
    // Normaliser les notes selon la plateforme
    if (platform === 'letterboxd') {
      // Letterboxd: 0-5 étoiles
      normalizedRating = rating / 5;
    } else if (platform === 'senscritique') {
      // SensCritique: 0-10
      normalizedRating = rating / 10;
    } else if (platform === 'steam') {
      // Steam: 0 (négatif) ou 1 (positif)
      return rating === 1 ? '#28a745' : '#dc3545'; // Vert pour positif, rouge pour négatif
    } else {
      normalizedRating = 0.5; // Neutre par défaut
    }

    // Couleurs basées sur la note normalisée (0-1)
    if (normalizedRating >= 0.7) {
      return '#28a745'; // Vert pour les bonnes notes (≥70%)
    } else if (normalizedRating >= 0.5) {
      return '#ffc107'; // Jaune pour les notes moyennes (50-69%)
    } else {
      return '#dc3545'; // Rouge pour les mauvaises notes (<50%)
    }
  }

  private getPlatformIcon(platform: string): string | undefined {
    switch (platform) {
      case 'steam':
        return 'https://ogc-cdn.b-cdn.net/logos/favicon-2-4.png';
      case 'letterboxd':
        return 'https://ogc-cdn.b-cdn.net/logos/favicon-3.png';
      case 'senscritique':
        return 'https://ogc-cdn.b-cdn.net/logos/senscritique.png';
      default:
        return undefined; // Retourner undefined au lieu de chaîne vide
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop(): void {
    console.log('Review monitor stopped');
    // Note: node-cron ne fournit pas de méthode directe pour arrêter une tâche spécifique
    // Dans une implémentation plus avancée, on stockerait la référence de la tâche
  }
}
