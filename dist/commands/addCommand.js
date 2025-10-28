import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
export class AddCommand {
    db;
    steamService;
    letterboxdService;
    sensCritiqueService;
    constructor(db, steamService, letterboxdService, sensCritiqueService) {
        this.db = db;
        this.steamService = steamService;
        this.letterboxdService = letterboxdService;
        this.sensCritiqueService = sensCritiqueService;
    }
    getSlashCommand() {
        return new SlashCommandBuilder()
            .setName('add')
            .setDescription('Ajouter un utilisateur à surveiller pour les avis')
            .addStringOption(option => option.setName('platform')
            .setDescription('Plateforme à surveiller')
            .setRequired(true)
            .addChoices({ name: 'Steam', value: 'steam' }, { name: 'Letterboxd', value: 'letterboxd' }, { name: 'SensCritique', value: 'senscritique' }))
            .addStringOption(option => option.setName('username')
            .setDescription('Nom d\'utilisateur ou ID sur la plateforme')
            .setRequired(true));
    }
    async execute(interaction) {
        if (!interaction.isChatInputCommand())
            return;
        await interaction.deferReply();
        const platform = interaction.options.getString('platform');
        const username = interaction.options.getString('username');
        const discordUserId = interaction.user.id;
        try {
            // Vérifier si l'utilisateur existe déjà pour cette plateforme
            const existingUser = this.db.getUserByDiscordAndPlatform(discordUserId, platform);
            if (existingUser) {
                const embed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setTitle('❌ Utilisateur déjà ajouté')
                    .setDescription(`Vous avez déjà un compte ${platform} associé: **${existingUser.platformUsername}**`)
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
                return;
            }
            // Valider selon la plateforme
            let isValid = false;
            let platformUserId = username;
            let platformUsername = username;
            if (platform === 'steam') {
                // Convertir et valider le Steam ID
                platformUserId = this.steamService.convertSteamId(username);
                isValid = await this.steamService.isValidSteamId(platformUserId);
                if (isValid) {
                    const profile = await this.steamService.getUserProfile(platformUserId);
                    platformUsername = profile?.personaname || username;
                }
            }
            else if (platform === 'letterboxd') {
                // Extraire le username depuis l'URL si c'est un lien complet
                // Supporte: https://letterboxd.com/username/ ou https://letterboxd.com/username/rss/ ou juste username
                let extractedUsername = username;
                if (username.includes('letterboxd.com/')) {
                    // Extraire le username depuis l'URL
                    const match = username.match(/letterboxd\.com\/([^\/]+)/);
                    if (match) {
                        extractedUsername = match[1];
                    }
                }
                // Supprimer /rss/ si présent
                extractedUsername = extractedUsername.replace(/\/rss\/?$/, '').replace(/\/$/, '');
                isValid = await this.letterboxdService.isValidUsername(extractedUsername);
                platformUserId = extractedUsername;
                platformUsername = extractedUsername;
            }
            else if (platform === 'senscritique') {
                // Pour SensCritique, on considère que c'est valide si le nom d'utilisateur est fourni
                // TODO: Implémenter une vraie validation SensCritique
                isValid = !!(username && username.length > 0);
                platformUserId = username;
                platformUsername = username;
            }
            if (!isValid) {
                const embed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setTitle('❌ Utilisateur introuvable')
                    .setDescription(`L'utilisateur **${username}** n'existe pas sur ${platform}.`)
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
                return;
            }
            // Ajouter l'utilisateur à la base de données
            const newUser = this.db.addUser(discordUserId, platform, platformUserId, platformUsername);
            if (!newUser) {
                const embed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setTitle('❌ Erreur')
                    .setDescription('Une erreur est survenue lors de l\'ajout de l\'utilisateur.')
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
                return;
            }
            // Confirmation de succès
            const embed = new EmbedBuilder()
                .setColor('#51cf66')
                .setTitle('✅ Utilisateur ajouté avec succès')
                .setDescription(`**${platformUsername}** sur ${platform} a été ajouté à la surveillance des avis.`)
                .addFields({ name: 'Plateforme', value: platform, inline: true }, { name: 'Utilisateur', value: platformUsername, inline: true }, { name: 'Discord', value: `<@${discordUserId}>`, inline: true })
                .setTimestamp();
            // Ajouter une image selon la plateforme
            if (platform === 'steam') {
                embed.setThumbnail('https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg');
            }
            else if (platform === 'letterboxd') {
                embed.setThumbnail('https://letterboxd.com/static/img/letterboxd-logo-v-neg-rgb-1000px.png');
            }
            else if (platform === 'senscritique') {
                embed.setThumbnail('https://www.senscritique.com/static/img/favicon-3.png');
            }
            await interaction.editReply({ embeds: [embed] });
            // Optionnel: Récupérer immédiatement quelques avis récents pour test
            console.log(`Added user ${platformUsername} (${platform}) for Discord user ${discordUserId}`);
        }
        catch (error) {
            console.error('Error in add command:', error);
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('❌ Erreur')
                .setDescription('Une erreur inattendue est survenue.')
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
    }
}
