# Système de Countdown IGDB

## Configuration

### Variables d'environnement requises

Ajoutez ces variables à votre fichier `.env`:

```env
# IGDB API (https://api-docs.igdb.com/)
IGDB_CLIENT_ID=votre_client_id
IGDB_ACCESS_TOKEN=votre_access_token

# Canal Discord pour le countdown (optionnel, utilise CHANNEL_ID par défaut)
COUNTDOWN_CHANNEL_ID=1234567890
```

### Obtenir les credentials IGDB

1. Créez un compte sur [Twitch Developers](https://dev.twitch.tv/)
2. Créez une application pour obtenir le Client ID et Client Secret
3. Obtenez un access token avec cette requête:

```bash
curl -X POST 'https://id.twitch.tv/oauth2/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=VOTRE_CLIENT_ID&client_secret=VOTRE_CLIENT_SECRET&grant_type=client_credentials'
```

## Fonctionnalités

### 1. Commande `/follow`

Ajouter un jeu à suivre via son ID IGDB ou son URL.

```
/follow igdb_id: 123456
/follow igdb_id: https://www.igdb.com/games/nom-du-jeu
```

**Exemples:**
- Par ID: `/follow igdb_id: 123456`
- Par URL: `/follow igdb_id: https://www.igdb.com/games/resident-evil-requiem`

**Gestion des jeux sans date (TBD):**
- Les jeux sans date de sortie sont acceptés et marqués comme "TBD"
- Ils apparaissent en **dernier** dans la liste (après tous les jeux avec date)
- Quand IGDB ajoute une date, elle sera automatiquement mise à jour lors des vérifications bi-quotidiennes

### 2. Embed de Countdown

- Affiche les **9 prochains jeux** à sortir avec leur compte à rebours
- **Mise à jour automatique toutes les 3 secondes**
- **Format: Fields inline** (3 jeux par ligne) avec nom du jeu en gras et countdown en dessous
- **Couleur aléatoire** à chaque mise à jour (3 secondes)
- **Thumbnail**: Cover du prochain jeu à sortir (premier en liste)
- **Image**: Screenshots du prochain jeu qui défilent (changement 1 sync sur 2 = toutes les 6 secondes)
- **Jeux TBD**: Affichés en dernier avec la mention "TBD" au lieu du countdown
- **Countdown format**:
  - Plus de 24h: `Xj Xh Xm` (sans secondes)
  - Moins de 24h: `Xh Xm Xs` (avec secondes)
- **Footer**: Indique le nombre de jeux supplémentaires si plus de 9 jeux suivis

### 3. Annonce de Sortie

Quand un jeu sort, un **embed spécial** est créé avec:
- 🎉 Titre: "{Nom du jeu} est sorti !"
- **Thumbnail**: Cover du jeu (récupérée depuis IGDB)
- **Description**: Résumé du jeu (récupéré depuis IGDB)
- **Image**: GIF animé https://media.tenor.com/eorzo18pmJoAAAAM/cringe.gif
- Couleur: Vert (#57F287)
- **Suppression automatique après 24h**

### 4. Vérification Automatique

**Toutes les 3 secondes (à chaque mise à jour):**
- Vérifie si un jeu est sorti (date <= maintenant)
- Envoie immédiatement l'embed de sortie
- Retire le jeu de la base de données et de l'embed

**2 fois par jour (toutes les 12h):**
- Vérifie les dates de sortie sur IGDB
- Met à jour les dates si elles ont changé
- **Jeux TBD**: Vérifie si une date est maintenant disponible et met à jour automatiquement

**Toutes les heures:**
- Nettoie les messages de sortie de plus de 24h

### 5. Base de Données

Fichier: `games.db`

**Structure:**
```sql
CREATE TABLE tracked_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  igdb_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  release_date DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE release_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  igdb_id INTEGER NOT NULL,
  message_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Initialisation

### Ajouter les jeux initiaux

Un script est fourni pour ajouter les 4 jeux demandés:

```bash
npm run init-games
# ou
npx tsx scripts/init-games.ts
```

**Jeux ajoutés:**
- Syberia Remastered
- Call of Duty: Black Ops 7
- Anno 117: Pax Romana
- Resident Evil: Requiem

### Ajouter manuellement via Discord

Utilisez la commande `/follow` avec l'URL ou l'ID IGDB du jeu.

## Architecture

### Fichiers créés

```
src/
├── database/
│   └── gamesDatabase.ts        # Gestion de la base de données des jeux
├── services/
│   ├── igdbService.ts          # API IGDB
│   └── gameCountdownService.ts # Gestion du countdown et vérifications
└── commands/
    └── followCommand.ts        # Commande /follow

scripts/
└── init-games.ts               # Script d'initialisation
```

### Flux de données

1. **Ajout d'un jeu** (`/follow`)
   - Récupération des infos depuis IGDB
   - Validation de la date de sortie
   - Stockage en base de données
   - Mise à jour de l'embed

2. **Countdown** (toutes les 5s)
   - Lecture de la base de données locale
   - Calcul du temps restant
   - Mise à jour de l'embed Discord

3. **Vérification** (2x/jour)
   - Pour chaque jeu en base:
     - Requête IGDB pour la date actuelle
     - Comparaison avec la date en base
     - Mise à jour si différente
     - Si sorti: annonce + suppression

## Format des Embeds

### Embed de Countdown

```
Sorties de jeux à venir

[Thumbnail: Cover du prochain jeu]

**Syberia Remastered**
15j 3h 24m 12s

**Call of Duty: Black Ops 7**
120j 5h 0m 45s

**Anno 117: Pax Romana**
5j 12h 30m 15s

[Image: Screenshot large du prochain jeu]
```

**Caractéristiques:**
- Un field par jeu (inline - 3 par ligne)
- Nom en gras
- Countdown en dessous
- Mise à jour toutes les 3 secondes
- Couleur aléatoire à chaque mise à jour
- Thumbnail: Cover du prochain jeu à sortir (premier en liste)
- Image: Screenshots du prochain jeu qui défilent automatiquement
  - Changement de screenshot 1 sync sur 2 (toutes les 6 secondes)
  - Boucle sur tous les screenshots disponibles du jeu
- Tri par date de sortie (plus proche en premier)
- Jeux TBD affichés en dernier

### Embed de Sortie

```
🎉 Syberia Remastered est sorti !

[Thumbnail: Cover du jeu]

Description du jeu récupérée depuis IGDB...

[Image: GIF animé]
```

**Caractéristiques:**
- Cover en thumbnail
- Description complète
- GIF de célébration
- Suppression automatique après 24h

## Notes Techniques

### Optimisations

- **Countdown local**: Calcul basé sur la date en DB, pas de requête API
- **Vérifications espacées**: 2x/jour pour éviter le rate limiting IGDB
- **Base de données SQLite**: Rapide et légère
- **Mise à jour Discord**: Édition du message existant (pas de spam)

### Gestion des Sorties

Quand un jeu sort:
1. Message envoyé: `{nom du jeu} est sorti`
2. Jeu retiré de la base de données
3. Embed mis à jour automatiquement
4. Plus de countdown pour ce jeu

### Rate Limiting

- IGDB: 4 requêtes par seconde
- Discord: 5 éditions de message par 5 secondes
- Le système respecte ces limites avec les intervalles configurés
