import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { ReviewDatabase } from './database/database.js';
import { SteamService } from './services/steamService.js';
import { LetterboxdService } from './services/letterboxdService.js';
import { ReviewMonitor } from './services/reviewMonitor.js';
import { AddCommand } from './commands/addCommand.js';
import { LastReviewCommand } from './commands/lastReviewCommand.js';
import { SensCritiqueService } from './services/senscritiqueService.js';
import { MigrateCommand } from './commands/migrateCommand.js';
import { SeedCommand } from './commands/seedCommand.js';
import { TMDBService } from './services/tmdbService.js';
import { TranslationService } from './services/translationService.js';
import { Config } from './types/index.js';

// Charger les variables d'environnement
dotenv.config();

class ReviewBot {
  private client: Client;
  private db: ReviewDatabase;
  private steamService: SteamService;
  private letterboxdService: LetterboxdService;
  private reviewMonitor: ReviewMonitor;
  private addCommand: AddCommand;
  private lastReviewCommand: LastReviewCommand;
  private migrateCommand: MigrateCommand;
  private seedCommand: SeedCommand;
  private config: Config;

  constructor() {
    // Vérifier les variables d'environnement
    if (!process.env.DISCORD_TOKEN || !process.env.STEAM_API_KEY || !process.env.TMDB_API_KEY || !process.env.TRANSLATION_API_KEY) {
      throw new Error('Missing required environment variables: DISCORD_TOKEN, STEAM_API_KEY, TMDB_API_KEY, TRANSLATION_API_KEY');
    }

    this.config = {
      discordToken: process.env.DISCORD_TOKEN,
      steamApiKey: process.env.STEAM_API_KEY,
      tmdbApiKey: process.env.TMDB_API_KEY,
      translationApiKey: process.env.TRANSLATION_API_KEY,
      channelId: process.env.CHANNEL_ID || '1429538190905053326' // Canal par défaut
    };

    // Initialiser le client Discord
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    // Initialiser les services
    this.db = new ReviewDatabase();
    this.steamService = new SteamService(this.config.steamApiKey);
    this.letterboxdService = new LetterboxdService(this.config.tmdbApiKey);
    
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

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once('ready', async () => {
      console.log(`✅ Bot connecté en tant que ${this.client.user?.tag}`);
      
      // Définir le statut du bot
      this.client.user?.setPresence({
        activities: [{
          name: 'Galagames',
          type: 3, // 3 = WATCHING
          url: 'https://www.twitch.tv/galadou_'
        }],
        status: 'online'
      });
      console.log('👀 Statut défini: Watching Galagames');
      
      // Enregistrer les commandes slash
      await this.registerSlashCommands();
      
      // Démarrer le moniteur de reviews
      this.reviewMonitor.start();
      
      console.log('🚀 Bot prêt à surveiller les avis !');
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
          default:
            await interaction.reply({ content: 'Commande inconnue !', ephemeral: true });
        }
      } catch (error) {
        console.error('Error handling interaction:', error);
        
        const errorMessage = 'Une erreur est survenue lors de l\'exécution de la commande.';
        
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: errorMessage });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }
    });

    this.client.on('error', (error) => {
      console.error('Discord client error:', error);
    });

    // Gestion propre de l'arrêt
    process.on('SIGINT', () => {
      console.log('\n🛑 Arrêt du bot...');
      this.shutdown();
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Arrêt du bot...');
      this.shutdown();
    });
  }

  private async registerSlashCommands(): Promise<void> {
    try {
      const commands = [
        this.addCommand.getSlashCommand().toJSON(),
        this.lastReviewCommand.getSlashCommand().toJSON(),
        this.migrateCommand.getSlashCommand().toJSON(),
        this.seedCommand.getSlashCommand().toJSON()
      ];

      const rest = new REST({ version: '10' }).setToken(this.config.discordToken);

      console.log('🔄 Enregistrement des commandes slash...');

      // Enregistrer les commandes globalement
      await rest.put(
        Routes.applicationCommands(this.client.user!.id),
        { body: commands }
      );

      console.log('✅ Commandes slash enregistrées avec succès !');
    } catch (error) {
      console.error('❌ Erreur lors de l\'enregistrement des commandes:', error);
    }
  }

  public async start(): Promise<void> {
    try {
      console.log('🤖 Démarrage du bot JeanPascal Review Monitor...');
      
      // Se connecter à Discord (les commandes seront enregistrées dans l'événement 'ready')
      await this.client.login(this.config.discordToken);
    } catch (error) {
      console.error('Erreur lors du démarrage du bot:', error);
      process.exit(1);
    }
  }

  private shutdown(): void {
    console.log('🔄 Fermeture des connexions...');
    
    this.reviewMonitor.stop();
    this.db.close();
    this.client.destroy();
    
    console.log('✅ Bot arrêté proprement');
    process.exit(0);
  }
}

// Démarrer le bot
const bot = new ReviewBot();
bot.start().catch(console.error);
