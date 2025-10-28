import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
export class MigrateCommand {
    db;
    constructor(db) {
        this.db = db;
    }
    getSlashCommand() {
        return new SlashCommandBuilder()
            .setName('migrate')
            .setDescription('Force la migration de la base de données pour supporter SensCritique')
            .addBooleanOption(option => option.setName('force')
            .setDescription('Forcer la migration même si elle a déjà été effectuée')
            .setRequired(false));
    }
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const force = interaction.options.getBoolean('force') || false;
        try {
            // Accéder à la base de données interne
            const dbInstance = this.db.db;
            // Vérifier si la migration est nécessaire
            const tableInfo = dbInstance.prepare("PRAGMA table_info(users)").all();
            const platformColumn = tableInfo.find(col => col.name === 'platform');
            let needsMigration = true;
            if (platformColumn && !force) {
                // Vérifier si senscritique est déjà supporté en tentant d'insérer une valeur test
                try {
                    const testStmt = dbInstance.prepare("INSERT INTO users (discord_id, platform, platform_user_id, platform_username) VALUES (?, ?, ?, ?)");
                    const testTransaction = dbInstance.transaction(() => {
                        testStmt.run('test', 'senscritique', 'test', 'test');
                        dbInstance.prepare("DELETE FROM users WHERE discord_id = 'test'").run();
                    });
                    testTransaction();
                    needsMigration = false;
                }
                catch (error) {
                    needsMigration = true;
                }
            }
            if (!needsMigration && !force) {
                const embed = new EmbedBuilder()
                    .setColor('#51cf66')
                    .setTitle('✅ Migration déjà effectuée')
                    .setDescription('La base de données supporte déjà SensCritique. Utilisez `force: true` pour forcer la migration.')
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
                return;
            }
            // Effectuer la migration
            const migrationSteps = [];
            // Étape 1: Créer les nouvelles tables avec les bonnes contraintes
            migrationSteps.push("Création des nouvelles tables...");
            dbInstance.exec(`
                -- Créer une nouvelle table users avec les bonnes contraintes
                CREATE TABLE IF NOT EXISTS users_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    discord_id TEXT NOT NULL,
                    platform TEXT NOT NULL CHECK (platform IN ('steam', 'letterboxd', 'senscritique')),
                    platform_user_id TEXT NOT NULL,
                    platform_username TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(discord_id, platform)
                );
            `);
            dbInstance.exec(`
                -- Créer une nouvelle table reviews avec les bonnes contraintes
                CREATE TABLE IF NOT EXISTS reviews_new (
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
                    FOREIGN KEY (user_id) REFERENCES users_new (id),
                    UNIQUE(user_id, review_url)
                );
            `);
            // Étape 2: Copier les données existantes
            migrationSteps.push("Copie des données existantes...");
            const existingUsers = dbInstance.prepare("SELECT COUNT(*) as count FROM users").get();
            const existingReviews = dbInstance.prepare("SELECT COUNT(*) as count FROM reviews").get();
            if (existingUsers.count > 0) {
                dbInstance.exec(`
                    INSERT INTO users_new (id, discord_id, platform, platform_user_id, platform_username, created_at)
                    SELECT id, discord_id, platform, platform_user_id, platform_username, created_at
                    FROM users;
                `);
            }
            if (existingReviews.count > 0) {
                dbInstance.exec(`
                    INSERT INTO reviews_new (id, user_id, platform, game_id, movie_id, title, content, rating, cover_image, review_url, review_date, created_at)
                    SELECT id, user_id, platform, game_id, movie_id, title, content, rating, cover_image, review_url, review_date, created_at
                    FROM reviews;
                `);
            }
            // Étape 3: Remplacer les anciennes tables
            migrationSteps.push("Remplacement des tables...");
            dbInstance.exec(`
                DROP TABLE IF EXISTS reviews;
                DROP TABLE IF EXISTS users;
                ALTER TABLE users_new RENAME TO users;
                ALTER TABLE reviews_new RENAME TO reviews;
            `);
            // Étape 4: Recréer les index
            migrationSteps.push("Recréation des index...");
            dbInstance.exec(`
                CREATE INDEX IF NOT EXISTS idx_users_discord_platform ON users(discord_id, platform);
                CREATE INDEX IF NOT EXISTS idx_reviews_user_date ON reviews(user_id, review_date DESC);
                CREATE INDEX IF NOT EXISTS idx_reviews_platform_date ON reviews(platform, review_date DESC);
            `);
            // Vérification finale
            migrationSteps.push("Vérification finale...");
            const finalUsers = dbInstance.prepare("SELECT COUNT(*) as count FROM users").get();
            const finalReviews = dbInstance.prepare("SELECT COUNT(*) as count FROM reviews").get();
            // Test d'insertion SensCritique
            const testStmt = dbInstance.prepare("INSERT INTO users (discord_id, platform, platform_user_id, platform_username) VALUES (?, ?, ?, ?)");
            const testTransaction = dbInstance.transaction(() => {
                testStmt.run('migration_test', 'senscritique', 'test_user', 'Test User');
                dbInstance.prepare("DELETE FROM users WHERE discord_id = 'migration_test'").run();
            });
            testTransaction();
            const embed = new EmbedBuilder()
                .setColor('#51cf66')
                .setTitle('✅ Migration réussie')
                .setDescription('La base de données a été mise à jour avec succès pour supporter SensCritique !')
                .addFields({ name: '👥 Utilisateurs', value: `${finalUsers.count} conservés`, inline: true }, { name: '📝 Avis', value: `${finalReviews.count} conservés`, inline: true }, { name: '🔧 Étapes', value: migrationSteps.join('\n• '), inline: false }, { name: '✨ Nouveau support', value: '• Steam\n• Letterboxd\n• **SensCritique** 🎬', inline: false })
                .setFooter({ text: 'Vous pouvez maintenant utiliser /add senscritique <username>' })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        catch (error) {
            console.error('Erreur lors de la migration:', error);
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('❌ Erreur de migration')
                .setDescription(`Une erreur est survenue lors de la migration de la base de données.`)
                .addFields({ name: 'Erreur', value: `\`\`\`${error}\`\`\``, inline: false })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
    }
}
