import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { ReviewDatabase } from '../database/database.js';
import { SteamService } from '../services/steamService.js';
import { LetterboxdService } from '../services/letterboxdService.js';
import { TMDBService } from '../services/tmdbService.js';
import { SensCritiqueService } from '../services/senscritiqueService.js';

export class LastReviewCommand {
  private db: ReviewDatabase;
  private steamService: SteamService;
  private letterboxdService: LetterboxdService;
  private tmdbService: TMDBService;
  private sensCritiqueService: SensCritiqueService;

  constructor(db: ReviewDatabase, steamService: SteamService, letterboxdService: LetterboxdService, sensCritiqueService: SensCritiqueService) {
    this.db = db;
    this.steamService = steamService;
    this.letterboxdService = letterboxdService;
    this.sensCritiqueService = sensCritiqueService;
    // Récupérer la clé TMDB depuis l'environnement
    this.tmdbService = new TMDBService(process.env.TMDB_API_KEY || '');
  }

  getSlashCommand() {
    return new SlashCommandBuilder()
      .setName('lastreview')
      .setDescription('Afficher le dernier avis d\'un utilisateur')
      .addStringOption(option =>
        option.setName('platform')
          .setDescription('Plateforme à consulter')
          .setRequired(true)
          .addChoices(
            { name: 'Steam', value: 'steam' },
            { name: 'Letterboxd', value: 'letterboxd' },
            { name: 'SensCritique', value: 'senscritique' }
          )
      )
      .addStringOption(option =>
        option.setName('username')
          .setDescription('Nom d\'utilisateur sur la plateforme (optionnel si vous êtes enregistré)')
          .setRequired(false)
      );
  }

  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    
    await interaction.deferReply();

    const platform = interaction.options.getString('platform') as 'steam' | 'letterboxd' | 'senscritique';
    const username = interaction.options.getString('username');
    const discordUserId = interaction.user.id;

    try {
      let targetUser;
      
      if (username) {
        // Chercher par nom d'utilisateur sur la plateforme
        targetUser = this.db.getUserByPlatformUsername(username, platform);
        
        if (!targetUser) {
          const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Utilisateur introuvable')
            .setDescription(`L'utilisateur **${username}** n'est pas enregistré sur ${platform}.`)
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
          return;
        }
      } else {
        // Chercher l'utilisateur Discord pour cette plateforme
        targetUser = this.db.getUserByDiscordAndPlatform(discordUserId, platform);
        
        if (!targetUser) {
          const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Compte non trouvé')
            .setDescription(`Vous n'avez pas de compte ${platform} enregistré. Utilisez \`/add ${platform} <username>\` pour vous enregistrer.`)
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
          return;
        }
      }

      // Récupérer le dernier avis de cet utilisateur
      const latestReviews = this.db.getReviewsByUser(targetUser.id);
      
      if (latestReviews.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('#ffd43b')
          .setTitle('📝 Aucun avis trouvé')
          .setDescription(`Aucun avis trouvé pour **${targetUser.platformUsername}** sur ${platform}.`)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const lastReview = latestReviews[0];
      
      // Enrichir avec TMDB si l'image est encore celle de Letterboxd
      const enrichedReview = await this.enrichReviewIfNeeded(lastReview, targetUser.platform);
      
      const embed = this.createReviewEmbed(targetUser, enrichedReview);
      const buttons = this.createActionButtons(targetUser, enrichedReview);
      
      await interaction.editReply({ embeds: [embed], components: [buttons] });

    } catch (error) {
      console.error('Error in lastreview command:', error);
      
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Erreur')
        .setDescription('Une erreur inattendue est survenue.')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }

  private createReviewEmbed(user: any, review: any): EmbedBuilder {
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
      name: `Dernier avis de ${user.platformUsername}`,
      iconURL: this.getPlatformIcon(user.platform)
    });
    embed.setTitle(review.title);

    // Ligne de séparation avec note et date
    const reviewDate = new Date(review.reviewDate);
    const formattedDate = reviewDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    let headerInfo = `📅 ${formattedDate}`;
    
