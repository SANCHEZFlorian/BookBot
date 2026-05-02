import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import db from '../../config/database.js';
import { createBaseEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embedBuilder.js';

export const command = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('(Admin) Construit l\'architecture Cosy (Catégories, Salons, Logs, Vocaux)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();
        const guild = interaction.guild;

        try {
            // --- 1. L'ACCUEIL ---
            const catAccueil = await guild.channels.create({ name: '╔═════ ‧₊˚ 📚 𝙰𝙲𝙲𝚄𝙴𝙸𝙻 ‧₊˚ ═════╗', type: ChannelType.GuildCategory });
            const welcomeChannel = await guild.channels.create({ name: '◦ 👋・bienvenue', type: ChannelType.GuildText, parent: catAccueil.id });
            await guild.channels.create({ name: '◦ 📜・règlement', type: ChannelType.GuildText, parent: catAccueil.id });
            await guild.channels.create({ name: '◦ 📖・agenda-lectures', type: ChannelType.GuildText, parent: catAccueil.id });
            await guild.channels.create({ name: '◦ 🎭・présentation', type: ChannelType.GuildText, parent: catAccueil.id });
            await guild.channels.create({ name: '◦ 📣・annonces-stream', type: ChannelType.GuildText, parent: catAccueil.id });
            const sessionChannel = await guild.channels.create({ name: '◦ ⏱️・sessions-annonces', type: ChannelType.GuildText, parent: catAccueil.id });

            // --- 2. THE PLACE ---
            const catPlace = await guild.channels.create({ name: '╔════ ‧₊˚ ☕ 𝚃𝙷𝙴 𝙿𝙻𝙰𝙲𝙴 ‧₊˚ ════╗', type: ChannelType.GuildCategory });
            await guild.channels.create({ name: '◦ ☕・blabla-chill', type: ChannelType.GuildText, parent: catPlace.id });
            await guild.channels.create({ name: '◦ 💡・recherche-conseils', type: ChannelType.GuildText, parent: catPlace.id });
            await guild.channels.create({ name: '◦ 🤖・command-bot', type: ChannelType.GuildText, parent: catPlace.id });
            const voiceHub = await guild.channels.create({ name: '◦ ➕・créer-un-cocon', type: ChannelType.GuildVoice, parent: catPlace.id });

            // --- 3. CHRONIQUES ---
            const catAvis = await guild.channels.create({ name: '╔═══ ‧₊˚ 🌟 𝙲𝙷𝚁𝙾𝙽𝙸𝚀𝚄𝙴𝚂 ‧₊˚ ════╗', type: ChannelType.GuildCategory });
            const reviewsChannel = await guild.channels.create({
                name: '◦ 🌟・derniers-avis',
                type: ChannelType.GuildForum,
                parent: catAvis.id,
                topic: 'Retrouvez ici tous les avis et chroniques de la communauté !'
            });
            await guild.channels.create({
                name: '◦ 🤫・discussions-spoilers',
                type: ChannelType.GuildForum,
                parent: catAvis.id,
                topic: 'Ici on discute sans filtre ! Créez un post pour chaque livre.'
            });

            // --- 4. ADMINISTRATION ---
            const catAdmin = await guild.channels.create({
                name: '╔══════ ‧₊˚ 🛠️ 𝙰𝙳𝙼𝙸𝙽 ‧₊˚ ══════╗',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }]
            });
            await guild.channels.create({ name: '◦ 🛡️・bureau-staff', type: ChannelType.GuildText, parent: catAdmin.id });
            const logMsg = await guild.channels.create({ name: '◦ 💬・logs-messages', type: ChannelType.GuildText, parent: catAdmin.id });
            const logVoice = await guild.channels.create({ name: '◦ 🔊・logs-vocaux', type: ChannelType.GuildText, parent: catAdmin.id });
            const logMember = await guild.channels.create({ name: '◦ 👥・logs-membres', type: ChannelType.GuildText, parent: catAdmin.id });

            // --- SAUVEGARDE EN BASE DE DONNÉES ---
            await db.query(
                `INSERT INTO guilds (
                    guild_id, guild_name, session_channel_id, voice_hub_id,
                    log_msg_id, log_voice_id, log_member_id, reviews_channel_id, welcome_channel_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    guild_name = VALUES(guild_name), session_channel_id = VALUES(session_channel_id),
                    voice_hub_id = VALUES(voice_hub_id),
                    log_msg_id = VALUES(log_msg_id), log_voice_id = VALUES(log_voice_id),
                    log_member_id = VALUES(log_member_id), reviews_channel_id = VALUES(reviews_channel_id),
                    welcome_channel_id = VALUES(welcome_channel_id)`,
                [
                    guild.id, guild.name, sessionChannel.id, voiceHub.id,
                    logMsg.id, logVoice.id, logMember.id, reviewsChannel.id, welcomeChannel.id
                ]
            );

            await interaction.editReply({ embeds: [createSuccessEmbed('Nouvelle architecture "The Place" déployée avec succès !')] });
        } catch (error) {
            console.error('[Setup] Erreur:', error);
            await interaction.editReply({ embeds: [createErrorEmbed('Une erreur est survenue lors de la création de l\'architecture.')] });
        }
    },
};
