import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, TextChannel } from 'discord.js';
import dotenv from 'dotenv';
import { ReviewDatabase } from './database/database.js';
import { GamesDatabase } from './database/gamesDatabase.js';
import { SteamService } from './services/steamService.js';
import { LetterboxdService } from './services/letterboxdService.js';
import { ReviewMonitor } from './services/reviewMonitor.js';
import { IGDBService } from './services/igdbService.js';
import { GameCountdownService } from './services/gameCountdownService.js';
import { AddCommand } from './commands/addCommand.js';
import { LastReviewCommand } from './commands/lastReviewCommand.js';
import { SensCritiqueService } from './services/senscritiqueService.js';
import { MigrateCommand } from './commands/migrateCommand.js';
import { SeedCommand } from './commands/seedCommand.js';
import * as followCommand from './commands/followCommand.js';
import * as gamesCommand from './commands/gamesCommand.js';
import { TMDBService } from './services/tmdbService.js';
import { TranslationService } from './services/translationService.js';
import { StreamingMonitor } from './services/streamingMonitor.js';
import { Config } from './types/index.js';
import * as logger from './utils/logger.js';

// Charger les variables d'environnement
dotenv.config();

class ReviewBot {
  private client: Client;
  private db: ReviewDatabase;
  private gamesDb: GamesDatabase;
  private steamService: SteamService;
  private letterboxdService: LetterboxdService;
  private igdbService: IGDBService;
  private reviewMonitor: ReviewMonitor;
  private gameCountdownService: GameCountdownService;
  private streamingMonitor: StreamingMonitor;
  private addCommand: AddCommand;
  private lastReviewCommand: LastReviewCommand;
  private migrateCommand: MigrateCommand;
  private seedCommand: SeedCommand;
  private config: Config;

