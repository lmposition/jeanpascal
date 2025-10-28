import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import * as cron from 'node-cron';
import * as logger from '../utils/logger.js';
export class ReviewMonitor {
    client;
    db;
    steamService;
    letterboxdService;
    sensCritiqueService;
    tmdbService;
    translationService;
    channelId;
    isRunning = false;
    constructor(client, db, steamService, letterboxdService, sensCritiqueService, tmdbService, translationService, channelId) {
        this.client = client;
        this.db = db;
        this.steamService = steamService;
        this.letterboxdService = letterboxdService;
        this.sensCritiqueService = sensCritiqueService;
        this.tmdbService = tmdbService;
        this.translationService = translationService;
        this.channelId = channelId;
    }
    start() {
        logger.log('Starting review monitor...');
        // Vérification toutes les 5 minutes
        cron.schedule('*/5 * * * *', async () => {
            if (this.isRunning) {
                logger.log('Monitor already running, skipping...');
                return;
            }
            this.isRunning = true;
            try {
                await this.checkForNewReviews();
                await this.retryUnpostedReviews();
            }
            catch (error) {
                logger.error('Error in review monitor:', error);
            }
            finally {
                this.isRunning = false;
            }
        });
        logger.log('Review monitor started (runs every 5 minutes)');
    }
    async checkForNewReviews() {
        logger.log('Checking for new reviews...');
        const users = this.db.getAllUsers();
        logger.log(`Found ${users.length} users to monitor`);
        for (const user of users) {
            try {
                await this.checkUserReviews(user);
                // Délai entre chaque utilisateur pour éviter le rate limiting
                await this.delay(2000);
            }
            catch (error) {
                logger.error(`Error checking reviews for user ${user.platformUsername}:`, error);
            }
        }
    }
    async checkUserReviews(user) {
        logger.log(`Checking reviews for ${user.platformUsername} on ${user.platform}`);
        let newReviews = [];
        if (user.platform === 'steam') {
            // Pour Steam, on va surveiller les jeux récemment joués et chercher des avis
            // Cette implémentation est simplifiée car Steam n'a pas d'API directe pour les avis
            newReviews = await this.checkSteamReviews(user);
        }
        else if (user.platform === 'letterboxd') {
            newReviews = await this.checkLetterboxdReviews(user);
        }
        else if (user.platform === 'senscritique') {
            newReviews = await this.checkSensCritiqueReviews(user);
        }
        // Traiter les nouveaux avis
        for (const reviewData of newReviews) {
            const review = await this.saveReview(user, reviewData);
            if (review) {
                await this.sendReviewNotification(user, review);
                // Délai entre chaque notification
                await this.delay(1000);
            }
        }
    }
    async retryUnpostedReviews() {
        try {
            const unpostedReviews = this.db.getUnpostedReviews(3); // Max 3 tentatives
            if (unpostedReviews.length === 0) {
                return;
            }
            logger.log(`🔄 Tentative de réenvoi de ${unpostedReviews.length} avis non postés...`);
            for (const review of unpostedReviews) {
                // Récupérer l'utilisateur associé
                const user = this.db.getUserById(review.userId);
                if (!user) {
                    logger.error(`❌ Utilisateur introuvable pour l'avis ${review.id}`);
                    continue;
                }
                logger.log(`🔄 Retry ${(review.retryCount || 0) + 1}/3 pour: ${review.title} by ${user.platformUsername}`);
                await this.sendReviewNotification(user, review);
                // Délai entre chaque tentative
                await this.delay(2000);
            }
        }
        catch (error) {
            logger.error('❌ Erreur lors du retry des avis non postés:', error);
        }
    }
    async checkSteamReviews(user) {
        try {
            // Récupérer uniquement le dernier avis pour optimiser
            const reviews = await this.steamService.getUserReviews(user.platformUserId, true);
            if (reviews.length === 0) {
                logger.log(`No reviews found for ${user.platformUsername} on Steam`);
                return [];
            }
            // Récupérer le dernier avis Steam en base de données (filtré par plateforme)
            const latestReviewInDb = this.db.getLatestReviewByUserAndPlatform(user.id, 'steam');
            // Prendre le premier avis (le plus récent) de Steam
            const latestReview = reviews[0];
            // Logs de debug pour comprendre la comparaison
            logger.log(`🔍 Comparaison Steam pour ${user.platformUsername}:`);
            logger.log(`   - Avis en DB: ${latestReviewInDb ? `"${latestReviewInDb.title}" (URL: ${latestReviewInDb.reviewUrl})` : 'AUCUN'}`);
            logger.log(`   - Avis sur site: "${latestReview.title}" (URL: ${latestReview.reviewUrl})`);
            // Vérifier si c'est un nouvel avis en comparant l'URL (plus fiable)
            if (!latestReviewInDb || latestReview.reviewUrl !== latestReviewInDb.reviewUrl) {
                logger.log(`✅ Found new Steam review for ${user.platformUsername}: "${latestReview.title}"`);
                // Traduire le contenu si nécessaire
                let translatedReview = { ...latestReview };
                if (latestReview.content) {
                    try {
                        const translationResult = await this.translationService.translateIfNeeded(latestReview.content);
                        if (translationResult.wasTranslated) {
                            logger.log(`🔄 Avis Steam traduit de l'anglais vers le français`);
                            translatedReview.content = translationResult.translatedText;
                        }
                    }
                    catch (error) {
                        logger.error(`❌ Erreur lors de la traduction Steam:`, error);
                    }
                }
                return [translatedReview];
            }
            return [];
        }
        catch (error) {
            logger.error('Error checking Steam reviews:', error);
            return [];
        }
    }
    async checkLetterboxdReviews(user) {
        try {
            // Récupérer uniquement le dernier avis pour optimiser
            const reviews = await this.letterboxdService.getUserReviews(user.platformUsername, true);
            if (reviews.length === 0) {
                logger.log(`No reviews found for ${user.platformUsername} on Letterboxd`);
                return [];
            }
            // Récupérer le dernier avis Letterboxd en base de données (filtré par plateforme)
            const latestReviewInDb = this.db.getLatestReviewByUserAndPlatform(user.id, 'letterboxd');
            // Prendre le premier avis (le plus récent) de Letterboxd
            const latestReviewOnSite = reviews[0];
            // Utiliser le GUID comme identifiant unique (ne change pas lors de modifications)
            const reviewGuid = latestReviewOnSite.guid || '';
            const reviewUrl = latestReviewOnSite.movieUrl || '';
            logger.log(`🔍 Comparaison Letterboxd pour ${user.platformUsername}:`);
            logger.log(`   - Avis en DB: ${latestReviewInDb ? `"${latestReviewInDb.title}" (GUID: ${latestReviewInDb.reviewUrl})` : 'AUCUN'}`);
            logger.log(`   - Avis sur site: "${latestReviewOnSite.title}" (GUID: ${reviewGuid})`);
            // Si pas d'avis en DB ou si le GUID est différent
            if (!latestReviewInDb || latestReviewInDb.reviewUrl !== reviewGuid) {
                // Vérifier si c'est un watch simple sans texte de review
                const hasReviewText = latestReviewOnSite.reviewText && latestReviewOnSite.reviewText.trim().length > 0;
                if (!hasReviewText) {
                    logger.log(`⏭️ Watch simple sans avis pour "${latestReviewOnSite.title}", ignoré`);
                    return [];
                }
                logger.log(`Found new Letterboxd review for ${user.platformUsername}: "${latestReviewOnSite.title}"`);
                // Traduire le contenu si nécessaire
                let translatedContent = latestReviewOnSite.reviewText || '';
                if (translatedContent) {
                    try {
                        const translationResult = await this.translationService.translateIfNeeded(translatedContent);
                        if (translationResult.wasTranslated) {
                            logger.log(`🔄 Avis Letterboxd traduit de l'anglais vers le français`);
                            translatedContent = translationResult.translatedText;
                        }
                    }
                    catch (error) {
                        logger.error(`❌ Erreur lors de la traduction Letterboxd:`, error);
                    }
                }
                return [{
                        ...latestReviewOnSite,
                        reviewText: translatedContent,
                        reviewUrl: reviewGuid // Stocker le GUID comme reviewUrl pour l'unicité
                    }];
            }
            logger.log(`No new reviews for ${user.platformUsername} on Letterboxd`);
            return [];
        }
        catch (error) {
            logger.error('Error checking Letterboxd reviews:', error);
            return [];
        }
    }
    async checkSensCritiqueReviews(user) {
        try {
            logger.log(`🔍 Vérification des avis SensCritique pour ${user.platformUsername}...`);
            // Récupérer uniquement le dernier avis pour optimiser
            const reviews = await this.sensCritiqueService.getUserReviews(user.platformUsername, true);
            if (reviews.length === 0) {
                logger.log(`❌ Aucun avis trouvé pour ${user.platformUsername} sur SensCritique`);
                return [];
            }
            // Récupérer le dernier avis SensCritique en base de données (filtré par plateforme)
            const latestReviewInDb = this.db.getLatestReviewByUserAndPlatform(user.id, 'senscritique');
            // Prendre le premier avis (le plus récent) de SensCritique
            const latestReviewOnSite = reviews[0];
            logger.log(`📊 Dernier avis SensCritique trouvé: "${latestReviewOnSite.title}" (${latestReviewOnSite.rating}/10)`);
            logger.log(`📝 Contenu récupéré: ${latestReviewOnSite.fullReviewContent ? latestReviewOnSite.fullReviewContent.substring(0, 100) + '...' : 'VIDE'}`);
            logger.log(`🔍 Comparaison SensCritique pour ${user.platformUsername}:`);
            logger.log(`   - Avis en DB: ${latestReviewInDb ? `"${latestReviewInDb.title}" (URL: ${latestReviewInDb.reviewUrl})` : 'AUCUN'}`);
            logger.log(`   - Avis sur site: "${latestReviewOnSite.title}" (URL: ${latestReviewOnSite.reviewUrl})`);
            // Si pas d'avis en DB ou si l'URL est différente
            if (!latestReviewInDb || latestReviewInDb.reviewUrl !== latestReviewOnSite.reviewUrl) {
                logger.log(`✅ Nouvel avis SensCritique trouvé pour ${user.platformUsername}: "${latestReviewOnSite.title}"`);
                // Utiliser le contenu complet ou un fallback informatif
                const reviewContent = latestReviewOnSite.fullReviewContent ||
                    latestReviewOnSite.content ||
                    `Avis SensCritique: ${latestReviewOnSite.rating}/10`;
                logger.log(`📝 Contenu final utilisé: "${reviewContent.substring(0, 100)}..."`);
                // Enrichir avec TMDB pour l'image de couverture
                logger.log(`🎬 Enrichissement TMDB pour: "${latestReviewOnSite.title}"`);
                let coverImage = latestReviewOnSite.coverImage || '';
                try {
                    const tmdbImage = await this.tmdbService.getMovieImage(latestReviewOnSite.title);
                    if (tmdbImage) {
                        coverImage = tmdbImage;
                        logger.log(`✅ Image TMDB récupérée pour "${latestReviewOnSite.title}"`);
                    }
                }
                catch (error) {
                    logger.error(`❌ Erreur enrichissement TMDB pour "${latestReviewOnSite.title}":`, error);
                }
                // Traduire le contenu si nécessaire
                let translatedContent = reviewContent;
                if (translatedContent) {
                    try {
                        const translationResult = await this.translationService.translateIfNeeded(translatedContent);
                        if (translationResult.wasTranslated) {
                            logger.log(`🔄 Avis SensCritique traduit de l'anglais vers le français`);
                            translatedContent = translationResult.translatedText;
                        }
                    }
                    catch (error) {
                        logger.error(`❌ Erreur lors de la traduction SensCritique:`, error);
                    }
                }
                // Adapter le format pour la base de données
                return [{
                        title: latestReviewOnSite.title,
                        content: translatedContent,
                        rating: latestReviewOnSite.rating,
                        reviewUrl: latestReviewOnSite.reviewUrl,
                        reviewDate: latestReviewOnSite.reviewDate || new Date().toISOString(),
                        coverImage: coverImage,
                        movieUrl: latestReviewOnSite.reviewUrl
                    }];
            }
            logger.log(`ℹ️ Pas de nouvel avis pour ${user.platformUsername} sur SensCritique`);
            return [];
        }
        catch (error) {
            logger.error(`❌ Erreur lors de la vérification des avis SensCritique pour ${user.platformUsername}:`, error);
            return [];
        }
    }
    async saveReview(user, reviewData) {
        try {
            // Pour Letterboxd, reviewText contient le texte traduit (priorité)
            // Pour Steam et SensCritique, content ou review contient le texte
            const content = reviewData.reviewText || reviewData.content || reviewData.review || '';
            logger.log(`💾 Sauvegarde avis avec contenu (${content.length} caractères): "${content.substring(0, 50)}..."`);
            const review = {
                userId: user.id,
                platform: user.platform,
                gameId: reviewData.appId?.toString(),
                movieId: reviewData.movieId,
                title: reviewData.title,
                content: content,
                rating: reviewData.rating,
                coverImage: reviewData.coverImage,
                reviewUrl: reviewData.reviewUrl,
                reviewDate: reviewData.reviewDate || new Date().toISOString(),
                gameUrl: reviewData.gameUrl,
                isPosted: false, // Par défaut, l'avis n'est pas encore posté
                retryCount: 0 // Initialiser le compteur de retry
            };
            return this.db.addReview(review);
        }
        catch (error) {
            logger.error('Error saving review:', error);
            return null;
        }
    }
    async sendReviewNotification(user, review) {
        try {
            logger.log(`📤 Envoi notification avec contenu (${review.content.length} caractères): "${review.content.substring(0, 50)}..."`);
            const channel = this.client.channels.cache.get(this.channelId);
            if (!channel) {
                logger.error(`Channel ${this.channelId} not found`);
                // Incrémenter le compteur de retry
                this.db.incrementRetryCount(review.id);
                return;
            }
            // Utiliser exactement la même présentation que /lastreview
            const embed = this.createReviewEmbed(user, review);
            const actionButtons = this.createActionButtons(user, review);
            const message = await channel.send({
                embeds: [embed],
                components: [actionButtons]
            });
            // Ajouter les réactions automatiquement
            try {
                await message.react('👍');
                await message.react('👎');
                logger.log(`✅ Réactions ajoutées au message`);
            }
            catch (reactionError) {
                logger.error('❌ Erreur lors de l\'ajout des réactions:', reactionError);
            }
            // Marquer l'avis comme posté
            this.db.markReviewAsPosted(review.id);
            logger.log(`✅ Notification envoyée pour: ${review.title} by ${user.platformUsername}`);
        }
        catch (error) {
            logger.error('❌ Erreur lors de l\'envoi de la notification:', error);
            // Incrémenter le compteur de retry en cas d'erreur
            this.db.incrementRetryCount(review.id);
        }
    }
    createReviewEmbed(user, review) {
        const embed = new EmbedBuilder()
            .setTimestamp(new Date(review.reviewDate))
            .setColor(this.getReviewColor(user.platform, review.rating ?? null))
            .setFooter({
            text: `${user.platform.charAt(0).toUpperCase() + user.platform.slice(1)} • ${user.platformUsername}`,
            iconURL: this.getPlatformIcon(user.platform)
        });
        // Ajouter l'image de couverture en thumbnail (haut à droite)
        if (review.coverImage) {
            embed.setThumbnail(review.coverImage);
        }
        // Titre sans emoji
        embed.setAuthor({
            name: `Nouvel avis de ${user.platformUsername}`,
            iconURL: this.getPlatformIcon(user.platform)
        });
        embed.setTitle(review.title);
        // Ligne de séparation avec note et date
        let headerInfo = '';
        if (user.platform === 'letterboxd' && review.rating !== null && review.rating !== undefined) {
            const ratingDisplay = this.formatLetterboxdRating(review.rating);
            headerInfo = `${ratingDisplay} • 📅 ${this.formatDate(review.reviewDate)}`;
        }
        else if (user.platform === 'steam') {
            if (review.rating !== null && review.rating !== undefined) {
                const recommendation = review.rating === 1 ? '👍' : '👎';
                headerInfo = `${recommendation} • 📅 ${this.formatDate(review.reviewDate)}`;
            }
            else {
                headerInfo = `📅 ${this.formatDate(review.reviewDate)}`;
            }
        }
        else if (user.platform === 'senscritique') {
            if (review.rating !== null && review.rating !== undefined) {
                const ratingDisplay = this.formatSensCritiqueRating(review.rating);
                headerInfo = `${ratingDisplay} • 📅 ${this.formatDate(review.reviewDate)}`;
            }
            else {
                headerInfo = `📅 ${this.formatDate(review.reviewDate)}`;
            }
        }
        else {
            headerInfo = `📅 ${this.formatDate(review.reviewDate)}`;
        }
        embed.setDescription(`${headerInfo}\n\n${this.getReviewContent(review)}`);
        return embed;
    }
    getReviewContent(review) {
        // Utiliser reviewText (texte complet de Puppeteer) en priorité, sinon content
        const text = review.reviewText || review.content;
        if (!text || text.trim() === '') {
            return '*Aucun commentaire écrit*';
        }
        let content = text.trim();
        // Limite Discord : 4096 caractères pour la description
        // Garder de la marge pour les blocs de code et formatage
        if (content.length > 3800) {
            content = content.substring(0, 3797) + '...';
        }
        // Mettre dans un bloc de code comme demandé
        return `\`\`\`\n${content}\n\`\`\``;
    }
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }
    createActionButtons(user, review) {
        const row = new ActionRowBuilder();
        // Bouton "Voir l'avis"
        const reviewUrl = this.getValidReviewUrl(review, user);
        if (reviewUrl) {
            row.addComponents(new ButtonBuilder()
                .setLabel('Voir l\'avis')
                .setStyle(ButtonStyle.Link)
                .setURL(reviewUrl)
                .setEmoji('📝'));
        }
        // Bouton "Voir la page du film/jeu"
        if (user.platform === 'letterboxd') {
            // Pour Letterboxd, utiliser TMDB
            row.addComponents(new ButtonBuilder()
                .setLabel('Voir le film')
                .setStyle(ButtonStyle.Link)
                .setURL(this.getTMDBUrl(review.title))
                .setEmoji('🎬'));
        }
        else if (user.platform === 'steam') {
            // Pour Steam, utiliser Steam Store
            const gameUrl = `https://store.steampowered.com/app/${review.gameId || ''}/`;
            row.addComponents(new ButtonBuilder()
                .setLabel('Voir le jeu')
                .setStyle(ButtonStyle.Link)
                .setURL(gameUrl)
                .setEmoji('🎮'));
        }
        else if (user.platform === 'senscritique') {
            // Pour SensCritique, utiliser TMDB pour les films
            row.addComponents(new ButtonBuilder()
                .setLabel('Voir le film')
                .setStyle(ButtonStyle.Link)
                .setURL(this.getTMDBUrl(review.title))
                .setEmoji('🎬'));
        }
        // Bouton "Trailer"
        row.addComponents(new ButtonBuilder()
            .setLabel('Trailer')
            .setStyle(ButtonStyle.Link)
            .setURL(this.getTrailerUrl(review.title, user.platform))
            .setEmoji('🎥'));
        return row;
    }
    getValidReviewUrl(review, user) {
        // Si l'URL existe et est valide, l'utiliser
        if (review.reviewUrl && this.isValidUrl(review.reviewUrl)) {
            return review.reviewUrl;
        }
        // Sinon, construire une URL basée sur la plateforme
        if (user.platform === 'letterboxd') {
            // Construire l'URL Letterboxd basée sur le username
            return `https://letterboxd.com/${user.platformUsername}/films/reviews/`;
        }
        else if (user.platform === 'steam') {
            // Construire l'URL Steam basée sur le SteamID
            return `https://steamcommunity.com/profiles/${user.platformUserId}/reviews/`;
        }
        else if (user.platform === 'senscritique') {
            // Construire l'URL SensCritique basée sur le username
            return `https://www.senscritique.com/${user.platformUsername}`;
        }
        return null;
    }
    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        }
        catch (_) {
            return false;
        }
    }
    getTMDBUrl(movieTitle) {
        const searchTitle = movieTitle.replace(/\s*\(\d{4}\)$/, '').trim();
        const encodedTitle = encodeURIComponent(searchTitle);
        return `https://www.themoviedb.org/search?query=${encodedTitle}`;
    }
    getTrailerUrl(title, platform) {
        const searchTitle = title.replace(/\s*\(\d{4}\)$/, '').trim();
        const encodedTitle = encodeURIComponent(`${searchTitle} trailer`);
        return `https://www.youtube.com/results?search_query=${encodedTitle}`;
    }
    formatLetterboxdRating(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        let stars = '⭐'.repeat(fullStars);
        if (hasHalfStar) {
            stars += '✨'; // Demi-étoile
        }
        return `${stars} (${rating}/5)`;
    }
    formatSensCritiqueRating(rating) {
        // Convertir la note sur 10 en étoiles sur 5
        const starsRating = rating / 2;
        const fullStars = Math.floor(starsRating);
        const hasHalfStar = starsRating % 1 >= 0.5;
        let stars = '⭐'.repeat(fullStars);
        if (hasHalfStar) {
            stars += '✨'; // Demi-étoile
        }
        return `${stars} (${rating}/10)`;
    }
    getReviewColor(platform, rating) {
        if (rating === null || rating === undefined) {
            return '#6c757d'; // Gris neutre si pas de note
        }
        let normalizedRating;
        // Normaliser les notes selon la plateforme
        if (platform === 'letterboxd') {
            // Letterboxd: 0-5 étoiles
            normalizedRating = rating / 5;
        }
        else if (platform === 'senscritique') {
            // SensCritique: 0-10
            normalizedRating = rating / 10;
        }
        else if (platform === 'steam') {
            // Steam: 0 (négatif) ou 1 (positif)
            return rating === 1 ? '#28a745' : '#dc3545'; // Vert pour positif, rouge pour négatif
        }
        else {
            normalizedRating = 0.5; // Neutre par défaut
        }
        // Couleurs basées sur la note normalisée (0-1)
        if (normalizedRating >= 0.7) {
            return '#28a745'; // Vert pour les bonnes notes (≥70%)
        }
        else if (normalizedRating >= 0.5) {
            return '#ffc107'; // Jaune pour les notes moyennes (50-69%)
        }
        else {
            return '#dc3545'; // Rouge pour les mauvaises notes (<50%)
        }
    }
    getPlatformIcon(platform) {
        switch (platform) {
            case 'steam':
                return 'https://ogc-cdn.b-cdn.net/logos/favicon-2-4.png';
            case 'letterboxd':
                return 'https://ogc-cdn.b-cdn.net/logos/favicon-3.png';
            case 'senscritique':
                return 'https://ogc-cdn.b-cdn.net/logos/senscritique.png';
            default:
                return undefined; // Retourner undefined au lieu de chaîne vide
        }
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    stop() {
        logger.log('Review monitor stopped');
        // Note: node-cron ne fournit pas de méthode directe pour arrêter une tâche spécifique
        // Dans une implémentation plus avancée, on stockerait la référence de la tâche
    }
}
