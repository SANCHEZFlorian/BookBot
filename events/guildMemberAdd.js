import { EmbedBuilder } from 'discord.js';
import db from '../config/database.js';

export const event = {
    name: 'guildMemberAdd',
    async execute(member) {
        try {
            const [guildConfig] = await db.query(`SELECT log_member_id, welcome_channel_id FROM guilds WHERE guild_id = ?`, [member.guild.id]);
            
            // 1. Log Interne
            if (guildConfig[0]?.log_member_id) {
                const logChannel = await member.guild.channels.fetch(guildConfig[0].log_member_id).catch(() => null);
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setColor('#2ECC71')
                        .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                        .setTitle('📥 Nouveau Membre')
                        .setDescription(`<@${member.id}> a rejoint le serveur.`)
                        .addFields({ name: 'Date de création du compte', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` })
                        .setTimestamp();
                    await logChannel.send({ embeds: [embed] });
                }
            }

            // 2. Message de Bienvenue Public
            if (guildConfig[0]?.welcome_channel_id) {
                const welcomeChannel = await member.guild.channels.fetch(guildConfig[0].welcome_channel_id).catch(() => null);
                if (welcomeChannel) {
                    const { createBaseEmbed } = await import('../utils/embedBuilder.js');
                    const welcomeEmbed = createBaseEmbed()
                        .setTitle(`👋 Bienvenue, ${member.user.username} !`)
                        .setDescription(`Nous sommes ravis de t'accueillir parmi nous sur **${member.guild.name}** ! 📚\n\nN'hésite pas à faire un tour dans <#${member.guild.channels.cache.find(c => c.name.includes('règlement'))?.id}> et à te présenter dans <#${member.guild.channels.cache.find(c => c.name.includes('présentations'))?.id}>.\n\nBonne lecture ! ✨`)
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }));
                    
                    await welcomeChannel.send({ content: `Bienvenue <@${member.id}> !`, embeds: [welcomeEmbed] });
                }
            }
        } catch (error) {
            console.error('[Logs] Erreur guildMemberAdd:', error);
        }
    },
};
