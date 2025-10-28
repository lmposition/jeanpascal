import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
export class SeedCommand {
    db;
    steamService;
    letterboxdService;
    sensCritiqueService;
    constructor(db, steamService, letterboxdService, sensCritiqueService) {
        this.db = db;
        this.steamService = steamService;
        this.letterboxdService = letterboxdService;
        this.sensCritiqueService = sensCritiqueService;
    }
    getSlashCommand() {
        return new SlashCommandBuilder()
            .setName('seed')
            .setDescription('Récupère automatiquement les derniers avis de tous les utilisateurs enregistrés');
    }
    async execute(interaction) {
        await interaction.deferReply();
        console.log('🚀 Commande /seed exécutée - Récupération automatique des derniers avis pour tous les utilisateurs');
        const discordUserId = interaction.user.id;
        try {
            // Récupérer tous les utilisateurs enregistrés
            const allUsers = this.db.getAllUsers();
            console.log(`📊 ${allUsers.length} utilisateur(s) trouvé(s) dans la base de données`);
            if (allUsers.length === 0) {
                await interaction.editReply({
                    embeds: [new EmbedBuilder()
                            .setTitle('🌱 Récupération des avis')
                            .setDescription('Aucun utilisateur enregistré dans la base de données.\nUtilisez `/add` pour ajouter des utilisateurs.')
                            .setColor('#ffd43b')
                            .setTimestamp()]
                });
                return;
            }
            let reviewsInfo = '🔄 **Récupération des derniers avis en cours...**\n\n';
            let totalReviews = 0;
            for (const user of allUsers) {
                try {
                    console.log(`🔍 Récupération des avis pour ${user.platformUsername} (${user.platform})...`);
                    let reviews = [];
                    if (user.platform === 'letterboxd') {
                        reviews = await this.letterboxdService.getUserReviews(user.platformUsername, true);
                    }
                    else if (user.platform === 'senscritique') {
                        reviews = await this.sensCritiqueService.getUserReviews(user.platformUsername, true);
                    }
                    else if (user.platform === 'steam') {
                        reviews = await this.steamService.getUserReviews(user.platformUserId, true);
                    }
                    const reviewCount = reviews.length;
                    totalReviews += reviewCount;
                    // SAUVEGARDER les avis dans la base de données
                    if (reviews.length > 0) {
                        for (const review of reviews) {
                            try {
                                // Vérifier si l'avis existe déjà
                                const existingReview = this.db.getReviewByUserAndUrl(user.id, review.reviewUrl || '');
                                if (existingReview) {
                                    console.log(`⚠️ Avis déjà existant: "${review.title}" pour ${user.platformUsername}`);
                                    continue;
                                }
                                const reviewData = {
                                    userId: user.id,
                                    platform: user.platform,
                                    gameId: user.platform === 'steam' ? review.appId || '' : '',
                                    movieId: user.platform !== 'steam' ? review.movieId || '' : '',
                                    title: review.title,
                                    content: review.fullReviewContent || review.content || `Avis ${user.platform}: ${review.rating}`,
                                    rating: review.rating,
                                    coverImage: review.coverImage || '',
                                    reviewUrl: review.reviewUrl || '',
                                    reviewDate: review.reviewDate || new Date().toISOString()
                                };
                                console.log(`📝 Contenu à sauvegarder: "${reviewData.content?.substring(0, 100)}..."`);
                                this.db.addReview(reviewData);
                                console.log(`💾 Avis sauvegardé: "${review.title}" pour ${user.platformUsername}`);
                            }
                            catch (error) {
                                if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                                    console.log(`⚠️ Avis déjà existant (contrainte): "${review.title}" pour ${user.platformUsername}`);
                                }
                                else {
                                    console.error(`❌ Erreur sauvegarde avis "${review.title}":`, error);
                                }
                            }
                        }
                    }
                    const platformEmoji = user.platform === 'letterboxd' ? '📝' :
                        user.platform === 'senscritique' ? '🎬' : '🎮';
                    reviewsInfo += `${platformEmoji} **${user.platform}** (${user.platformUsername}): ${reviewCount} avis trouvé(s)\n`;
                    // Afficher les détails du premier avis si trouvé
                    if (reviews.length > 0) {
                        const firstReview = reviews[0];
                        if (user.platform === 'letterboxd') {
                            reviewsInfo += `   └─ "${firstReview.title}" (${firstReview.rating || 'N/A'}/5)\n`;
                        }
                        else if (user.platform === 'senscritique') {
                            reviewsInfo += `   └─ "${firstReview.title}" (${firstReview.rating}/10)\n`;
                            if (firstReview.fullReviewContent) {
                                const preview = firstReview.fullReviewContent.substring(0, 50) + '...';
                                reviewsInfo += `   └─ Contenu: "${preview}"\n`;
                            }
                        }
                        else if (user.platform === 'steam') {
                            const recommendation = firstReview.rating === 1 ? '👍' : '👎';
                            reviewsInfo += `   └─ "${firstReview.title}" ${recommendation}\n`;
                        }
                    }
                }
                catch (error) {
                    console.error(`Erreur pour ${user.platformUsername}:`, error);
                    reviewsInfo += `❌ **${user.platform}** (${user.platformUsername}): Erreur lors de la récupération\n`;
                }
            }
            console.log(`✅ Récupération terminée - ${totalReviews} avis trouvé(s) au total`);
            // Créer l'embed de résultat
            const embed = new EmbedBuilder()
                .setTitle('🔄 Récupération et sauvegarde des avis')
                .setDescription(`**${totalReviews}** avis récupérés et sauvegardés pour **${allUsers.length}** utilisateur(s)\n\n${reviewsInfo}`)
                .setColor(totalReviews > 0 ? '#51cf66' : '#ffd43b')
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        catch (error) {
            console.error('Erreur lors du peuplement:', error);
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('❌ Erreur de peuplement')
                .setDescription(`Une erreur est survenue lors du peuplement de la base de données.`)
                .addFields({ name: 'Erreur', value: `\`\`\`${error}\`\`\``, inline: false }, { name: '💡 Suggestion', value: 'Essayez d\'abord la commande `/migrate` pour mettre à jour la structure de la base de données.', inline: false })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
    }
}
