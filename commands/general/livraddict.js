import { SlashCommandBuilder } from 'discord.js';
import db from '../../config/database.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embedBuilder.js';

export const command = {
    data: new SlashCommandBuilder()
        .setName('livraddict')
        .setDescription('Liez votre profil Livraddict à votre compte')
        .addStringOption(option => 
            option.setName('url')
                .setDescription('Le lien de votre profil Livraddict (laissez vide pour supprimer)')
                .setRequired(false)
        ),
        
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const url = interaction.options.getString('url');
        const userId = interaction.user.id;

        try {
            await db.query(`INSERT IGNORE INTO users (user_id, display_name) VALUES (?, ?)`, [userId, interaction.user.username]);

            if (!url) {
                await db.query(`UPDATE users SET livraddict_url = NULL WHERE user_id = ?`, [userId]);
                return interaction.editReply({ embeds: [createSuccessEmbed('Lien Livraddict supprimé.')] });
            }

            if (!url.includes('livraddict.com/profil/')) {
                return interaction.editReply({ embeds: [createErrorEmbed('URL invalide. Exemple : `https://www.livraddict.com/profil/pseudo/`')] });
            }

            await db.query(`UPDATE users SET livraddict_url = ? WHERE user_id = ?`, [url, userId]);
            await interaction.editReply({ embeds: [createSuccessEmbed(`Profil Livraddict lié :\n${url}`)] });

        } catch (error) {
            console.error('[Livraddict] Erreur:', error);
            await interaction.editReply({ embeds: [createErrorEmbed('Une erreur est survenue.')] });
        }
    },
};
