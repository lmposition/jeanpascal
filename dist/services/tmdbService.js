import axios from 'axios';
export class TMDBService {
    apiKey;
    baseUrl = 'https://api.themoviedb.org/3';
    imageBaseUrl = 'https://image.tmdb.org/t/p';
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async searchMovie(title, year) {
        try {
            console.log(`🔍 Searching TMDB for: "${title}"${year ? ` (${year})` : ''}`);
            const params = {
                api_key: this.apiKey,
                query: title,
                language: 'fr-FR' // Français en priorité
            };
            // Ajouter l'année si disponible pour une recherche plus précise
            if (year) {
                params.year = year;
            }
            const response = await axios.get(`${this.baseUrl}/search/movie`, {
                params
            });
            const results = response.data.results;
            if (results.length === 0) {
                console.log(`❌ No TMDB results for: "${title}"`);
                return null;
            }
            // Prendre le premier résultat (le plus pertinent)
            const movie = results[0];
            console.log(`✅ Found TMDB movie: "${movie.title}" (${movie.release_date?.split('-')[0]})`);
            return movie;
        }
        catch (error) {
            console.error('Error searching TMDB:', error);
            return null;
        }
    }
    getPosterUrl(posterPath, size = 'w500') {
        if (!posterPath)
            return null;
        return `${this.imageBaseUrl}/${size}${posterPath}`;
    }
    getBackdropUrl(backdropPath, size = 'w780') {
        if (!backdropPath)
            return null;
        return `${this.imageBaseUrl}/${size}${backdropPath}`;
    }
    // Méthode pour extraire l'année du titre s'il est au format "Titre (YYYY)"
    parseMovieTitle(fullTitle) {
        const match = fullTitle.match(/^(.+?)\s*\((\d{4})\)$/);
        if (match) {
            return {
                title: match[1].trim(),
                year: match[2]
            };
        }
        return { title: fullTitle.trim() };
    }
    // Méthode pour obtenir une image de film à partir du titre
    async getMovieImage(movieTitle) {
        const { title, year } = this.parseMovieTitle(movieTitle);
        const movie = await this.searchMovie(title, year);
        if (!movie)
            return null;
        // Préférer le poster, sinon le backdrop
        return this.getPosterUrl(movie.poster_path, 'w500') ||
            this.getBackdropUrl(movie.backdrop_path, 'w780');
    }
}
