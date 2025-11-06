import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { GamesDatabase } from '../database/gamesDatabase.js';
import { IGDBService } from '../services/igdbService.js';
import * as logger from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('follow')
  .setDescription('Ajouter un jeu à suivre pour les sorties')
  .addStringOption(option =>
    option
      .setName('igdb_id')
      .setDescription('ID IGDB du jeu ou URL IGDB')
      .setRequired(true)
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  gamesDb: GamesDatabase,
  igdbService: IGDBService
): Promise<void> {
  await interaction.deferReply();

  const input = interaction.options.getString('igdb_id', true);
  
  try {
    let game;
    
    // Vérifier si c'est une URL IGDB
    if (input.includes('igdb.com')) {
      const slug = igdbService.extractSlugFromUrl(input);
      if (!slug) {
        await interaction.editReply('URL IGDB invalide');
        return;
      }
      
      logger.log(`Recherche du jeu avec le slug: ${slug}`);
      game = await igdbService.getGameBySlug(slug);
    } 
    // Sinon, c'est un ID
    else {
      const gameId = parseInt(input);
      if (isNaN(gameId)) {
        await interaction.editReply('ID IGDB invalide. Utilisez un nombre ou une URL IGDB.');
        return;
      }
      
      logger.log(`Recherche du jeu avec l'ID: ${gameId}`);
      game = await igdbService.getGameById(gameId);
    }

    if (!game) {
      await interaction.editReply('Jeu introuvable sur IGDB');
      return;
    }

    // Si pas de date de sortie, utiliser une date TBD (31/12/9999)
    const releaseDate = game.releaseDate || new Date('9999-12-31');

    // Vérifier si le jeu est déjà suivi
    const existingGame = gamesDb.getGameByIgdbId(game.id);
    if (existingGame) {
      await interaction.editReply(`Le jeu "${game.name}" est déjà suivi`);
      return;
    }

    // Ajouter le jeu
    const addedGame = gamesDb.addGame(game.id, game.name, releaseDate);
    
    if (addedGame) {
      logger.log(`Jeu ajouté: ${game.name} (ID: ${game.id})`);
      
      const releaseDateText = game.releaseDate 
        ? `Sortie prévue: ${game.releaseDate.toLocaleDateString('fr-FR')}`
        : 'Date de sortie: TBD';
      
      await interaction.editReply(
        `Jeu ajouté: ${game.name}\n${releaseDateText}`
      );
    } else {
      await interaction.editReply('Erreur lors de l\'ajout du jeu');
    }
  } catch (error) {
    logger.error('Erreur dans /follow:', error);
    await interaction.editReply('Une erreur est survenue lors de l\'ajout du jeu');
  }
}
