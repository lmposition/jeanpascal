// Script d'initialisation des jeux à suivre pour le système de countdown IGDB
// Usage: npm run init-games

import dotenv from 'dotenv';
import { GamesDatabase } from '../src/database/gamesDatabase.js';
import { IGDBService } from '../src/services/igdbService.js';

// Charger les variables d'environnement depuis .env
dotenv.config();

// Liste des jeux initiaux à ajouter au système de countdown
const INITIAL_GAMES = [
  'https://www.igdb.com/games/syberia-remastered',
  'https://www.igdb.com/games/call-of-duty-black-ops-7',
  'https://www.igdb.com/games/anno-117-pax-romana',
  'https://www.igdb.com/games/resident-evil-requiem'
];

async function initGames() {
  // Vérifier que les credentials IGDB sont présents
  if (!process.env.IGDB_CLIENT_ID || !process.env.IGDB_ACCESS_TOKEN) {
    console.error('Missing IGDB credentials in .env');
    process.exit(1);
  }

  // Initialiser la base de données et le service IGDB
  const gamesDb = new GamesDatabase();
  const igdbService = new IGDBService(process.env.IGDB_CLIENT_ID, process.env.IGDB_ACCESS_TOKEN);

  console.log('Initialisation des jeux...\n');

  // Parcourir chaque URL de jeu
  for (const url of INITIAL_GAMES) {
    try {
      // Extraire le slug depuis l'URL IGDB
      const slug = igdbService.extractSlugFromUrl(url);
      if (!slug) {
        console.error(`❌ URL invalide: ${url}`);
        continue;
      }

      // Rechercher le jeu sur IGDB
      console.log(`🔍 Recherche de: ${slug}`);
      const game = await igdbService.getGameBySlug(slug);

      // Vérifier que le jeu existe
      if (!game) {
        console.error(`❌ Jeu introuvable: ${slug}`);
        continue;
      }

      // Vérifier que le jeu a une date de sortie
      if (!game.releaseDate) {
        console.error(`⚠️  ${game.name} n'a pas de date de sortie`);
        continue;
      }

      // Ajouter le jeu à la base de données
      const added = gamesDb.addGame(game.id, game.name, game.releaseDate);
      if (added) {
        console.log(`✅ ${game.name} ajouté (sortie: ${game.releaseDate.toLocaleDateString('fr-FR')})`);
      } else {
        console.error(`❌ Erreur lors de l'ajout de ${game.name}`);
      }
    } catch (error) {
      console.error(`❌ Erreur pour ${url}:`, error);
    }
  }

  // Fermer la connexion à la base de données
  gamesDb.close();
  console.log('\n✅ Initialisation terminée');
}

// Exécuter le script
initGames().catch(console.error);
