/**
 * Script de vérification du nouveau système RSS Letterboxd
 * Usage: node verify-letterboxd-rss.js
 */

import { LetterboxdService } from './dist/services/letterboxdService.js';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';

async function testLetterboxdRSS() {
  console.log('🧪 TEST DU NOUVEAU SYSTÈME RSS LETTERBOXD\n');
  console.log('═'.repeat(80));
  
  const service = new LetterboxdService(TMDB_API_KEY);
  
  // Test 1: Validation d'un utilisateur
  console.log('\n📋 TEST 1: Validation d\'utilisateur');
  console.log('─'.repeat(80));
  const isValid = await service.isValidUsername('limposition');
  console.log(`Résultat: ${isValid ? '✅ VALIDE' : '❌ INVALIDE'}`);
  
  if (!isValid) {
    console.log('\n❌ L\'utilisateur n\'est pas valide, arrêt des tests.');
    return;
  }
  
  // Test 2: Récupération du dernier avis
  console.log('\n📋 TEST 2: Récupération du dernier avis');
  console.log('─'.repeat(80));
  const latestReview = await service.getUserReviews('limposition', true);
  
  if (latestReview.length > 0) {
    const review = latestReview[0];
    console.log('\n✅ Dernier avis récupéré:');
    console.log(`   Titre: ${review.title}`);
    console.log(`   Année: ${review.year || 'N/A'}`);
    console.log(`   Note: ${review.rating ? `${review.rating}/5` : 'Pas de note'}`);
    console.log(`   Date: ${review.reviewDate}`);
    console.log(`   URL: ${review.reviewUrl}`);
    console.log(`   Image: ${review.coverImage ? '✅ Présente' : '❌ Absente'}`);
    console.log(`   Contenu (${review.reviewText.length} caractères):`);
    console.log(`   "${review.reviewText.substring(0, 200)}${review.reviewText.length > 200 ? '...' : ''}"`);
  } else {
    console.log('❌ Aucun avis récupéré');
  }
  
  // Test 3: Récupération de tous les avis (limité à 5)
  console.log('\n📋 TEST 3: Récupération de tous les avis (max 5)');
  console.log('─'.repeat(80));
  const allReviews = await service.getUserReviews('limposition', false);
  console.log(`\n✅ ${allReviews.length} avis récupérés au total`);
  
  allReviews.slice(0, 5).forEach((review, index) => {
    console.log(`\n${index + 1}. ${review.title}`);
    console.log(`   Note: ${review.rating ? `${review.rating}/5` : 'Pas de note'}`);
    console.log(`   Contenu: ${review.reviewText ? `${review.reviewText.length} caractères` : 'Pas de contenu'}`);
  });
  
  console.log('\n' + '═'.repeat(80));
  console.log('✅ TESTS TERMINÉS\n');
}

// Exécution
testLetterboxdRSS().catch(error => {
  console.error('\n❌ ERREUR LORS DES TESTS:', error);
  process.exit(1);
});
