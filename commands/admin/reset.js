import { SlashCommandBuilder } from 'discord.js';
import db from '../../config/database.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embedBuilder.js';

export const command = {
    data: new SlashCommandBuilder()
        .setName('session_reset')
        .setDescription('Réinitialise la configuration du bot sur ce serveur (Admin)'),
        
    async execute(interaction) {
        if (!interaction.member.permissions.has('ManageGuild')) {
            return interaction.reply({ 
                embeds: [createErrorEmbed('Vous devez avoir la permission "Gérer le serveur" pour utiliser cette commande.')],
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            await db.query(`DELETE FROM guilds WHERE guild_id = ?`, [interaction.guildId]);
            await interaction.editReply({ embeds: [createSuccessEmbed('Configuration réinitialisée avec succès. Vous devrez relancer `/session_config` pour utiliser les annonces.')] });
        } catch (error) {
            console.error('[SessionReset] Erreur:', error);
            await interaction.editReply({ embeds: [createErrorEmbed('Erreur lors de la réinitialisation.')] });
        }
    },
};
