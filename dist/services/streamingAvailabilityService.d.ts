export interface StreamingResult {
    title: string;
    originalTitle: string;
    type: 'movie' | 'series';
    year: number;
    overview: string;
    posterUrl: string;
    rating: number;
    genres: string[];
    cast: string[];
    directors?: string[];
    creators?: string[];
    streamingOptions: {
        service: string;
        type: string;
        link: string;
        price?: string;
        logoUrl: string;
    }[];
}
export declare class StreamingAvailabilityService {
    private apiKey;
    private baseUrl;
    constructor(apiKey: string);
    searchByTitle(title: string, country?: string): Promise<StreamingResult | null>;
}
