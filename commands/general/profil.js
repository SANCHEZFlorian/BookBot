import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../../config/database.js';
import { getLevelInfo } from '../../services/levelService.js';
import { createBaseEmbed, createErrorEmbed } from '../../utils/embedBuilder.js';

export const command = {
    data: new SlashCommandBuilder()
        .setName('profil')
        .setDescription('Affiche vos statistiques de lecture et votre grade')
        .addUserOption(option => 
            option.setName('membre')
                .setDescription('Voir le profil d\'un autre lecteur')
                .setRequired(false)
        ),
        
    async execute(interaction) {
        await interaction.deferReply();
        const targetUser = interaction.options.getUser('membre') || interaction.user;
        await sendProfile(interaction, targetUser);
    },
};

export async function sendProfile(interaction, targetUser, isUpdate = false) {
    const userId = targetUser.id;

    try {
        await db.query(`INSERT IGNORE INTO users (user_id, display_name) VALUES (?, ?)`, [userId, targetUser.username]);

        const [users] = await db.query(`SELECT livraddict_url, pal_url FROM users WHERE user_id = ?`, [userId]);
        const livraddictUrl = users[0]?.livraddict_url;
        const palUrl = users[0]?.pal_url;

        const [bookStats] = await db.query(
            `SELECT 
                COUNT(*) as total_books,
                SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as finished_books,
                SUM(CASE WHEN status = 'reading' THEN 1 ELSE 0 END) as current_books
             FROM books WHERE user_id = ?`,
            [userId]
        );

        const stats = bookStats[0] || { total_books: 0, finished_books: 0, current_books: 0 };
        
        // Récupérer les lectures en cours
        const [readingBooks] = await db.query(
            `SELECT title, current_page, total_pages FROM books WHERE user_id = ? AND status = 'reading' ORDER BY added_at DESC LIMIT 3`,
            [userId]
        );

        const levelInfo = await getLevelInfo(userId);
        
        if (!levelInfo || !levelInfo.current) {
            const err = createErrorEmbed('Impossible de récupérer les statistiques de niveau.');
            return isUpdate ? interaction.update({ embeds: [err] }) : interaction.editReply({ embeds: [err] });
        }

        const current = levelInfo.current;
        const next = levelInfo.next;

        const embed = createBaseEmbed()
            .setColor(current.color)
            .setTitle('Profil Lecteur')
            .setDescription(`<@${targetUser.id}>`)
            .setThumbnail(targetUser.displayAvatarURL());

        let links = [];
        if (livraddictUrl) links.push(`[🔗 Profil Livraddict](${livraddictUrl})`);
        if (palUrl) links.push(`[📚 Ma PAL](${palUrl})`);
        
        if (links.length > 0) {
            embed.setDescription(`<@${targetUser.id}>\n\n` + links.join(' | '));
        }

        let gradeText = `${current.emoji} **${current.name}**\n*Total : ${levelInfo.totalPages > 0 ? `${levelInfo.totalPages} pages lues` : 'Aucune page lue'}*`;
        
        if (next) {
            const percent = Math.floor((levelInfo.totalPages / next.min_pages) * 100);
            const filled = Math.floor(percent / 10);
            const empty = 10 - filled;
            const bar = '🟩'.repeat(filled) + '⬜'.repeat(empty);
            gradeText += `\n\n**Progression vers ${next.name} :**\n${bar} ${percent}%\n*(Plus que ${next.min_pages - levelInfo.totalPages} pages)*`;
        } else {
            gradeText += `\n\n🌟 **Niveau Maximum Atteint !**`;
        }

        embed.addFields(
            { name: 'Grade Actuel', value: gradeText, inline: false },
            { name: 'Livres lus', value: stats.finished_books > 0 ? `${stats.finished_books}` : 'Aucun', inline: true },
            { name: 'PAL', value: (stats.total_books - stats.finished_books) > 0 ? `${stats.total_books - stats.finished_books} livres` : 'Vide', inline: true },
            { name: 'En cours', value: stats.current_books > 0 ? `${stats.current_books}` : 'Aucun', inline: true }
        );

        // Ajout des lectures en cours
        if (readingBooks.length > 0) {
            let readingText = '';
            for (const book of readingBooks) {
                readingText += `📖 **${book.title}**\n`;
                if (book.total_pages) {
                    const percent = Math.min(100, Math.floor((book.current_page / book.total_pages) * 100));
                    const filled = Math.floor(percent / 10);
                    const bar = '🟧'.repeat(filled) + '⬜'.repeat(10 - filled);
                    readingText += `${bar} ${percent}% (${book.current_page}/${book.total_pages}p)\n\n`;
                } else {
                    readingText += `Page ${book.current_page}\n\n`;
                }
            }
            embed.addFields({ name: '📚 Lectures actuelles', value: readingText, inline: false });
        }

        const components = isUpdate ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('menu_retour').setLabel('Retour').setStyle(ButtonStyle.Secondary))] : [];
        if (isUpdate) {
            await interaction.update({ embeds: [embed], components });
        } else {
            await interaction.editReply({ embeds: [embed] });
        }

    } catch (error) {
        console.error('[Profil] Erreur:', error);
        const err = createErrorEmbed('Une erreur est survenue lors de la récupération du profil.');
        isUpdate ? interaction.update({ embeds: [err] }) : interaction.editReply({ embeds: [err] });
    }
}
