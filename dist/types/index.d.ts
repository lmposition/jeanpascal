export interface User {
    id: number;
    discordId: string;
    platform: 'steam' | 'letterboxd' | 'senscritique';
    platformUserId: string;
    platformUsername: string;
    createdAt: string;
}
export interface Review {
    id: number;
    userId: number;
    platform: 'steam' | 'letterboxd' | 'senscritique';
    gameId?: string;
    movieId?: string;
    title: string;
    content: string;
    rating?: number;
    coverImage?: string;
    reviewUrl: string;
    reviewDate: string;
    createdAt: string;
    gameUrl?: string;
    isPosted?: boolean;
    retryCount?: number;
}
export interface SteamGame {
    appid: number;
    name: string;
    playtime_forever: number;
    img_icon_url?: string;
    img_logo_url?: string;
}
export interface SteamReview {
    recommendationid: string;
    author: {
        steamid: string;
        num_games_owned: number;
        num_reviews: number;
        playtime_forever: number;
        playtime_last_two_weeks: number;
        playtime_at_review: number;
        last_played: number;
    };
    language: string;
    review: string;
    timestamp_created: number;
    timestamp_updated: number;
    voted_up: boolean;
    votes_up: number;
    votes_funny: number;
    weighted_vote_score: string;
    comment_count: number;
    steam_purchase: boolean;
    received_for_free: boolean;
    written_during_early_access: boolean;
}
export interface LetterboxdReview {
    title: string;
    year?: string;
    rating?: number;
    reviewText: string;
    reviewDate: string;
    coverImage: string;
    movieUrl: string;
    reviewUrl?: string;
    guid?: string;
}
export interface Config {
    discordToken: string;
    steamApiKey: string;
    tmdbApiKey: string;
    translationApiKey: string;
    channelId: string;
    countdownChannelId: string;
}
