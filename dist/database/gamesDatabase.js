import Database from 'better-sqlite3';
export class GamesDatabase {
    db;
    constructor(dbPath = 'games.db') {
        this.db = new Database(dbPath);
        this.initTables();
    }
    initTables() {
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
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_games_release_date ON tracked_games(release_date ASC);
      CREATE INDEX IF NOT EXISTS idx_games_igdb_id ON tracked_games(igdb_id);
      CREATE INDEX IF NOT EXISTS idx_release_messages_created ON release_messages(created_at);
    `);
    }
    addGame(igdbId, name, releaseDate) {
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
        }
        catch (error) {
            console.error('Error adding game:', error);
            return null;
        }
    }
    getGameByIgdbId(igdbId) {
        const stmt = this.db.prepare('SELECT * FROM tracked_games WHERE igdb_id = ?');
        const row = stmt.get(igdbId);
        if (!row)
            return null;
        return {
            id: row.id,
            igdbId: row.igdb_id,
            name: row.name,
            releaseDate: new Date(row.release_date),
            createdAt: row.created_at
        };
    }
    getAllGames() {
        const stmt = this.db.prepare('SELECT * FROM tracked_games ORDER BY release_date ASC');
        const rows = stmt.all();
        return rows.map(row => ({
            id: row.id,
            igdbId: row.igdb_id,
            name: row.name,
            releaseDate: new Date(row.release_date),
            createdAt: row.created_at
        }));
    }
    getUpcomingGames() {
        const now = new Date().toISOString();
        // Récupérer tous les jeux à venir, triés par date
        // Les jeux avec date TBD (année 9999) seront automatiquement en dernier
        const stmt = this.db.prepare('SELECT * FROM tracked_games WHERE release_date > ? ORDER BY release_date ASC');
        const rows = stmt.all(now);
        return rows.map(row => ({
            id: row.id,
            igdbId: row.igdb_id,
            name: row.name,
            releaseDate: new Date(row.release_date),
            createdAt: row.created_at
        }));
    }
    getReleasedGames() {
        const now = new Date().toISOString();
        const stmt = this.db.prepare('SELECT * FROM tracked_games WHERE release_date <= ? ORDER BY release_date DESC');
        const rows = stmt.all(now);
        return rows.map(row => ({
            id: row.id,
            igdbId: row.igdb_id,
            name: row.name,
            releaseDate: new Date(row.release_date),
            createdAt: row.created_at
        }));
    }
    removeGame(igdbId) {
        try {
            const stmt = this.db.prepare('DELETE FROM tracked_games WHERE igdb_id = ?');
            const result = stmt.run(igdbId);
            return result.changes > 0;
        }
        catch (error) {
            console.error('Error removing game:', error);
            return false;
        }
    }
    updateReleaseDate(igdbId, releaseDate) {
        try {
            const stmt = this.db.prepare('UPDATE tracked_games SET release_date = ? WHERE igdb_id = ?');
            const result = stmt.run(releaseDate.toISOString(), igdbId);
            return result.changes > 0;
        }
        catch (error) {
            console.error('Error updating release date:', error);
            return false;
        }
    }
    addReleaseMessage(igdbId, messageId) {
        try {
            const stmt = this.db.prepare('INSERT INTO release_messages (igdb_id, message_id) VALUES (?, ?)');
            stmt.run(igdbId, messageId);
            return true;
        }
        catch (error) {
            console.error('Error adding release message:', error);
            return false;
        }
    }
    getOldReleaseMessages(hoursOld = 24) {
        const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000).toISOString();
        const stmt = this.db.prepare('SELECT id, message_id as messageId, igdb_id as igdbId FROM release_messages WHERE created_at < ?');
        const rows = stmt.all(cutoffTime);
        return rows;
    }
    deleteReleaseMessage(id) {
        try {
            const stmt = this.db.prepare('DELETE FROM release_messages WHERE id = ?');
            const result = stmt.run(id);
            return result.changes > 0;
        }
        catch (error) {
            console.error('Error deleting release message:', error);
            return false;
        }
    }
    close() {
        this.db.close();
    }
}