  constructor() {
    // Vérifier les variables d'environnement
    if (!process.env.DISCORD_TOKEN || !process.env.STEAM_API_KEY || !process.env.TMDB_API_KEY || !process.env.TRANSLATION_API_KEY || !process.env.IGDB_CLIENT_ID || !process.env.IGDB_ACCESS_TOKEN || !process.env.RAPID_KEY) {
      throw new Error('Missing required environment variables: DISCORD_TOKEN, STEAM_API_KEY, TMDB_API_KEY, TRANSLATION_API_KEY, IGDB_CLIENT_ID, IGDB_ACCESS_TOKEN, RAPID_KEY');
    }

    this.config = {
      discordToken: process.env.DISCORD_TOKEN,
      steamApiKey: process.env.STEAM_API_KEY,
      tmdbApiKey: process.env.TMDB_API_KEY,
      translationApiKey: process.env.TRANSLATION_API_KEY,
      channelId: process.env.CHANNEL_ID || '1429538190905053326', // Canal par défaut
      countdownChannelId: process.env.COUNTDOWN_CHANNEL_ID || process.env.CHANNEL_ID || '1429538190905053326',
      rapidApiKey: process.env.RAPID_KEY
    };

    // Initialiser le client Discord
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers // Pour détecter les entrées/sorties
      ]
    });

    // Initialiser les services
    this.db = new ReviewDatabase();
    this.gamesDb = new GamesDatabase();
    this.steamService = new SteamService(this.config.steamApiKey);
    this.letterboxdService = new LetterboxdService(this.config.tmdbApiKey);
    this.igdbService = new IGDBService(process.env.IGDB_CLIENT_ID!, process.env.IGDB_ACCESS_TOKEN!);
    
    // Initialiser les commandes
    this.addCommand = new AddCommand(this.db, this.steamService, this.letterboxdService, new SensCritiqueService(this.config.tmdbApiKey));
    this.lastReviewCommand = new LastReviewCommand(this.db, this.steamService, this.letterboxdService, new SensCritiqueService(this.config.tmdbApiKey));
    this.migrateCommand = new MigrateCommand(this.db);
    this.seedCommand = new SeedCommand(this.db, this.steamService, this.letterboxdService, new SensCritiqueService(this.config.tmdbApiKey));
    
    // Initialiser le moniteur de reviews (sera démarré après la connexion)
    this.reviewMonitor = new ReviewMonitor(
      this.client,
      this.db,
      this.steamService,
      this.letterboxdService,
      new SensCritiqueService(this.config.tmdbApiKey),
      new TMDBService(this.config.tmdbApiKey),
      new TranslationService(this.config.translationApiKey),
      this.config.channelId
    );

    // Initialiser le service de countdown (sera démarré après la connexion)
    this.gameCountdownService = new GameCountdownService(
      this.client,
      this.gamesDb,
      this.igdbService,
      this.config.countdownChannelId
    );

    // Initialiser le moniteur de streaming
    this.streamingMonitor = new StreamingMonitor(
      this.client,
      this.config.rapidApiKey
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once('ready', async () => {
      logger.log(`✅ Bot connecté en tant que ${this.client.user?.tag}`);
      
      // Définir le statut du bot
      this.client.user?.setPresence({
        activities: [{
          name: 'Galagames',
          type: 3, // 3 = WATCHING
          url: 'https://www.twitch.tv/galadou_'
        }],
        status: 'online'
      });
      logger.log('👀 Statut défini: Watching Galagames');
      
      // Enregistrer les commandes slash
      await this.registerSlashCommands();
      
      // Démarrer le moniteur de reviews
      this.reviewMonitor.start();
      
      // Démarrer le service de countdown
      await this.gameCountdownService.start();
      
      // Démarrer le moniteur de streaming
      this.streamingMonitor.start();
      
      logger.log('🚀 Bot prêt à surveiller les avis !');
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      try {
        switch (interaction.commandName) {
          case 'add':
            await this.addCommand.execute(interaction);
            break;
          case 'lastreview':
            await this.lastReviewCommand.execute(interaction);
            break;
          case 'migrate':
            await this.migrateCommand.execute(interaction);
            break;
          case 'seed':
            await this.seedCommand.execute(interaction);
            break;
          case 'follow':
            await followCommand.execute(interaction, this.gamesDb, this.igdbService);
            break;
          case 'games':
            await gamesCommand.execute(interaction, this.gamesDb, this.igdbService);
            break;
          default:
            await interaction.reply({ content: 'Commande inconnue !', ephemeral: true });
        }
      } catch (error) {
        logger.error('Error handling interaction:', error);
        
        const errorMessage = 'Une erreur est survenue lors de l\'exécution de la commande.';
        
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: errorMessage });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }
    });

    this.client.on('error', (error) => {
      logger.error('Discord client error:', error);
    });

    // Événement: Membre rejoint le serveur
    this.client.on('guildMemberAdd', async (member) => {
      try {
        const logChannelId = '1334660853034651710';
        const logChannel = this.client.channels.cache.get(logChannelId) as TextChannel;
        
        if (!logChannel) {
          logger.error(`❌ Canal de logs ${logChannelId} introuvable`);
          return;
        }

        const embed = new EmbedBuilder()
          .setColor('#28a745') // Vert pour arrivée
          .setTitle('👋 Nouveau membre')
          .setDescription(`**${member.user.tag}** a rejoint le serveur !`)
          .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
          .addFields(
            { name: 'Utilisateur', value: `<@${member.user.id}>`, inline: true },
            { name: 'ID', value: member.user.id, inline: true },
            { name: 'Compte créé le', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: false }
          )
          .setTimestamp()
          .setFooter({ text: `Membre #${member.guild.memberCount}` });

        await logChannel.send({ embeds: [embed] });
        logger.log(`✅ ${member.user.tag} a rejoint le serveur`);
      } catch (error) {
        logger.error('❌ Erreur lors de l\'envoi du log d\'arrivée:', error);
      }
    });

    // Événement: Membre quitte le serveur
    this.client.on('guildMemberRemove', async (member) => {
      try {
        const logChannelId = '1334660853034651710';
        const logChannel = this.client.channels.cache.get(logChannelId) as TextChannel;
        
        if (!logChannel) {
          logger.error(`❌ Canal de logs ${logChannelId} introuvable`);
          return;
        }

        const embed = new EmbedBuilder()
          .setColor('#dc3545') // Rouge pour départ
          .setTitle('👋 Membre parti')
          .setDescription(`**${member.user.tag}** a quitté le serveur`)
          .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
          .addFields(
            { name: 'Utilisateur', value: member.user.tag, inline: true },
            { name: 'ID', value: member.user.id, inline: true },
            { name: 'A rejoint le', value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp! / 1000)}:R>` : 'Inconnu', inline: false }
          )
          .setTimestamp()
          .setFooter({ text: `Reste ${member.guild.memberCount} membres` });

        await logChannel.send({ embeds: [embed] });
        logger.log(`✅ ${member.user.tag} a quitté le serveur`);
      } catch (error) {
        logger.error('❌ Erreur lors de l\'envoi du log de départ:', error);
      }
    });

    // Gestion propre de l'arrêt
    process.on('SIGINT', () => {
      logger.log('\n🛑 Arrêt du bot...');
      this.shutdown();
    });

    process.on('SIGTERM', () => {
      logger.log('\n🛑 Arrêt du bot...');
      this.shutdown();
    });
  }

  private async registerSlashCommands(): Promise<void> {
    try {
      const commands = [
        this.addCommand.getSlashCommand().toJSON(),
        this.lastReviewCommand.getSlashCommand().toJSON(),
        this.migrateCommand.getSlashCommand().toJSON(),
        this.seedCommand.getSlashCommand().toJSON(),
        followCommand.data.toJSON(),
        gamesCommand.data.toJSON()
      ];

      const rest = new REST({ version: '10' }).setToken(this.config.discordToken);

      logger.log('🔄 Enregistrement des commandes slash...');

      // Enregistrer les commandes globalement
      await rest.put(
        Routes.applicationCommands(this.client.user!.id),
        { body: commands }
      );

      logger.log('✅ Commandes slash enregistrées avec succès !');
    } catch (error) {
      logger.error('❌ Erreur lors de l\'enregistrement des commandes:', error);
    }
  }

  public async start(): Promise<void> {
    try {
      logger.log('🤖 Démarrage du bot JeanPascal Review Monitor...');
      
      // Se connecter à Discord (les commandes seront enregistrées dans l'événement 'ready')
      await this.client.login(this.config.discordToken);
    } catch (error) {
      logger.error('Erreur lors du démarrage du bot:', error);
      process.exit(1);
    }
  }

  private shutdown(): void {
    logger.log('🔄 Fermeture des connexions...');
    
    this.reviewMonitor.stop();
    this.gameCountdownService.stop();
    this.streamingMonitor.stop();
    this.db.close();
    this.gamesDb.close();
    this.client.destroy();
    
    logger.log('✅ Bot arrêté proprement');
    process.exit(0);
  }
}

// Démarrer le bot
const bot = new ReviewBot();
bot.start().catch(console.error);
