import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embedBuilder.js';

export const command = {
    data: new SlashCommandBuilder()
        .setName('nuke_channels')
        .setDescription('Supprime TOUS les salons du serveur (DANGER EXTRÊME)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Sécurité absolue : uniquement l'ID du propriétaire
        const OWNER_ID = '971860208584388638';
        
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ 
                content: 'Accès refusé. Cette commande est strictement réservée au créateur du bot.', 
                ephemeral: true 
            });
        }

        await interaction.reply({ 
            content: '⚠️ Lancement de la procédure de destruction massive des salons... ⚠️', 
            ephemeral: true 
        });

        const guild = interaction.guild;
        const channels = guild.channels.cache;
        
        let deletedCount = 0;
        let errorCount = 0;

        for (const [id, channel] of channels) {
            try {
                await channel.delete();
                deletedCount++;
            } catch (error) {
                console.error(`[Nuke] Impossible de supprimer le salon ${channel.name} (${id}):`, error);
                errorCount++;
            }
        }

        console.log(`[Nuke] Opération terminée. ${deletedCount} supprimés, ${errorCount} échecs.`);
        
        // Note: l'interaction de base a de fortes chances d'être dans un salon supprimé,
        // donc on ne peut pas vraiment editReply(). 
        // Mais si par miracle on survit (ex: salon vocal ou erreur de suppression) :
        try {
            await interaction.user.send(`Opération Nuke terminée sur ${guild.name}. Salons supprimés : ${deletedCount}. Échecs : ${errorCount}.`);
        } catch (e) {
            // Ignore DM failure
        }
    },
};
