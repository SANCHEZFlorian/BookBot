import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createBaseEmbed } from '../../utils/embedBuilder.js';
import db from '../../config/database.js';
import { getLevelInfo } from '../../services/levelService.js';

export const command = {
    data: new SlashCommandBuilder()
        .setName('menu')
        .setDescription('Ouvre le panneau de contrôle interactif de BookBot'),
        
    async execute(interaction) {
        await sendDashboard(interaction);
    },
};

export async function sendDashboard(interaction, isUpdate = false) {
    if (!isUpdate) {
        await interaction.deferReply({ ephemeral: true });
    }

    const userId = interaction.user.id;

    // S'assurer que l'utilisateur existe
    await db.query(`INSERT IGNORE INTO users (user_id, display_name) VALUES (?, ?)`, [userId, interaction.user.username]);

    // Récupérer les stats
    const levelInfo = await getLevelInfo(userId);
    const [bookStats] = await db.query(
        `SELECT 
            COUNT(*) as total_books,
            SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as finished_books,
            SUM(CASE WHEN status = 'reading' THEN 1 ELSE 0 END) as current_books
         FROM books WHERE user_id = ?`,
        [userId]
    );

    const stats = bookStats[0] || { total_books: 0, finished_books: 0, current_books: 0 };
    const currentLvlName = levelInfo?.current?.name || 'Novice';
    const currentLvlEmoji = levelInfo?.current?.emoji || '📖';

    const embed = createBaseEmbed()
        .setTitle('🏠 Tableau de Bord BookBot')
        .setDescription(`Bienvenue <@${userId}> !\nUtilisez les boutons ci-dessous pour gérer votre lecture.`)
        .addFields(
            { name: '👤 Profil Rapide', value: `${currentLvlEmoji} **${currentLvlName}**\nPages lues : ${levelInfo?.totalPages || 0}`, inline: true },
            { name: '📚 Bibliothèque', value: `${stats.current_books} en cours\n${stats.total_books - stats.finished_books} dans la PAL`, inline: true }
        )
        .setThumbnail(interaction.user.displayAvatarURL());

    // Ligne 1 : Pile à Lire
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('menu_pal_voir').setLabel('📖 Ma PAL').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('menu_pal_ajouter').setLabel('➕ Ajouter Livre').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('menu_pal_maj').setLabel('🎯 Maj Progression').setStyle(ButtonStyle.Secondary)
    );

    // Ligne 2 : Sessions & Stream
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('menu_session').setLabel('⏱️ Sessions Lecture').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('menu_stream').setLabel('🎥 Stream / Overlay').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('menu_aide').setLabel('❓ Aide').setStyle(ButtonStyle.Secondary)
    );

    // Ligne 3 : Musique & Profil complet
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('menu_musique').setLabel('🎵 Musique').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('menu_profil').setLabel('👤 Profil Complet').setStyle(ButtonStyle.Secondary)
    );

    if (isUpdate) {
        await interaction.update({ embeds: [embed], components: [row1, row2, row3] });
    } else {
        await interaction.editReply({ embeds: [embed], components: [row1, row2, row3] });
    }
}
