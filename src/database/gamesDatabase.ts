import Database from 'better-sqlite3';

export interface TrackedGame {
  id?: number;
  igdbId: number;
  name: string;
  releaseDate: Date;
  createdAt?: string;
  dateOverride?: boolean;
}

export class GamesDatabase {
  private db: Database.Database;

  constructor(dbPath: string = 'games.db') {
    this.db = new Database(dbPath);
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tracked_games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        igdb_id INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL,
        release_date DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS release_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        igdb_id INTEGER NOT NULL,
        message_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      this.db.exec(`ALTER TABLE tracked_games ADD COLUMN date_override INTEGER DEFAULT 0`);
    } catch (error) {
    }

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_games_release_date ON tracked_games(release_date ASC);
      CREATE INDEX IF NOT EXISTS idx_games_igdb_id ON tracked_games(igdb_id);
      CREATE INDEX IF NOT EXISTS idx_release_messages_created ON release_messages(created_at);
    `);
  }

  addGame(igdbId: number, name: string, releaseDate: Date): TrackedGame | null {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO tracked_games (igdb_id, name, release_date)
        VALUES (?, ?, ?)
        ON CONFLICT(igdb_id) DO UPDATE SET
          name = excluded.name,
          release_date = excluded.release_date
      `);
      
      stmt.run(igdbId, name, releaseDate.toISOString());
      
      return this.getGameByIgdbId(igdbId);
    } catch (error) {
      console.error('Error adding game:', error);
      return null;
    }
  }

  getGameByIgdbId(igdbId: number): TrackedGame | null {
    const stmt = this.db.prepare('SELECT * FROM tracked_games WHERE igdb_id = ?');
    const row = stmt.get(igdbId) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      igdbId: row.igdb_id,
      name: row.name,
      releaseDate: new Date(row.release_date),
      createdAt: row.created_at,
      dateOverride: row.date_override === 1
    };
  }

  getAllGames(): TrackedGame[] {
    const stmt = this.db.prepare('SELECT * FROM tracked_games ORDER BY release_date ASC');
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      id: row.id,
      igdbId: row.igdb_id,
      name: row.name,
      releaseDate: new Date(row.release_date),
      createdAt: row.created_at,
      dateOverride: row.date_override === 1
    }));
  }

  getUpcomingGames(): TrackedGame[] {
    const now = new Date().toISOString();
    const stmt = this.db.prepare('SELECT * FROM tracked_games WHERE release_date > ? ORDER BY release_date ASC');
    const rows = stmt.all(now) as any[];
    
    return rows.map(row => ({
      id: row.id,
      igdbId: row.igdb_id,
      name: row.name,
      releaseDate: new Date(row.release_date),
      createdAt: row.created_at,
      dateOverride: row.date_override === 1
    }));
  }

  getReleasedGames(): TrackedGame[] {
    const now = new Date().toISOString();
    const stmt = this.db.prepare('SELECT * FROM tracked_games WHERE release_date <= ? ORDER BY release_date DESC');
    const rows = stmt.all(now) as any[];
    
    return rows.map(row => ({
      id: row.id,
      igdbId: row.igdb_id,
      name: row.name,
      releaseDate: new Date(row.release_date),
      createdAt: row.created_at,
      dateOverride: row.date_override === 1
    }));
  }

  removeGame(igdbId: number): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM tracked_games WHERE igdb_id = ?');
      const result = stmt.run(igdbId);
      return result.changes > 0;
    } catch (error) {
      console.error('Error removing game:', error);
      return false;
    }
  }

  updateReleaseDate(igdbId: number, releaseDate: Date): boolean {
    try {
      const stmt = this.db.prepare('UPDATE tracked_games SET release_date = ? WHERE igdb_id = ? AND date_override = 0');
      const result = stmt.run(releaseDate.toISOString(), igdbId);
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating release date:', error);
      return false;
    }
  }

  overrideReleaseDate(igdbId: number, releaseDate: Date): boolean {
    try {
      const stmt = this.db.prepare('UPDATE tracked_games SET release_date = ?, date_override = 1 WHERE igdb_id = ?');
      const result = stmt.run(releaseDate.toISOString(), igdbId);
      return result.changes > 0;
    } catch (error) {
      console.error('Error overriding release date:', error);
      return false;
    }
  }

  addReleaseMessage(igdbId: number, messageId: string): boolean {
    try {
      const stmt = this.db.prepare('INSERT INTO release_messages (igdb_id, message_id) VALUES (?, ?)');
      stmt.run(igdbId, messageId);
      return true;
    } catch (error) {
      console.error('Error adding release message:', error);
      return false;
    }
  }

  getOldReleaseMessages(hoursOld: number = 24): Array<{id: number, messageId: string, igdbId: number}> {
    const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000).toISOString();
    const stmt = this.db.prepare('SELECT id, message_id as messageId, igdb_id as igdbId FROM release_messages WHERE created_at < ?');
    const rows = stmt.all(cutoffTime) as any[];
    return rows;
  }

  deleteReleaseMessage(id: number): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM release_messages WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting release message:', error);
      return false;
    }
  }

  close(): void {
    this.db.close();
  }
}
