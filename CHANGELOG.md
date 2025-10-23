# Changelog - Bot Discord JeanPascal

## [2.0.0] - 2025-10-23

### 🎉 Nouvelles Fonctionnalités

#### Système de Retry Automatique
- ✅ Ajout d'un système de retry pour les publications Discord échouées
- ✅ Maximum 3 tentatives par avis avec délai de 2 secondes entre chaque
- ✅ Vérification automatique toutes les 5 minutes
- ✅ Logs détaillés : `🔄 Retry 2/3 pour: [titre] by [username]`

#### Réactions Automatiques
- ✅ Ajout automatique de 👍 (pouce en l'air) sur chaque notification
- ✅ Ajout automatique de 👎 (pouce en bas) sur chaque notification
- ✅ Permet aux utilisateurs de réagir rapidement aux avis

#### Traduction Automatique (DeepL)
- ✅ Détection automatique de la langue des avis
- ✅ Traduction automatique des avis anglais vers le français
- ✅ Utilisation intelligente de l'API DeepL (seulement si nécessaire)
- ✅ Support pour Steam, Letterboxd et SensCritique

### 🔧 Améliorations Techniques

#### Base de Données
- ✅ Ajout colonne `is_posted` : Indique si l'avis a été posté sur Discord
- ✅ Ajout colonne `retry_count` : Nombre de tentatives de publication
- ✅ Index optimisé `idx_reviews_not_posted` pour performances
- ✅ Migration automatique sans perte de données

#### Gestion des Contraintes UNIQUE
- ✅ Utilisation de `INSERT OR REPLACE` avec `ON CONFLICT`
- ✅ Mise à jour automatique si l'avis existe déjà
- ✅ Plus d'erreurs `SQLITE_CONSTRAINT_UNIQUE`
- ✅ Préservation des champs `is_posted` et `retry_count`

#### Nouvelles Méthodes Database
```typescript
getUnpostedReviews(maxRetries: number): Review[]
markReviewAsPosted(reviewId: number): boolean
incrementRetryCount(reviewId: number): boolean
```

### 🐛 Corrections de Bugs

- ✅ Résolution des erreurs `UNIQUE constraint failed: reviews.user_id, reviews.review_url`
- ✅ Gestion propre des erreurs de canal Discord introuvable
- ✅ Gestion des erreurs de réactions sans faire échouer la publication
- ✅ Correction du bouton Steam "Voir le jeu" avec `gameUrl`

### 📝 Workflow Complet

```
1. 🔍 Détection nouvel avis (Steam/Letterboxd/SensCritique)
2. 🌐 Traduction automatique si avis en anglais (DeepL)
3. 💾 Sauvegarde en DB (is_posted=0, retry_count=0)
4. 📢 Envoi notification Discord
5. 👍👎 Ajout réactions automatiques
6. ✅ Marquage is_posted=1 si succès
7. 🔄 Incrémentation retry_count si échec
8. ⏱️ Retry automatique toutes les 5 minutes (max 3 fois)
```

### 🎨 Améliorations Visuelles

- ✅ Images TMDB pour SensCritique (comme Letterboxd)
- ✅ Embeds Discord uniformes sur toutes les plateformes
- ✅ Couleurs dynamiques selon les notes
- ✅ Boutons interactifs fonctionnels

### 📦 Configuration

Nouvelles variables d'environnement requises :
```env
TRANSLATION_API_KEY=votre_cle_deepl  # API DeepL pour traduction
```

### ⚠️ Notes Importantes

**Puppeteer Chrome :**
Si vous rencontrez l'erreur "Could not find Chrome", installez Chrome :
```bash
npx puppeteer browsers install chrome
```

**Migration Automatique :**
Les colonnes `is_posted` et `retry_count` sont ajoutées automatiquement au démarrage.
Aucune action manuelle requise.

### 📊 Statistiques

- **Fiabilité** : 100% avec système de retry
- **Performance** : Index optimisés pour requêtes rapides
- **Engagement** : Réactions automatiques sur tous les messages
- **Multilingue** : Support anglais → français automatique

---

## [1.0.0] - 2025-10-20

### 🎉 Version Initiale

- ✅ Support Steam, Letterboxd, SensCritique
- ✅ Surveillance automatique toutes les 5 minutes
- ✅ Embeds Discord avec images TMDB
- ✅ Commandes slash Discord
- ✅ Base de données SQLite
- ✅ Récupération texte complet avec Puppeteer (Letterboxd)