    // Ajouter la note avec des étoiles emoji pour Letterboxd et pouces pour Steam
    if (review.rating !== null && review.rating !== undefined) {
      if (user.platform === 'letterboxd') {
        const ratingDisplay = this.formatLetterboxdRating(review.rating);
        headerInfo = `${ratingDisplay} • ${headerInfo}`;
      } else if (user.platform === 'steam') {
        const recommendation = review.rating === 1 ? '👍' : '👎';
        headerInfo = `${recommendation} • ${headerInfo}`;
      } else if (user.platform === 'senscritique') {
        const ratingDisplay = this.formatSensCritiqueRating(review.rating);
        headerInfo = `${ratingDisplay} • ${headerInfo}`;
      } else {
        headerInfo = `📊 ${review.rating}/10 • ${headerInfo}`;
      }
    }

    embed.setDescription(`${headerInfo}\n\n${this.getReviewContent(review)}`);

    return embed;
  }

  private getReviewContent(review: any): string {
    // Utiliser reviewText (texte complet de Puppeteer) en priorité, sinon content
    const text = review.reviewText || review.content;
    
    if (!text) {
      return '*Aucun commentaire écrit*';
    }

    let content = text.trim();
    
    // Limite Discord : 4096 caractères pour la description
    // Garder de la marge pour les guillemets et formatage
    if (content.length > 3800) {
      content = content.substring(0, 3797) + '...';
    }

    // Mettre dans un bloc de code comme demandé
    return `\`\`\`\n${content}\n\`\`\``;
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
        return 'https://cdn.discordapp.com/attachments/1334660853034651710/1429669709812334723/favicon-2-4.png?ex=68f6fb2c&is=68f5a9ac&hm=c3846308c1258ed6eba56d0d4298e83392eb27528161aae377afd72f156b8ff0&';
      case 'letterboxd':
        return 'https://cdn.discordapp.com/attachments/1334660853034651710/1429628362564964452/favicon-3.png?ex=68f6d4aa&is=68f5832a&hm=a387ba7ccf8d87c3ea5d15b789bbb6d370d12e0dcbed4244391fb73af3296061&';
      case 'senscritique':
        return 'https://www.senscritique.com/static/img/favicon-3.png';
      default:
        return undefined;
    }
  }

  private createActionButtons(user: any, review: any): ActionRowBuilder<ButtonBuilder> {
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
      if (review.gameUrl) {
        row.addComponents(
          new ButtonBuilder()
            .setLabel('Voir le jeu')
            .setStyle(ButtonStyle.Link)
            .setURL(review.gameUrl)
            .setEmoji('🎮')
        );
      }
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

  private getTMDBUrl(movieTitle: string): string {
    // Simplifier le titre pour la recherche TMDB
    const searchTitle = movieTitle.replace(/\s*\(\d{4}\)$/, '').trim();
    const encodedTitle = encodeURIComponent(searchTitle);
    return `https://www.themoviedb.org/search?query=${encodedTitle}`;
  }

  private getTrailerUrl(title: string, platform: string): string {
    const searchTitle = title.replace(/\s*\(\d{4}\)$/, '').trim();
    const encodedTitle = encodeURIComponent(`${searchTitle} trailer`);
    return `https://www.youtube.com/results?search_query=${encodedTitle}`;
  }

  private getValidReviewUrl(review: any, user: any): string | null {
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
      return `https://steamcommunity.com/profiles/${user.platformUsername}/reviews/`;
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

  private async enrichReviewIfNeeded(review: any, platform: string): Promise<any> {
    // Si ce n'est pas Letterboxd ou si l'image est déjà TMDB, ne rien faire
    if (platform !== 'letterboxd' || 
        !review.coverImage || 
        review.coverImage.includes('tmdb.org')) {
      return review;
    }

    // Si l'image est encore celle de Letterboxd (empty-poster ou ltrbxd.com), enrichir avec TMDB
    if (review.coverImage.includes('ltrbxd.com') || review.coverImage.includes('empty-poster')) {
      try {
        console.log(`🔄 Enrichissement TMDB pour: "${review.title}"`);
        const tmdbImage = await this.tmdbService.getMovieImage(review.title);
        
        if (tmdbImage) {
          console.log(`✅ Image TMDB trouvée: ${tmdbImage}`);
          return {
            ...review,
            coverImage: tmdbImage
          };
        } else {
          console.log(`❌ Aucune image TMDB trouvée pour: "${review.title}"`);
        }
      } catch (error) {
        console.error('Erreur enrichissement TMDB:', error);
      }
    }

    return review;
  }
}
