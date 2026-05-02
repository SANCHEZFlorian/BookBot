import { EmbedBuilder } from 'discord.js';
import db from '../config/database.js';

export const event = {
    name: 'guildMemberRemove',
    async execute(member) {
        try {
            const [guildConfig] = await db.query(`SELECT log_member_id, welcome_channel_id FROM guilds WHERE guild_id = ?`, [member.guild.id]);
            
            // 1. Log Interne
            if (guildConfig[0]?.log_member_id) {
                const logChannel = await member.guild.channels.fetch(guildConfig[0].log_member_id).catch(() => null);
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setColor('#E74C3C')
                        .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                        .setTitle('📤 Membre Parti')
                        .setDescription(`**${member.user.username}** a quitté le serveur.`)
                        .setTimestamp();
                    await logChannel.send({ embeds: [embed] });
                }
            }

            // 2. Message de Départ Public
            if (guildConfig[0]?.welcome_channel_id) {
                const welcomeChannel = await member.guild.channels.fetch(guildConfig[0].welcome_channel_id).catch(() => null);
                if (welcomeChannel) {
                    const { createBaseEmbed } = await import('../utils/embedBuilder.js');
                    const leaveEmbed = createBaseEmbed()
                        .setTitle(`👋 Au revoir, ${member.user.username}`)
                        .setDescription(`**${member.user.username}** a quitté l'aventure. On espère te revoir bientôt ! 📖`)
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }));
                    
                    await welcomeChannel.send({ embeds: [leaveEmbed] });
                }
            }
        } catch (error) {
            console.error('[Logs] Erreur guildMemberRemove:', error);
        }
    },
};
