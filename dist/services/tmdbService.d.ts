export interface TMDBMovie {
    id: number;
    title: string;
    release_date: string;
    poster_path: string | null;
    backdrop_path: string | null;
    overview: string;
    vote_average: number;
}
export interface TMDBSearchResult {
    results: TMDBMovie[];
    total_results: number;
}
export declare class TMDBService {
    private apiKey;
    private baseUrl;
    private imageBaseUrl;
    constructor(apiKey: string);
    searchMovie(title: string, year?: string): Promise<TMDBMovie | null>;
    getPosterUrl(posterPath: string | null, size?: 'w154' | 'w342' | 'w500' | 'w780' | 'original'): string | null;
    getBackdropUrl(backdropPath: string | null, size?: 'w300' | 'w780' | 'w1280' | 'original'): string | null;
    parseMovieTitle(fullTitle: string): {
        title: string;
        year?: string;
    };
    getMovieImage(movieTitle: string): Promise<string | null>;
}
