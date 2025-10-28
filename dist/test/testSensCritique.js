import { SensCritiqueService } from '../services/senscritiqueService.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * Script de test pour vérifier l'extraction des données SensCritique
 */
async function testSensCritiqueExtraction() {
    console.log('🎬 Test d\'extraction des données SensCritique...\n');
    // Chemins vers les fichiers HTML
    const mainPagePath = path.join(__dirname, '../../pages/senscritique.html');
    const contentPagePath = path.join(__dirname, '../../pages/sencritiquecontent.html');
    console.log('📁 Fichiers à analyser:');
    console.log(`   - Page principale: ${mainPagePath}`);
    console.log(`   - Page de contenu: ${contentPagePath}\n`);
    try {
        // Test 1: Extraction des données de base depuis la page principale
        console.log('📊 Test 1: Extraction des données de base...');
        const basicData = SensCritiqueService.extractFromFile(mainPagePath);
        if (basicData) {
            console.log('✅ Données de base extraites avec succès:');
            console.log(`   - Titre: "${basicData.title}"`);
            console.log(`   - Note: ${basicData.rating}/10`);
            console.log(`   - URL: ${basicData.reviewUrl}`);
        }
        else {
            console.log('❌ Échec de l\'extraction des données de base');
            return;
        }
        console.log('\n' + '='.repeat(50) + '\n');
        // Test 2: Extraction du contenu complet
        console.log('📝 Test 2: Extraction du contenu complet...');
        const fullContent = SensCritiqueService.extractFullContentFromFile(contentPagePath);
        if (fullContent) {
            console.log('✅ Contenu complet extrait avec succès:');
            console.log(`   - Longueur: ${fullContent.length} caractères`);
            console.log(`   - Aperçu: "${fullContent.substring(0, 100)}..."`);
        }
        else {
            console.log('❌ Échec de l\'extraction du contenu complet');
        }
        console.log('\n' + '='.repeat(50) + '\n');
        // Test 3: Traitement complet (combinaison des deux)
        console.log('🔄 Test 3: Traitement complet...');
        const completeReview = SensCritiqueService.processCompleteReview(mainPagePath, contentPagePath);
        if (completeReview) {
            console.log('✅ Critique complète traitée avec succès!\n');
            SensCritiqueService.displayReview(completeReview);
        }
        else {
            console.log('❌ Échec du traitement complet');
        }
    }
    catch (error) {
        console.error('❌ Erreur lors du test:', error);
    }
}
// Exécution du test si le script est appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
    testSensCritiqueExtraction();
}
export { testSensCritiqueExtraction };
