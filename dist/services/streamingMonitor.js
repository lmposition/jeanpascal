import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { StreamingAvailabilityService } from './streamingAvailabilityService.js';
import * as logger from '../utils/logger.js';
export class StreamingMonitor {
    client;
    streamingService;
    channelId = '1435854807578443776';
    messageTimers = new Map();
    userCooldowns = new Map();
    cooldownDuration = 10000; // 10 secondes
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
            // Vérifier le cooldown de l'utilisateur
            const userId = message.author.id;
            const now = Date.now();
            const userLastRequest = this.userCooldowns.get(userId);
            if (userLastRequest && now - userLastRequest < this.cooldownDuration) {
                const remainingTime = Math.ceil((this.cooldownDuration - (now - userLastRequest)) / 1000);
                // Supprimer le message de l'utilisateur
                await message.delete();
                // Envoyer un message de cooldown
                const cooldownMsg = await message.channel.send({
                    content: `⏳ <@${userId}>, veuillez attendre ${remainingTime} seconde(s) avant de faire une nouvelle recherche.`
                });
                // Supprimer après 5 secondes
                setTimeout(() => {
                    cooldownMsg.delete().catch(() => { });
                }, 5000);
                return;
            }
            // Enregistrer la requête
            this.userCooldowns.set(userId, now);
            logger.log(`📺 Recherche de streaming pour: "${title}" (utilisateur: ${message.author.tag})`);
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
        // Description courte et sobre
        const shortDescription = result.overview && result.overview.length > 150
            ? result.overview.substring(0, 150) + '...'
            : result.overview || 'Aucune description disponible';
        const embed = new EmbedBuilder()
            .setTitle(`${typeEmoji} ${result.title}`)
            .setDescription(shortDescription)
            .setThumbnail(result.posterUrl)
            .setColor('#5865F2'); // Couleur Discord bleu sobre
        // Ajouter les plateformes disponibles de manière simple
        if (result.streamingOptions.length > 0) {
            const platformsList = result.streamingOptions
                .slice(0, 5) // Limiter à 5 plateformes
                .map(opt => {
                const typeEmoji = this.getTypeEmoji(opt.type);
                return `${typeEmoji} ${opt.service}`;
            })
                .join(' • ');
            embed.addFields({
                name: '📡 Disponible sur',
                value: platformsList,
                inline: false
            });
        }
        else {
            embed.addFields({
                name: '📡 Disponibilité',
                value: 'Non disponible en streaming en France',
                inline: false
            });
        }
        embed.setFooter({ text: 'Suppression dans 5 min' });
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
        this.userCooldowns.clear();
        logger.log('🛑 Moniteur de streaming arrêté');
    }
}
