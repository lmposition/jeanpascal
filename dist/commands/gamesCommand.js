import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import * as logger from '../utils/logger.js';
export const data = new SlashCommandBuilder()
    .setName('games')
    .setDescription('Afficher tous les jeux suivis avec leur compte à rebours');
function getRandomColor() {
    return Math.floor(Math.random() * 0xFFFFFF);
}
function formatCountdown(releaseDate) {
    // Vérifier si c'est une date TBD (année 9999)
    if (releaseDate.getFullYear() >= 9999) {
        return 'TBD';
    }
    // Vérifier si c'est juste une année (30 ou 31 décembre = IGDB pattern)
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
    if (days > 0)
        parts.push(`${days}j`);
    if (hours > 0)
        parts.push(`${hours}h`);
    if (minutes > 0)
        parts.push(`${minutes}m`);
    // Afficher les secondes uniquement si moins de 24h
    if (days === 0 && seconds > 0) {
        parts.push(`${seconds}s`);
    }
    return parts.join(' ');
}
export async function execute(interaction, gamesDb, igdbService) {
    await interaction.deferReply();
    try {
        const games = gamesDb.getUpcomingGames();
        const embed = new EmbedBuilder()
            .setTitle('Tous les jeux suivis')
            .setColor(getRandomColor());
        if (games.length === 0) {
            embed.setDescription('Aucun jeu suivi pour le moment');
        }
        else {
            // Récupérer les détails du premier jeu (le prochain à sortir)
            const nextGame = games[0];
            const gameDetails = await igdbService.getGameById(nextGame.igdbId, true);
            if (gameDetails) {
                // Cover en thumbnail
                if (gameDetails.coverUrl) {
                    embed.setThumbnail(gameDetails.coverUrl);
                }
                // Afficher un screenshot aléatoire
                if (gameDetails.screenshotUrls && gameDetails.screenshotUrls.length > 0) {
                    const randomIndex = Math.floor(Math.random() * gameDetails.screenshotUrls.length);
                    embed.setImage(gameDetails.screenshotUrls[randomIndex]);
                }
            }
            // Ajouter tous les jeux comme fields (inline)
            games.forEach(game => {
                const countdown = formatCountdown(game.releaseDate);
                embed.addFields({
                    name: `**${game.name}**`,
                    value: countdown,
                    inline: true
                });
            });
        }
        await interaction.editReply({ embeds: [embed] });
        logger.log(`Commande /games exécutée - ${games.length} jeu(x) affiché(s)`);
    }
    catch (error) {
        logger.error('Erreur dans /games:', error);
        await interaction.editReply('Une erreur est survenue lors de la récupération des jeux');
    }
}
