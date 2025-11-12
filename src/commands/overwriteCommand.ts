import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  AutocompleteInteraction 
} from 'discord.js';
import { GamesDatabase } from '../database/gamesDatabase.js';
import * as logger from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('overwrite')
  .setDescription('Fixer manuellement la date de sortie d\'un jeu (empêche les mises à jour IGDB)')
  .addStringOption(option =>
    option
      .setName('game')
      .setDescription('Jeu à modifier')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(option =>
    option
      .setName('date')
      .setDescription('Date de sortie UTC (format: YYYY-MM-DD HH:MM ou YYYY-MM-DD)')
      .setRequired(true)
  );

export async function autocomplete(
  interaction: AutocompleteInteraction,
  gamesDb: GamesDatabase
): Promise<void> {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  const allGames = gamesDb.getAllGames();
  
  const filtered = allGames
    .filter(game => game.name.toLowerCase().includes(focusedValue))
    .slice(0, 25)
    .map(game => ({
      name: `${game.name} (${game.releaseDate.toLocaleDateString('fr-FR')})${game.dateOverride ? ' 🔒' : ''}`,
      value: game.igdbId.toString()
    }));

  await interaction.respond(filtered);
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  gamesDb: GamesDatabase
): Promise<void> {
  await interaction.deferReply();

  const gameIdStr = interaction.options.getString('game', true);
  const dateStr = interaction.options.getString('date', true);
  
  try {
    const gameId = parseInt(gameIdStr);
    if (isNaN(gameId)) {
      await interaction.editReply('ID de jeu invalide');
      return;
    }

    const game = gamesDb.getGameByIgdbId(gameId);
    if (!game) {
      await interaction.editReply('Jeu introuvable');
      return;
    }

    let releaseDate: Date;
    
    if (dateStr.includes(':')) {
      releaseDate = new Date(`${dateStr}:00Z`);
    } else {
      releaseDate = new Date(`${dateStr}T00:00:00Z`);
    }

    if (isNaN(releaseDate.getTime())) {
      await interaction.editReply('Format de date invalide. Utilisez YYYY-MM-DD ou YYYY-MM-DD HH:MM (UTC)');
      return;
    }

    const success = gamesDb.overrideReleaseDate(gameId, releaseDate);
    
    if (success) {
      logger.log(`Date overridée pour ${game.name}: ${releaseDate.toISOString()}`);
      
      const dateFormatted = releaseDate.toLocaleString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC'
      });
      
      await interaction.editReply(
        `✅ Date de sortie fixée pour **${game.name}**\n` +
        `📅 Nouvelle date: ${dateFormatted} UTC\n` +
        `🔒 Ce jeu ne sera plus mis à jour automatiquement par IGDB`
      );
    } else {
      await interaction.editReply('Erreur lors de la modification de la date');
    }
  } catch (error) {
    logger.error('Erreur dans /overwrite:', error);
    await interaction.editReply('Une erreur est survenue lors de la modification');
  }
}
