import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { StreamingAvailabilityService } from './streamingAvailabilityService.js';
import * as logger from '../utils/logger.js';
export class StreamingMonitor {
    client;
    streamingService;
    channelId = '1435854807578443776';
    messageTimers = new Map();
    constructor(client, rapidApiKey) {
        this.client = client;
        this.streamingService = new StreamingAvailabilityService(rapidApiKey);
    }
    start() {
        logger.log('🎬 Démarrage du moniteur de streaming...');
        this.client.on('messageCreate', async (message) => {
            // Ignorer les messages du bot
            if (message.author.bot)
                return;
            // Vérifier si c'est le bon canal
            if (message.channelId !== this.channelId)
                return;
            // Récupérer le titre du message
            const title = message.content.trim();
            if (!title)
                return;
            logger.log(`📺 Recherche de streaming pour: "${title}"`);
            try {
                // Supprimer le message de l'utilisateur
                await message.delete();
                // Rechercher sur l'API
                const result = await this.streamingService.searchByTitle(title);
                if (!result) {
                    // Envoyer un message d'erreur temporaire
                    const errorMsg = await message.channel.send({
                        content: `❌ Aucun résultat trouvé pour "${title}"`
                    });
                    // Supprimer après 10 secondes
                    setTimeout(() => {
                        errorMsg.delete().catch(() => { });
                    }, 10000);
                    return;
                }
                // Créer l'embed
                const embed = await this.createStreamingEmbed(result);
                // Créer les boutons pour les plateformes
                const buttons = this.createStreamingButtons(result);
                // Envoyer l'embed
                const sentMessage = await message.channel.send({
                    embeds: [embed],
                    components: buttons.length > 0 ? buttons : []
                });
                // Programmer la suppression après 5 minutes
                this.scheduleMessageDeletion(sentMessage);
            }
            catch (error) {
                logger.error('❌ Erreur lors du traitement du message:', error);
            }
        });
        logger.log(`✅ Moniteur de streaming actif sur le canal ${this.channelId}`);
    }
    async createStreamingEmbed(result) {
        const typeEmoji = result.type === 'movie' ? '🎬' : '📺';
        const typeText = result.type === 'movie' ? 'Film' : 'Série';
        const embed = new EmbedBuilder()
            .setTitle(`${typeEmoji} ${result.title}`)
            .setDescription(result.overview || 'Aucune description disponible')
            .setThumbnail(result.posterUrl)
            .setColor('#9146FF')
            .addFields({
            name: '📅 Année',
            value: result.year.toString(),
            inline: true
        }, {
            name: '⭐ Note',
            value: `${result.rating}/100`,
            inline: true
        }, {
            name: '🎭 Type',
            value: typeText,
            inline: true
        });
        if (result.genres.length > 0) {
            embed.addFields({
                name: '🎨 Genres',
                value: result.genres.join(', '),
                inline: false
            });
        }
        if (result.cast.length > 0) {
            embed.addFields({
                name: '🎭 Casting',
                value: result.cast.join(', '),
                inline: false
            });
        }
        if (result.directors && result.directors.length > 0) {
            embed.addFields({
                name: '🎬 Réalisateur(s)',
                value: result.directors.join(', '),
                inline: false
            });
        }
        if (result.creators && result.creators.length > 0) {
            embed.addFields({
                name: '✍️ Créateur(s)',
                value: result.creators.join(', '),
                inline: false
            });
        }
        // Ajouter les plateformes disponibles
        if (result.streamingOptions.length > 0) {
            const platformsList = result.streamingOptions
                .map(opt => {
                const typeEmoji = this.getTypeEmoji(opt.type);
                const price = opt.price ? ` (${opt.price})` : '';
                return `${typeEmoji} **${opt.service}**${price}`;
            })
                .join('\n');
            embed.addFields({
                name: '📡 Disponible sur',
                value: platformsList,
                inline: false
            });
        }
        else {
            embed.addFields({
                name: '📡 Disponibilité',
                value: 'Aucune plateforme de streaming trouvée',
                inline: false
            });
        }
        embed.setFooter({ text: 'Ce message sera supprimé dans 5 minutes' });
        embed.setTimestamp();
        return embed;
    }
    createStreamingButtons(result) {
        const rows = [];
        const buttons = [];
        // Limiter à 5 boutons (limite Discord par row)
        const limitedOptions = result.streamingOptions.slice(0, 5);
        for (const option of limitedOptions) {
            const button = new ButtonBuilder()
                .setLabel(option.service)
                .setStyle(ButtonStyle.Link)
                .setURL(option.link);
            buttons.push(button);
        }
        // Discord limite à 5 boutons par row
        if (buttons.length > 0) {
            const row = new ActionRowBuilder().addComponents(buttons);
            rows.push(row);
        }
        return rows;
    }
    getTypeEmoji(type) {
        switch (type) {
            case 'subscription':
                return '🔄';
            case 'rent':
                return '💵';
            case 'buy':
                return '💰';
            case 'addon':
                return '➕';
            case 'free':
                return '🆓';
            default:
                return '📺';
        }
    }
    scheduleMessageDeletion(message) {
        // Supprimer après 5 minutes (300000 ms)
        const timer = setTimeout(async () => {
            try {
                await message.delete();
                this.messageTimers.delete(message.id);
                logger.log(`🗑️ Message de streaming supprimé après 5 minutes`);
            }
            catch (error) {
                logger.error('❌ Erreur lors de la suppression du message:', error);
            }
        }, 300000);
        this.messageTimers.set(message.id, timer);
    }
    stop() {
        // Nettoyer tous les timers
        for (const timer of this.messageTimers.values()) {
            clearTimeout(timer);
        }
        this.messageTimers.clear();
        logger.log('🛑 Moniteur de streaming arrêté');
    }
}
