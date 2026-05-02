import { SlashCommandBuilder } from 'discord.js';
import { startSession, stopCurrentSession } from '../../services/sessionService.js';
import db from '../../config/database.js';
import { createBaseEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embedBuilder.js';

export const command = {
    data: new SlashCommandBuilder()
        .setName('session')
        .setDescription('Gestion des sessions de lecture')
        .addSubcommand(subcmd => 
            subcmd.setName('lancer')
                  .setDescription('Lance une nouvelle session de lecture')
                  .addIntegerOption(opt => opt.setName('duree').setDescription('Durée en minutes (défaut: 45)').setMinValue(1).setMaxValue(180))
                  .addIntegerOption(opt => opt.setName('pause').setDescription('Pause en minutes (défaut: 15)').setMinValue(1).setMaxValue(60))
        )
        .addSubcommand(subcmd => 
            subcmd.setName('stopper')
                  .setDescription('Arrête prématurément la session')
        )
        .addSubcommand(subcmd => 
            subcmd.setName('recap')
                  .setDescription('Récapitulatif de la dernière session')
        )
        .addSubcommand(subcmd => 
            subcmd.setName('config')
                  .setDescription('(Admin) Configure le salon des annonces et le rôle gestionnaire')
                  .addChannelOption(opt => opt.setName('salon').setDescription('Salon textuel').setRequired(false))
                  .addRoleOption(opt => opt.setName('role').setDescription('Rôle autorisé à lancer les sessions').setRequired(false))
        ),

    async execute(interaction) {
        const subcmd = interaction.options.getSubcommand();
        
        if (subcmd === 'lancer') {
            await interaction.deferReply({ ephemeral: true });
            
            // Vérification du rôle spécial
            const [guildConfig] = await db.query(`SELECT session_manager_role_id, session_channel_id FROM guilds WHERE guild_id = ?`, [interaction.guildId]);
            const managerRoleId = guildConfig[0]?.session_manager_role_id;
            
            if (managerRoleId && !interaction.member.roles.cache.has(managerRoleId) && !interaction.member.permissions.has('Administrator')) {
                return interaction.editReply({ embeds: [createErrorEmbed(`Seuls les membres avec le rôle <@&${managerRoleId}> peuvent lancer des sessions.`)] });
            }

            const d = interaction.options.getInteger('duree') || 45;
            const p = interaction.options.getInteger('pause') || 15;
            
            if (!guildConfig[0]?.session_channel_id) return interaction.editReply({ embeds: [createErrorEmbed('Salon non configuré. Utilisez `/session config` ou `/setup` d\'abord.')] });
            await startSession(interaction, d, p);
        } else if (subcmd === 'stopper') {
            await interaction.deferReply({ ephemeral: true });
            await stopCurrentSession(interaction);
        } else if (subcmd === 'recap') {
            await interaction.deferReply();
            await sendRecap(interaction);
        } else if (subcmd === 'config') {
            if (!interaction.member.permissions.has('ManageGuild')) return interaction.reply({ embeds: [createErrorEmbed('Permission manquante.')], ephemeral: true });
            await interaction.deferReply({ ephemeral: true });
            
            const ch = interaction.options.getChannel('salon');
            const role = interaction.options.getRole('role');

            if (!ch && !role) return interaction.editReply({ embeds: [createErrorEmbed('Veuillez spécifier au moins une option (salon ou rôle).')] });

            if (ch) {
                if (ch.type !== 0) return interaction.editReply({ embeds: [createErrorEmbed('Veuillez sélectionner un salon texte.')] });
                await db.query(`INSERT INTO guilds (guild_id, guild_name, session_channel_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE session_channel_id = ?`, [interaction.guildId, interaction.guild.name, ch.id, ch.id]);
            }

            if (role) {
                await db.query(`INSERT INTO guilds (guild_id, guild_name, session_manager_role_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE session_manager_role_id = ?`, [interaction.guildId, interaction.guild.name, role.id, role.id]);
            }

            await interaction.editReply({ embeds: [createSuccessEmbed(`Configuration mise à jour.${ch ? `\nSalon : <#${ch.id}>` : ''}${role ? `\nGestionnaire : <@&${role.id}>` : ''}`)] });
        }
    }
};

async function sendRecap(interaction) {
    const [sessions] = await db.query(`SELECT id, session_minutes, started_at FROM sessions WHERE guild_id = ? ORDER BY started_at DESC LIMIT 1`, [interaction.guildId]);
    if (sessions.length === 0) return interaction.editReply({ embeds: [createErrorEmbed('Aucune session n\'a eu lieu.')] });
    
    const [scores] = await db.query(`SELECT user_id, pages_read FROM session_scores WHERE session_id = ? ORDER BY pages_read DESC`, [sessions[0].id]);
    
    const embed = createBaseEmbed().setTitle('📊 Récapitulatif').setDescription(`Session de **${sessions[0].session_minutes} min** lancée le <t:${Math.floor(new Date(sessions[0].started_at).getTime()/1000)}:d>.`);
    
    if (scores.length === 0) {
        embed.addFields({ name: 'Participants', value: 'Aucun score enregistré.' });
    } else {
        let txt = '', total = 0;
        scores.forEach((s, i) => {
            txt += `${i===0?'🥇':i===1?'🥈':i===2?'🥉':'📘'} <@${s.user_id}> : **${s.pages_read}** pages\n`;
            total += s.pages_read;
        });
        embed.addFields({ name: `Total (${scores.length} pers.)`, value: `**${total} pages lues** 📚` }, { name: 'Classement', value: txt });
    }
    await interaction.editReply({ embeds: [embed] });
}
