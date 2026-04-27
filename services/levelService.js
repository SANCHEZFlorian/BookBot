import db from '../config/database.js';
import { createBaseEmbed } from '../utils/embedBuilder.js';

/**
 * Vérifie si un utilisateur passe à un niveau supérieur après avoir lu des pages.
 * @param {string} userId - ID de l'utilisateur
 * @param {object} interaction - L'interaction Discord pour envoyer le message de level up (optionnel)
 */
export async function checkLevelUp(userId, interaction = null) {
    try {
        // 1. Récupérer les données actuelles de l'utilisateur
        const [users] = await db.query(
            `SELECT total_pages_read, level_id FROM users WHERE user_id = ?`,
            [userId]
        );

        if (users.length === 0) return false;

        const totalPages = users[0].total_pages_read;
        const currentLevelId = users[0].level_id;

        // 2. Chercher le plus haut niveau qu'il peut atteindre avec ses pages
        const [levels] = await db.query(
            `SELECT id, name, emoji, color, min_pages 
             FROM reading_levels 
             WHERE min_pages <= ? 
             ORDER BY min_pages DESC LIMIT 1`,
            [totalPages]
        );

        if (levels.length === 0) return false;

        const newLevel = levels[0];

        // 3. S'il a atteint un nouveau niveau
        if (newLevel.id > currentLevelId) {
            // Mettre à jour en BDD
            await db.query(`UPDATE users SET level_id = ? WHERE user_id = ?`, [newLevel.id, userId]);

            // Si on a l'interaction, on envoie un joli message !
            if (interaction && interaction.channel) {
                const embed = createBaseEmbed()
                    .setColor(newLevel.color)
                    .setTitle('🎉 NOUVEAU RANG ATTEINT !')
                    .setDescription(`Félicitations <@${userId}> ! Avec **${totalPages} pages** lues au total, vous venez de débloquer un nouveau palier de lecteur.\n\n**Nouveau Rang :** ${newLevel.emoji} **${newLevel.name}**`)
                    .setThumbnail(interaction.user.displayAvatarURL());
                
                // On essaie d'envoyer dans le même salon sans ping (sauf s'il est déjà pingué dans l'embed)
                await interaction.channel.send({ content: `<@${userId}>`, embeds: [embed] }).catch(console.error);
            }
            return true;
        }

        return false;
    } catch (error) {
        console.error('[LevelService] Erreur lors de la vérification de niveau :', error);
        return false;
    }
}

/**
 * Récupère les infos du niveau actuel et du prochain niveau.
 */
export async function getLevelInfo(userId) {
    const [users] = await db.query(`SELECT total_pages_read, level_id FROM users WHERE user_id = ?`, [userId]);
    if (users.length === 0) return null;

    const totalPages = users[0].total_pages_read;
    
    // Niveau actuel
    const [current] = await db.query(`SELECT * FROM reading_levels WHERE id = ?`, [users[0].level_id]);
    
    // Prochain niveau
    const [next] = await db.query(`SELECT * FROM reading_levels WHERE id > ? ORDER BY id ASC LIMIT 1`, [users[0].level_id]);

    return {
        totalPages,
        current: current[0] || null,
        next: next[0] || null
    };
}
