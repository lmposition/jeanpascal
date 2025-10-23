import Database from 'better-sqlite3';
import { User, Review } from '../types/index.js';

export class ReviewDatabase {
  private db: Database.Database;

  constructor(dbPath: string = 'reviews.db') {
    this.db = new Database(dbPath);
    this.initTables();
  }

  private initTables(): void {
    // Table des utilisateurs
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT NOT NULL,
        platform TEXT NOT NULL CHECK (platform IN ('steam', 'letterboxd', 'senscritique')),
        platform_user_id TEXT NOT NULL,
        platform_username TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(discord_id, platform)
      )
    `);

    // Table des avis
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        platform TEXT NOT NULL CHECK (platform IN ('steam', 'letterboxd', 'senscritique')),
        game_id TEXT,
        movie_id TEXT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        rating REAL,
        cover_image TEXT,
        review_url TEXT NOT NULL,
        review_date DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        game_url TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(user_id, review_url)
      )
    `);

    // Ajouter la colonne game_url si elle n'existe pas (migration)
    try {
      this.db.exec(`ALTER TABLE reviews ADD COLUMN game_url TEXT`);
    } catch (error) {
      // La colonne existe déjà, ignorer l'erreur
    }

    // Ajouter les colonnes is_posted et retry_count si elles n'existent pas (migration)
    try {
      this.db.exec(`ALTER TABLE reviews ADD COLUMN is_posted INTEGER DEFAULT 0`);
    } catch (error) {
      // La colonne existe déjà, ignorer l'erreur
    }

    try {
      this.db.exec(`ALTER TABLE reviews ADD COLUMN retry_count INTEGER DEFAULT 0`);
    } catch (error) {
      // La colonne existe déjà, ignorer l'erreur
    }

    // Index pour améliorer les performances
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_discord_platform ON users(discord_id, platform);
      CREATE INDEX IF NOT EXISTS idx_reviews_user_date ON reviews(user_id, review_date DESC);
      CREATE INDEX IF NOT EXISTS idx_reviews_platform_date ON reviews(platform, review_date DESC);
      CREATE INDEX IF NOT EXISTS idx_reviews_not_posted ON reviews(is_posted, retry_count);
    `);
  }

  // Méthodes pour les utilisateurs
  addUser(discordId: string, platform: 'steam' | 'letterboxd' | 'senscritique', platformUserId: string, platformUsername: string): User | null {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO users (discord_id, platform, platform_user_id, platform_username)
        VALUES (?, ?, ?, ?)
      `);
      
      const result = stmt.run(discordId, platform, platformUserId, platformUsername);
      
      return this.getUserById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error adding user:', error);
      return null;
    }
  }

  getUserById(id: number): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      discordId: row.discord_id,
      platform: row.platform,
      platformUserId: row.platform_user_id,
      platformUsername: row.platform_username,
      createdAt: row.created_at
    };
  }

  getUserByDiscordAndPlatform(discordId: string, platform: 'steam' | 'letterboxd' | 'senscritique'): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE discord_id = ? AND platform = ?');
    const row = stmt.get(discordId, platform) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      discordId: row.discord_id,
      platform: row.platform,
      platformUserId: row.platform_user_id,
      platformUsername: row.platform_username,
      createdAt: row.created_at
    };
  }

  getAllUsers(): User[] {
    const stmt = this.db.prepare('SELECT * FROM users ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      id: row.id,
      discordId: row.discord_id,
      platform: row.platform,
      platformUserId: row.platform_user_id,
      platformUsername: row.platform_username,
      createdAt: row.created_at
    }));
  }

  getUserByPlatformUsername(username: string, platform: 'steam' | 'letterboxd' | 'senscritique'): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE platform_username = ? AND platform = ?');
    const row = stmt.get(username, platform) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      discordId: row.discord_id,
      platform: row.platform,
      platformUserId: row.platform_user_id,
      platformUsername: row.platform_username,
      createdAt: row.created_at
    };
  }

  // Méthodes pour les avis
  addReview(review: Omit<Review, 'id' | 'createdAt'>): Review | null {
    try {
      // Utiliser INSERT OR REPLACE pour gérer les contraintes UNIQUE
      const stmt = this.db.prepare(`
        INSERT INTO reviews (user_id, platform, game_id, movie_id, title, content, rating, cover_image, review_url, review_date, game_url, is_posted, retry_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, review_url) DO UPDATE SET
          title = excluded.title,
          content = excluded.content,
          rating = excluded.rating,
          cover_image = excluded.cover_image,
          review_date = excluded.review_date,
          game_url = excluded.game_url
      `);
      
      const result = stmt.run(
        review.userId,
        review.platform,
        review.gameId || null,
        review.movieId || null,
        review.title,
        review.content,
        review.rating || null,
        review.coverImage || null,
        review.reviewUrl,
        review.reviewDate,
        review.gameUrl || null,
        review.isPosted ? 1 : 0,
        review.retryCount || 0
      );
      
      // Récupérer l'avis (soit nouvellement inséré, soit mis à jour)
      return this.getReviewByUserAndUrl(review.userId, review.reviewUrl);
    } catch (error) {
      console.error('Error adding review:', error);
      return null;
    }
  }

  getReviewById(id: number): Review | null {
    const stmt = this.db.prepare('SELECT * FROM reviews WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      userId: row.user_id,
      platform: row.platform,
      gameId: row.game_id,
      movieId: row.movie_id,
      title: row.title,
      content: row.content,
      rating: row.rating,
      coverImage: row.cover_image,
      reviewUrl: row.review_url,
      reviewDate: row.review_date,
      createdAt: row.created_at,
      gameUrl: row.game_url,
      isPosted: row.is_posted === 1,
      retryCount: row.retry_count || 0
    };
  }

  getReviewsByUser(userId: number): Review[] {
    const stmt = this.db.prepare('SELECT * FROM reviews WHERE user_id = ? ORDER BY review_date DESC');
    const rows = stmt.all(userId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      platform: row.platform,
      gameId: row.game_id,
      movieId: row.movie_id,
      title: row.title,
      content: row.content,
      rating: row.rating,
      coverImage: row.cover_image,
      reviewUrl: row.review_url,
      reviewDate: row.review_date,
      createdAt: row.created_at,
      gameUrl: row.game_url
    }));
  }

  getReviewByUserAndUrl(userId: number, reviewUrl: string): Review | null {
    const stmt = this.db.prepare('SELECT * FROM reviews WHERE user_id = ? AND review_url = ?');
    const row = stmt.get(userId, reviewUrl) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      userId: row.user_id,
      platform: row.platform,
      gameId: row.game_id,
      movieId: row.movie_id,
      title: row.title,
      content: row.content,
      rating: row.rating,
      coverImage: row.cover_image,
      reviewUrl: row.review_url,
      reviewDate: row.review_date,
      createdAt: row.created_at,
      gameUrl: row.game_url,
      isPosted: row.is_posted === 1,
      retryCount: row.retry_count || 0
    };
  }

  reviewExists(userId: number, reviewUrl: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM reviews WHERE user_id = ? AND review_url = ?');
    return !!stmt.get(userId, reviewUrl);
  }

  getLatestReviewByUser(userId: number): Review | null {
    const stmt = this.db.prepare(`
      SELECT * FROM reviews 
      WHERE user_id = ? 
      ORDER BY review_date DESC 
      LIMIT 1
    `);
    const row = stmt.get(userId) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      userId: row.user_id,
      platform: row.platform,
      gameId: row.game_id,
      movieId: row.movie_id,
      title: row.title,
      content: row.content,
      rating: row.rating,
      coverImage: row.cover_image,
      reviewUrl: row.review_url,
      reviewDate: row.review_date,
      createdAt: row.created_at,
      gameUrl: row.game_url,
      isPosted: row.is_posted === 1,
      retryCount: row.retry_count || 0
    };
  }

  // Méthodes pour gérer les avis non postés
  getUnpostedReviews(maxRetries: number = 3): Review[] {
    const stmt = this.db.prepare(`
      SELECT * FROM reviews 
      WHERE is_posted = 0 AND retry_count < ? 
      ORDER BY created_at ASC
    `);
    const rows = stmt.all(maxRetries) as any[];
    
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      platform: row.platform,
      gameId: row.game_id,
      movieId: row.movie_id,
      title: row.title,
      content: row.content,
      rating: row.rating,
      coverImage: row.cover_image,
      reviewUrl: row.review_url,
      reviewDate: row.review_date,
      createdAt: row.created_at,
      gameUrl: row.game_url,
      isPosted: row.is_posted === 1,
      retryCount: row.retry_count || 0
    }));
  }

  markReviewAsPosted(reviewId: number): boolean {
    try {
      const stmt = this.db.prepare(`
        UPDATE reviews 
        SET is_posted = 1 
        WHERE id = ?
      `);
      stmt.run(reviewId);
      return true;
    } catch (error) {
      console.error('Error marking review as posted:', error);
      return false;
    }
  }

  incrementRetryCount(reviewId: number): boolean {
    try {
      const stmt = this.db.prepare(`
        UPDATE reviews 
        SET retry_count = retry_count + 1 
        WHERE id = ?
      `);
      stmt.run(reviewId);
      return true;
    } catch (error) {
      console.error('Error incrementing retry count:', error);
      return false;
    }
  }

  close(): void {
    this.db.close();
  }
}
