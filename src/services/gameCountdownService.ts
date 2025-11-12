import { Client, TextChannel, EmbedBuilder, Message, MessageFlags, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, ThumbnailBuilder } from 'discord.js';
import { GamesDatabase, TrackedGame } from '../database/gamesDatabase.js';
import { IGDBService } from './igdbService.js';
import * as logger from '../utils/logger.js';

export class GameCountdownService {
  private client: Client;
  private gamesDb: GamesDatabase;
  private igdbService: IGDBService;
  private channelId: string;
  private messageId: string | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private currentScreenshotIndex: number = 0;
  private allScreenshots: string[] = [];
  private updateCounter: number = 0;
  private currentGameId: number = 0;
  private isPreReleaseMode: boolean = false;

  constructor(
    client: Client,
    gamesDb: GamesDatabase,
    igdbService: IGDBService,
    channelId: string
  ) {
    this.client = client;
    this.gamesDb = gamesDb;
    this.igdbService = igdbService;
    this.channelId = channelId;
  }

  private formatCountdown(releaseDate: Date): string {
    // Vérifier si c'est une date TBD (année 9999)
    if (releaseDate.getFullYear() >= 9999) {
      return 'TBD';
    }

    // Vérifier si c'est juste une année (30 ou 31 décembre = IGDB pattern)
    // IGDB retourne le 30 ou 31/12 de l'année quand c'est juste une année
    // Aucun jeu ne sort vraiment ces dates-là
    if (releaseDate.getMonth() === 11 && (releaseDate.getDate() === 30 || releaseDate.getDate() === 31)) {
      return `${releaseDate.getFullYear()}`;
    }

    const now = new Date();
    const diff = releaseDate.getTime() - now.getTime();

    if (diff <= 0) {
      return 'Disponible maintenant';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const parts = [];
    if (days > 0) parts.push(`${days}j`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    
    // Afficher les secondes uniquement si moins de 24h
    if (days === 0 && seconds > 0) {
      parts.push(`${seconds}s`);
    }

    return parts.join(' ');
  }

  private getRandomColor(): number {
    // Générer une couleur aléatoire en hexadécimal
    return Math.floor(Math.random() * 0xFFFFFF);
  }

  private formatCountdownWithEmojis(releaseDate: Date): string {
    const now = new Date();
    const diff = releaseDate.getTime() - now.getTime();

    if (diff <= 0) {
      return '🎉 **DISPONIBLE MAINTENANT** 🎉';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    // ASCII art pour les chiffres
    const asciiDigits: { [key: string]: string[] } = {
      '0': ['███', '█ █', '█ █', '█ █', '███'],
      '1': [' █ ', '██ ', ' █ ', ' █ ', '███'],
      '2': ['███', '  █', '███', '█  ', '███'],
      '3': ['███', '  █', '███', '  █', '███'],
      '4': ['█ █', '█ █', '███', '  █', '  █'],
      '5': ['███', '█  ', '███', '  █', '███'],
      '6': ['███', '█  ', '███', '█ █', '███'],
      '7': ['███', '  █', '  █', '  █', '  █'],
      '8': ['███', '█ █', '███', '█ █', '███'],
      '9': ['███', '█ █', '███', '  █', '███'],
      ':': [' ', '█', ' ', '█', ' ']
    };

    const createAsciiNumber = (num: number): string[] => {
      const str = num.toString().padStart(2, '0');
      const lines: string[] = ['', '', '', '', ''];
      
      for (let i = 0; i < str.length; i++) {
        const digit = str[i];
        const ascii = asciiDigits[digit];
        for (let line = 0; line < 5; line++) {
          lines[line] += ascii[line] + ' ';
        }
      }
      
      return lines;
    };

    const parts = [];
    
    if (hours > 0) {
      parts.push(`⏰ **${hours}** heure${hours > 1 ? 's' : ''}\n`);
    }

    // Créer l'affichage ASCII MM:SS
    const minutesAscii = createAsciiNumber(minutes);
    const colonAscii = asciiDigits[':'];
    const secondsAscii = createAsciiNumber(seconds);

    const asciiLines: string[] = [];
    for (let i = 0; i < 5; i++) {
      asciiLines.push(minutesAscii[i] + colonAscii[i] + ' ' + secondsAscii[i]);
    }

    parts.push('```\n' + asciiLines.join('\n') + '\n```');

    return parts.join('');
  }

  private async createPreReleaseEmbed(game: TrackedGame): Promise<EmbedBuilder> {
    const gameDetails = await this.igdbService.getGameById(game.igdbId, true);
    
    const embed = new EmbedBuilder()
      .setTitle(`🚨 ${game.name} 🚨`)
      .setColor(this.getRandomColor()) // Couleur aléatoire
      .setTimestamp();

    if (gameDetails) {
      // Cover en thumbnail
      if (gameDetails.coverUrl) {
        embed.setThumbnail(gameDetails.coverUrl);
      }

      // Charger tous les screenshots si le jeu a changé
      if (this.currentGameId !== game.igdbId) {
        this.currentGameId = game.igdbId;
        this.allScreenshots = gameDetails.screenshotUrls || [];
        this.currentScreenshotIndex = 0;
        logger.log(`🎬 Mode pré-sortie: Chargement de ${this.allScreenshots.length} screenshot(s) pour ${gameDetails.name}`);
      }

      // Changer de screenshot 1 coup sur 2 en mode pré-sortie
      if (this.updateCounter % 2 === 0 && this.allScreenshots.length > 0) {
        this.currentScreenshotIndex = (this.currentScreenshotIndex + 1) % this.allScreenshots.length;
      }
      
      if (this.allScreenshots.length > 0) {
        embed.setImage(this.allScreenshots[this.currentScreenshotIndex]);
      }
    }

    // Countdown avec emojis (sans titre)
    const countdown = this.formatCountdownWithEmojis(game.releaseDate);
    embed.addFields({
      name: '\u200B',
      value: countdown,
      inline: false
    });

    // Saut de ligne
    embed.addFields({
      name: '\u200B',
      value: '\u200B',
      inline: false
    });

    // Description du jeu
    if (gameDetails && gameDetails.summary) {
      const summary = gameDetails.summary.length > 1024 
        ? gameDetails.summary.substring(0, 1021) + '...'
        : gameDetails.summary;
      embed.addFields({
        name: '📖 Description',
        value: summary,
        inline: false
      });
    }

    // Saut de ligne après la description
    embed.addFields({
      name: '\u200B',
      value: '\u200B',
      inline: false
    });

    // Date de sortie
    embed.addFields({
      name: '📅 Date de sortie',
      value: game.releaseDate.toLocaleString('fr-FR', { 
        dateStyle: 'full', 
        timeStyle: 'short' 
      }),
      inline: false
    });

    this.updateCounter++;
    return embed;
  }

  private async createEmbed(games: TrackedGame[]): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder()
      .setTitle('Sorties de jeux à venir')
      .setColor(this.getRandomColor());

    if (games.length === 0) {
      embed.setDescription('Aucun jeu suivi pour le moment');
    } else {
      // Limiter à 9 jeux maximum
      const displayGames = games.slice(0, 9);
      
      // Récupérer les détails du PREMIER jeu (le prochain à sortir)
      const nextGame = displayGames[0];
      const gameDetails = await this.igdbService.getGameById(nextGame.igdbId, true);
      
      if (gameDetails) {
        // Cover en thumbnail
        if (gameDetails.coverUrl) {
          embed.setThumbnail(gameDetails.coverUrl);
        }
        
        // Charger tous les screenshots si le jeu a changé ou au premier appel
        if (this.currentGameId !== nextGame.igdbId) {
          this.currentGameId = nextGame.igdbId;
          this.allScreenshots = gameDetails.screenshotUrls || [];
          this.currentScreenshotIndex = 0;
          logger.log(`🎬 Chargement de ${this.allScreenshots.length} screenshot(s) pour ${gameDetails.name}`);
        }
        
        // Changer de screenshot à chaque sync
        if (this.allScreenshots.length > 0) {
          this.currentScreenshotIndex = (this.currentScreenshotIndex + 1) % this.allScreenshots.length;
        }
        
        // Afficher le screenshot actuel
        if (this.allScreenshots.length > 0) {
          embed.setImage(this.allScreenshots[this.currentScreenshotIndex]);
        }
      }

      // Ajouter chaque jeu comme un field (inline) - max 9 jeux
      displayGames.forEach(game => {
        const countdown = this.formatCountdown(game.releaseDate);
        embed.addFields({
          name: `**${game.name}**`,
          value: countdown,
          inline: true
        });
      });
      
      // Ajouter une note si plus de 9 jeux
      if (games.length > 9) {
        embed.setFooter({ text: `+${games.length - 9} autre(s) jeu(x) suivi(s)` });
      }
    }

    // Incrémenter le compteur de mises à jour
    this.updateCounter++;

    return embed;
  }

  private async createComponentsV2Message(games: TrackedGame[]): Promise<{ components: ContainerBuilder[], flags: typeof MessageFlags.IsComponentsV2 }> {
    const displayGames = games.slice(0, 9);
    
    const container = new ContainerBuilder()
      .setAccentColor(this.getRandomColor());
    
    if (displayGames.length === 0) {
      container.addTextDisplayComponents(
        textDisplay => textDisplay.setContent("# 🎮 Aucun jeu suivi\n\nUtilisez `/follow` pour ajouter des jeux à suivre !")
      );
      
      return {
        components: [container],
        flags: MessageFlags.IsComponentsV2
      };
    }

    // Header
    container.addTextDisplayComponents(
      textDisplay => textDisplay.setContent(`# 🎮 Compte à rebours des sorties\n*${displayGames.length} jeu(x) suivi(s)*`)
    );

    container.addSeparatorComponents(separator => separator);

    // Afficher les jeux en grille de 3 par ligne
    for (let i = 0; i < displayGames.length; i += 3) {
      const gameBatch = displayGames.slice(i, i + 3);
      let rowText = '';
      
      gameBatch.forEach((game, batchIndex) => {
        const globalIndex = i + batchIndex;
        const countdown = this.formatCountdown(game.releaseDate);
        const emoji = globalIndex === 0 ? '🔥' : '🎮';
        
        // Tronquer le nom si trop long
        const gameName = game.name.length > 20 ? game.name.substring(0, 17) + '...' : game.name;
        
        rowText += `${emoji} **${gameName}**\n⏰ \`${countdown}\``;
        
        // Ajouter un séparateur entre les colonnes (sauf pour le dernier)
        if (batchIndex < gameBatch.length - 1) {
          rowText += '\n\n';
        }
      });
      
      container.addTextDisplayComponents(
        textDisplay => textDisplay.setContent(rowText)
      );
      
      // Ajouter un separator entre les lignes (sauf pour la dernière)
      if (i + 3 < displayGames.length) {
        container.addSeparatorComponents(separator => separator);
      }
    }

    // Récupérer les détails du premier jeu pour les screenshots
    const nextGame = displayGames[0];
    const gameDetails = await this.igdbService.getGameById(nextGame.igdbId, true);

    // Media Gallery avec screenshots en bas
    if (gameDetails && gameDetails.screenshotUrls && gameDetails.screenshotUrls.length > 0) {
      container.addSeparatorComponents(separator => separator);
      
      const mediaGallery = new MediaGalleryBuilder();
      
      gameDetails.screenshotUrls.slice(0, 3).forEach((url: string) => {
        mediaGallery.addItems(item => item.setURL(url));
      });

      container.addMediaGalleryComponents(mediaGallery);
    }

    // Footer
    if (games.length > 9) {
      container.addSeparatorComponents(separator => separator);
      container.addTextDisplayComponents(
        textDisplay => textDisplay.setContent(`*+${games.length - 9} autre(s) jeu(x) suivi(s)*`)
      );
    }

    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2
    };
  }

  async start(): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(this.channelId) as TextChannel;
      
      if (!channel || !channel.isTextBased()) {
        logger.error('Canal invalide pour le countdown');
        return;
      }

      // Créer le message initial avec Components V2
      const games = this.gamesDb.getUpcomingGames();
      const messageData = await this.createComponentsV2Message(games);
      const message = await channel.send(messageData);
      this.messageId = message.id;

      logger.log(`Message de countdown créé: ${this.messageId}`);

      // Mettre à jour toutes les 5 secondes (ou 2 secondes en mode pré-sortie)
      this.updateInterval = setInterval(() => this.updateCountdown(), 5000);

      // Vérifier les sorties et mettre à jour les dates 2 fois par jour (toutes les 12h)
      this.checkInterval = setInterval(() => this.checkReleasesAndUpdate(), 12 * 60 * 60 * 1000);

      // Nettoyer les vieux messages de sortie toutes les heures
      this.cleanupInterval = setInterval(() => this.cleanupOldReleaseMessages(), 60 * 60 * 1000);

      // Première vérification immédiate
      await this.checkReleasesAndUpdate();

      logger.log('Service de countdown démarré');
    } catch (error) {
      logger.error('Erreur lors du démarrage du countdown:', error);
    }
  }

  private async updateCountdown(): Promise<void> {
    if (!this.messageId) return;

    try {
      const channel = await this.client.channels.fetch(this.channelId) as TextChannel;
      const message = await channel.messages.fetch(this.messageId);

      // Vérifier les sorties à chaque mise à jour
      await this.checkForReleasedGames();

      const games = this.gamesDb.getUpcomingGames();
      
      // Vérifier si un jeu sort dans moins d'1 heure
      const now = new Date();
      const oneHourFromNow = now.getTime() + (60 * 60 * 1000);
      const upcomingGame = games.find(game => {
        const releaseTime = game.releaseDate.getTime();
        return releaseTime > now.getTime() && releaseTime <= oneHourFromNow;
      });

      let messageData;
      
      if (upcomingGame) {
        // Mode pré-sortie: embed spécial avec un seul jeu
        const embed = await this.createPreReleaseEmbed(upcomingGame);
        messageData = { embeds: [embed] };
        
        // Passer en mode 2 secondes si pas déjà fait
        if (!this.isPreReleaseMode) {
          this.isPreReleaseMode = true;
          logger.log(`🚨 Mode pré-sortie activé pour ${upcomingGame.name} - Sync à 2 secondes`);
          
          // Changer l'intervalle à 2 secondes
          if (this.updateInterval) {
            clearInterval(this.updateInterval);
          }
          this.updateInterval = setInterval(() => this.updateCountdown(), 2000);
        }
      } else {
        // Mode normal: Components V2 avec tous les jeux
        messageData = await this.createComponentsV2Message(games);
        
        // Revenir en mode 5 secondes si on était en mode pré-sortie
        if (this.isPreReleaseMode) {
          this.isPreReleaseMode = false;
          logger.log('✅ Retour au mode normal - Sync à 5 secondes');
          
          // Changer l'intervalle à 5 secondes
          if (this.updateInterval) {
            clearInterval(this.updateInterval);
          }
          this.updateInterval = setInterval(() => this.updateCountdown(), 5000);
        }
      }

      await message.edit(messageData);
    } catch (error) {
      logger.error('Erreur lors de la mise à jour du countdown:', error);
    }
  }

  private async checkForReleasedGames(): Promise<void> {
    try {
      const allGames = this.gamesDb.getAllGames();
      const now = new Date();

      for (const game of allGames) {
        // Ignorer les jeux TBD (année 9999)
        if (game.releaseDate.getFullYear() >= 9999) {
          continue;
        }

        // Vérifier si le jeu est sorti
        if (game.releaseDate <= now) {
          await this.announceRelease(game);
          this.gamesDb.removeGame(game.igdbId);
          logger.log(`Jeu sorti et retiré: ${game.name}`);
        }
      }
    } catch (error) {
      logger.error('Erreur lors de la vérification des sorties:', error);
    }
  }

  private async checkReleasesAndUpdate(): Promise<void> {
    logger.log('Vérification des sorties de jeux...');

    try {
      const allGames = this.gamesDb.getAllGames();
      const now = new Date();

      for (const game of allGames) {
        // Ignorer les jeux TBD pour la vérification de sortie
        const isTBD = game.releaseDate.getFullYear() >= 9999;
        
        if (!isTBD && game.releaseDate <= now) {
          await this.announceRelease(game);
          this.gamesDb.removeGame(game.igdbId);
          logger.log(`Jeu sorti et retiré: ${game.name}`);
          continue;
        }

        if (!game.dateOverride) {
          const igdbGame = await this.igdbService.getGameById(game.igdbId);
          if (igdbGame) {
            const newReleaseDate = igdbGame.releaseDate || new Date('9999-12-31');
            const oldDate = game.releaseDate.getTime();
            const newDate = newReleaseDate.getTime();

            if (oldDate !== newDate) {
              const updated = this.gamesDb.updateReleaseDate(game.igdbId, newReleaseDate);
              
              if (updated) {
                const dateText = igdbGame.releaseDate 
                  ? igdbGame.releaseDate.toLocaleDateString('fr-FR')
                  : 'TBD';
                logger.log(`Date de sortie mise à jour pour ${game.name}: ${dateText}`);
              }
            }
          }
        } else {
          logger.log(`🔒 Date de sortie verrouillée pour ${game.name} (override actif)`);
        }
      }
    } catch (error) {
      logger.error('Erreur lors de la vérification des sorties:', error);
    }
  }

  private async announceRelease(game: TrackedGame): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(this.channelId) as TextChannel;
      
      // Récupérer les détails complets du jeu depuis IGDB
      const gameDetails = await this.igdbService.getGameById(game.igdbId, true);
      
      const embed = new EmbedBuilder()
        .setTitle(`🎉 ${game.name} est sorti !`)
        .setColor(0x57F287)
        .setImage('https://media.tenor.com/eorzo18pmJoAAAAM/cringe.gif');
      
      if (gameDetails) {
        if (gameDetails.coverUrl) {
          embed.setThumbnail(gameDetails.coverUrl);
        }
        
        if (gameDetails.summary) {
          // Limiter la description à 1024 caractères (limite Discord)
          const summary = gameDetails.summary.length > 1024 
            ? gameDetails.summary.substring(0, 1021) + '...'
            : gameDetails.summary;
          embed.setDescription(summary);
        }
      }
      
      const message = await channel.send({ embeds: [embed] });
      
      // Stocker le message pour le supprimer après 24h
      this.gamesDb.addReleaseMessage(game.igdbId, message.id);
      
      logger.log(`Annonce de sortie envoyée: ${game.name}`);
    } catch (error) {
      logger.error('Erreur lors de l\'annonce de sortie:', error);
    }
  }

  private async cleanupOldReleaseMessages(): Promise<void> {
    try {
      const oldMessages = this.gamesDb.getOldReleaseMessages(24);
      
      if (oldMessages.length === 0) return;
      
      logger.log(`Nettoyage de ${oldMessages.length} message(s) de sortie ancien(s)...`);
      
      const channel = await this.client.channels.fetch(this.channelId) as TextChannel;
      
      for (const msg of oldMessages) {
        try {
          const message = await channel.messages.fetch(msg.messageId);
          await message.delete();
          this.gamesDb.deleteReleaseMessage(msg.id);
          logger.log(`Message de sortie supprimé: ${msg.messageId}`);
        } catch (error) {
          // Message déjà supprimé ou introuvable
          this.gamesDb.deleteReleaseMessage(msg.id);
        }
      }
    } catch (error) {
      logger.error('Erreur lors du nettoyage des messages:', error);
    }
  }

  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    logger.log('Service de countdown arrêté');
  }
}
