import axios from 'axios';
import * as cheerio from 'cheerio';
export class SteamService {
    apiKey;
    baseUrl = 'https://api.steampowered.com';
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async getUserGames(steamId) {
        try {
            const response = await axios.get(`${this.baseUrl}/IPlayerService/GetOwnedGames/v0001/`, {
                params: {
                    key: this.apiKey,
                    steamid: steamId,
                    format: 'json',
                    include_appinfo: true,
                    include_played_free_games: true
                }
            });
            return response.data.response.games || [];
        }
        catch (error) {
            console.error('Error fetching Steam games:', error);
            return [];
        }
    }
    async getRecentlyPlayedGames(steamId) {
        try {
            const response = await axios.get(`${this.baseUrl}/IPlayerService/GetRecentlyPlayedGames/v0001/`, {
                params: {
                    key: this.apiKey,
                    steamid: steamId,
                    format: 'json'
                }
            });
            return response.data.response.games || [];
        }
        catch (error) {
            console.error('Error fetching recently played games:', error);
            return [];
        }
    }
    async getUserReviews(steamId, onlyLatest = false) {
        try {
            console.log(`Fetching Steam reviews from: https://steamcommunity.com/profiles/${steamId}/recommended/${onlyLatest ? ' (latest only)' : ''}`);
            const response = await axios.get(`https://steamcommunity.com/profiles/${steamId}/recommended/`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            const $ = cheerio.load(response.data);
            const reviews = [];
            // Vérifier si le profil est privé
            if ($('body').hasClass('private_profile') || $('.profile_private_info').length > 0) {
                console.log('⚠️ Steam profile is private - no reviews accessible');
                return reviews;
            }
            // Vérifier s'il y a des avis sur la page (vraie structure Steam)
            const reviewElements = $('.review_box_content');
            if (reviewElements.length === 0) {
                console.log('ℹ️ No reviews found on this Steam profile');
                return reviews;
            }
            console.log(`Found ${reviewElements.length} review elements`);
            // Parcourir chaque avis sur la page (vraie structure Steam)
            for (let i = 0; i < reviewElements.length; i++) {
                if (onlyLatest && i > 0)
                    break; // Arrêter après le premier avis
                try {
                    const element = reviewElements[i];
                    const $element = $(element);
                    // Extraire le lien du jeu depuis .leftcol a
                    const gameLink = $element.find('.leftcol a').attr('href') || '';
                    const appId = this.extractAppIdFromUrl(gameLink);
                    // Extraire l'image de couverture
                    const coverImage = $element.find('.leftcol img.game_capsule').attr('src') || '';
                    // Extraire le type d'avis depuis .thumb img
                    const thumbImg = $element.find('.thumb img').attr('src') || '';
                    const isRecommended = thumbImg.includes('thumbsUp');
                    const rating = isRecommended ? 1 : 0; // 1 pour recommandé (👍), 0 pour non recommandé (👎)
                    // Extraire le texte de l'avis depuis .content en préservant les sauts de ligne
                    const contentElement = $element.find('.content');
                    let html = contentElement.html() || '';
                    html = html.replace(/<br\s*\/?>/gi, '\n');
                    html = html.replace(/<\/p>/gi, '\n');
                    const reviewText = cheerio.load(`<div>${html}</div>`)('div').text().trim();
                    // Extraire les heures de jeu depuis .hours
                    const hoursText = $element.find('.hours').text().trim();
                    // Extraire la date depuis .posted
                    const dateElement = $element.find('.posted');
                    const reviewDate = dateElement.text().trim() || new Date().toISOString();
                    // Récupérer le nom du jeu via une requête à la page du jeu
                    let gameTitle = await this.getGameTitle(appId);
                    // Construire l'URL de l'avis
                    const reviewUrl = `https://steamcommunity.com/profiles/${steamId}/recommended/${appId}/`;
                    console.log(`Processing review: appId=${appId}, rating=${rating}, text length=${reviewText.length}`);
                    // Vérifier qu'on a au moins un appId et du contenu
                    if (appId && (reviewText || rating !== undefined)) {
                        const review = {
                            title: gameTitle,
                            rating: rating,
                            reviewText: reviewText,
                            content: reviewText, // Pour compatibilité
                            reviewDate: this.formatSteamDate(reviewDate),
                            coverImage: coverImage || this.getGameImageUrl(appId),
                            gameUrl: `https://store.steampowered.com/app/${appId}/`,
                            reviewUrl: reviewUrl,
                            appId: appId,
                            hoursPlayed: hoursText
                        };
                        reviews.push(review);
                    }
                }
                catch (error) {
                    console.error('Error parsing Steam review element:', error);
                }
            }
            console.log(`Found ${reviews.length} Steam reviews`);
            return reviews;
        }
        catch (error) {
            console.error('Error fetching Steam reviews:', error);
            return [];
        }
    }
    async getGameDetails(appId) {
        try {
            const response = await axios.get(`https://store.steampowered.com/api/appdetails`, {
                params: {
                    appids: appId,
                    format: 'json'
                }
            });
            const gameData = response.data[appId.toString()];
            return gameData?.success ? gameData.data : null;
        }
        catch (error) {
            console.error('Error fetching game details:', error);
            return null;
        }
    }
    async getUserProfile(steamId) {
        try {
            const response = await axios.get(`${this.baseUrl}/ISteamUser/GetPlayerSummaries/v0002/`, {
                params: {
                    key: this.apiKey,
                    steamids: steamId,
                    format: 'json'
                }
            });
            const players = response.data.response.players;
            return players && players.length > 0 ? players[0] : null;
        }
        catch (error) {
            console.error('Error fetching Steam profile:', error);
            return null;
        }
    }
    // Méthode pour vérifier si un Steam ID est valide
    async isValidSteamId(steamId) {
        const profile = await this.getUserProfile(steamId);
        return !!profile;
    }
    // Convertir Steam ID vers différents formats si nécessaire
    convertSteamId(steamId) {
        // Si c'est déjà un Steam ID 64, on le retourne tel quel
        if (/^\d{17}$/.test(steamId)) {
            return steamId;
        }
        // Ici on pourrait ajouter la logique pour convertir d'autres formats
        // Pour l'instant, on assume que c'est déjà le bon format
        return steamId;
    }
    // Méthode pour obtenir l'URL de l'image d'un jeu
    getGameImageUrl(appId, imageHash) {
        if (!imageHash) {
            return `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
        }
        return `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${imageHash}.jpg`;
    }
    // Extraire l'App ID depuis une URL Steam
    extractAppIdFromUrl(url) {
        // Pattern pour URLs comme https://steamcommunity.com/app/993090
        const match = url.match(/\/app\/(\d+)/);
        if (match) {
            return parseInt(match[1], 10);
        }
        console.log(`Could not extract appId from URL: ${url}`);
        return 0;
    }
    // Récupérer le nom du jeu depuis la page Steam Community du jeu
    async getGameTitle(appId) {
        try {
            if (!appId)
                return `Jeu Steam ${appId}`;
            const response = await axios.get(`https://steamcommunity.com/app/${appId}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            const $ = cheerio.load(response.data);
            // Chercher le nom du jeu dans .apphub_AppName
            const appName = $('.apphub_AppName').text().trim();
            if (appName) {
                return appName;
            }
            // Fallback : chercher dans le titre de la page
            const title = $('title').text();
            const match = title.match(/Steam Community :: (.+)/);
            if (match) {
                return match[1].trim();
            }
            return `Jeu Steam ${appId}`;
        }
        catch (error) {
            console.error(`Error fetching game title for appId ${appId}:`, error.message);
            return `Jeu Steam ${appId}`;
        }
    }
    // Formater la date Steam
    formatSteamDate(dateString) {
        try {
            // Les dates Steam peuvent être au format "Évaluation publiée le 15 octobre." ou "Posted: December 15, 2023"
            let cleanDate = dateString
                .replace(/^Évaluation publiée le\s*/i, '')
                .replace(/^Posted:\s*/i, '')
                .replace(/\.$/, '') // Supprimer le point final
                .trim();
            // Convertir les mois français en anglais pour parsing
            const monthsMap = {
                'janvier': 'January', 'février': 'February', 'mars': 'March', 'avril': 'April',
                'mai': 'May', 'juin': 'June', 'juillet': 'July', 'août': 'August',
                'septembre': 'September', 'octobre': 'October', 'novembre': 'November', 'décembre': 'December'
            };
            // Remplacer les mois français
            Object.entries(monthsMap).forEach(([fr, en]) => {
                cleanDate = cleanDate.replace(new RegExp(fr, 'i'), en);
            });
            const date = new Date(cleanDate);
            return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
        }
        catch (error) {
            return new Date().toISOString();
        }
    }
}
