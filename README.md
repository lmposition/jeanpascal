# MR Jean-Pascal Review Bot

Bot Discord qui surveille et partage automatiquement les derniers avis des membres sur Steam et Letterboxd.

## 🚀 Fonctionnalités

- **Surveillance automatique** : Vérifie les nouveaux avis toutes les 5 minutes
- **Support multi-plateformes** : Steam et Letterboxd
- **Base de données SQLite** : Stockage local des utilisateurs et avis
- **Embeds Discord élégants** : Notifications avec images et formatage
- **Commande `/add`** : Ajouter facilement des utilisateurs à surveiller

## 📋 Prérequis

- Node.js 18+
- Un bot Discord avec token
- Clé API Steam
- TypeScript

## 🛠️ Installation

1. **Cloner le projet**
```bash
git clone <repository-url>
cd jeanpascal
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configuration**
Créer un fichier `.env` :
```env
DISCORD_TOKEN=votre_token_discord
STEAM_API_KEY=votre_cle_api_steam
CHANNEL_ID=id_du_canal_notifications
```

4. **Compiler TypeScript**
```bash
npm run build
```

5. **Démarrer le bot**
```bash
npm start
```

## 🎮 Utilisation

### Commandes Discord

- `/add steam <steamid64>` - Ajouter un utilisateur Steam
- `/add letterboxd <username>` - Ajouter un utilisateur Letterboxd
- `/lastreview <platform> [username]` - Afficher le dernier avis d'un utilisateur

### Exemples
```
/add steam 76561198000000000
/add letterboxd limposition
/lastreview letterboxd limposition
/lastreview letterboxd (pour voir votre propre dernier avis)
```

## 🏗️ Structure du projet

```
src/
├── commands/           # Commandes Discord
│   ├── addCommand.ts
│   └── lastReviewCommand.ts
├── database/          # Gestion base de données
│   └── database.ts
├── services/          # Services métier
│   ├── steamService.ts
│   ├── letterboxdService.ts
│   └── reviewMonitor.ts
├── types/             # Types TypeScript
│   └── index.ts
└── index.ts           # Point d'entrée
```

## 🔧 Configuration avancée

### Variables d'environnement

| Variable | Description | Requis |
|----------|-------------|---------|
| `DISCORD_TOKEN` | Token du bot Discord | ✅ |
| `STEAM_API_KEY` | Clé API Steam | ✅ |
| `TMDB_API_KEY` | Clé API TMDB pour les images | ✅ |
| `CHANNEL_ID` | ID du canal pour notifications | ❌ |

### Obtenir les clés API

- **Discord Token** : [Discord Developer Portal](https://discord.com/developers/applications)
- **Steam API Key** : [Steam Web API](https://steamcommunity.com/dev/apikey)
- **TMDB API Key** : [The Movie Database API](https://developer.themoviedb.org/docs/getting-started)

## 📊 Base de données

Le bot utilise SQLite avec deux tables principales :

- **users** : Utilisateurs surveillés
- **reviews** : Avis collectés

## 🎨 Embeds Discord

Les notifications incluent :
- **Images haute qualité** via TMDB API pour Letterboxd
- **Notes avec étoiles emoji** : ⭐⭐⭐✨ (3.5/5) pour Letterboxd
- **Texte de l'avis** (tronqué si nécessaire)
- **Date de publication** formatée
- **Lien vers l'avis original**
- **Couleurs spécifiques** par plateforme (Steam: #1B2838, Letterboxd: #00D735)
- **Logo Letterboxd** : favicon.ico officiel

## 🔄 Surveillance automatique

- **Fréquence** : Toutes les 5 minutes
- **Rate limiting** : Délais entre requêtes
- **Détection** : Nouveaux avis uniquement

## 🐛 Limitations connues

- **Steam** : Pas d'API directe pour les avis utilisateur
- **Letterboxd** : Scraping HTML (peut être fragile)
- **Rate limiting** : Respecté pour éviter les blocages

## 🚧 Développement

### Scripts disponibles

```bash
npm run dev      # Mode développement avec watch
npm run build    # Compiler TypeScript
npm run start    # Démarrer en production
npm run clean    # Nettoyer le dossier dist
```

### Technologies utilisées

- **Discord.js v14** : Interaction avec Discord
- **TypeScript** : Typage statique
- **Better-sqlite3** : Base de données
- **Cheerio** : Scraping HTML
- **Axios** : Requêtes HTTP
- **Node-cron** : Tâches planifiées

## 📝 TODO

- [ ] Support de SensCritique
- [ ] Interface web de gestion
- [ ] Statistiques d'utilisation
- [ ] Système de notifications personnalisées
- [ ] API REST pour intégrations externes

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :

1. Fork le projet
2. Créer une branche feature
3. Commit vos changements
4. Push vers la branche
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT.
