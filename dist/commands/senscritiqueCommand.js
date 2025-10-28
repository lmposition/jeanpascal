import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { SensCritiqueService } from '../services/senscritiqueService.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export class SensCritiqueCommand {
    getSlashCommand() {
        return new SlashCommandBuilder()
            .setName('senscritique')
            .setDescription('Extrait et affiche une critique SensCritique depuis les fichiers HTML locaux')
            .addStringOption(option => option.setName('action')
            .setDescription('Action à effectuer')
            .setRequired(true)
            .addChoices({ name: 'Données de base', value: 'basic' }, { name: 'Contenu complet', value: 'content' }, { name: 'Critique complète', value: 'complete' }));
    }
    async execute(interaction) {
        const action = interaction.options.getString('action', true);
        // Chemins vers les fichiers HTML
        const mainPagePath = path.join(__dirname, '../../pages/senscritique.html');
        const contentPagePath = path.join(__dirname, '../../pages/sencritiquecontent.html');
        try {
            await interaction.deferReply();
            switch (action) {
                case 'basic': {
                    const basicData = SensCritiqueService.extractFromFile(mainPagePath);
                    if (!basicData) {
                        await interaction.editReply({
                            content: '❌ Impossible d\'extraire les données de base depuis le fichier SensCritique.'
                        });
                        return;
                    }
                    const embed = new EmbedBuilder()
                        .setTitle('📊 Données de base SensCritique')
                        .setColor('#FF6B35')
                        .addFields({ name: '🎬 Titre', value: basicData.title, inline: true }, { name: '⭐ Note', value: `${basicData.rating}/10`, inline: true }, { name: '🔗 URL', value: basicData.reviewUrl || 'Non disponible', inline: false })
                        .setFooter({ text: 'SensCritique • Données extraites depuis senscritique.html' })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'content': {
                    const fullContent = SensCritiqueService.extractFullContentFromFile(contentPagePath);
                    if (!fullContent) {
                        await interaction.editReply({
                            content: '❌ Impossible d\'extraire le contenu complet depuis le fichier SensCritique.'
                        });
                        return;
                    }
                    // Tronquer le contenu si trop long pour Discord (limite 4096 caractères)
                    const truncatedContent = fullContent.length > 3900
                        ? fullContent.substring(0, 3900) + '...'
                        : fullContent;
                    const embed = new EmbedBuilder()
                        .setTitle('📝 Contenu de la critique')
                        .setColor('#FF6B35')
                        .setDescription(`> ${truncatedContent}`)
                        .addFields({ name: '📊 Statistiques', value: `${fullContent.length} caractères`, inline: true })
                        .setFooter({ text: 'SensCritique • Contenu extrait depuis sencritiquecontent.html' })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'complete': {
                    const completeReview = SensCritiqueService.processCompleteReview(mainPagePath, contentPagePath);
                    if (!completeReview) {
                        await interaction.editReply({
                            content: '❌ Impossible de traiter la critique complète.'
                        });
                        return;
                    }
                    // Tronquer le contenu si trop long
                    const truncatedContent = completeReview.fullReviewContent && completeReview.fullReviewContent.length > 3500
                        ? completeReview.fullReviewContent.substring(0, 3500) + '...'
                        : completeReview.fullReviewContent || 'Contenu non disponible';
                    const embed = new EmbedBuilder()
                        .setTitle(`🎬 ${completeReview.title}`)
                        .setColor('#FF6B35')
                        .addFields({ name: '⭐ Note', value: `${completeReview.rating}/10`, inline: true }, { name: '🔗 URL', value: completeReview.reviewUrl, inline: true }, { name: '📝 Critique', value: `> ${truncatedContent}`, inline: false })
                        .setFooter({ text: 'SensCritique • Critique complète extraite' })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                default: {
                    await interaction.editReply({
                        content: '❌ Action non reconnue.'
                    });
                }
            }
        }
        catch (error) {
            console.error('Erreur lors de l\'exécution de la commande SensCritique:', error);
            const errorMessage = interaction.deferred
                ? { content: '❌ Une erreur est survenue lors du traitement de la commande.' }
                : { content: '❌ Une erreur est survenue lors du traitement de la commande.', ephemeral: true };
            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            }
            else {
                await interaction.reply(errorMessage);
            }
        }
    }
}
