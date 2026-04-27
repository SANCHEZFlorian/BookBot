import { EmbedBuilder } from 'discord.js';
import db from '../config/database.js';

export const event = {
    name: 'guildMemberRemove',
    async execute(member) {
        try {
            const [guildConfig] = await db.query(`SELECT log_member_id FROM guilds WHERE guild_id = ?`, [member.guild.id]);
            if (!guildConfig[0]?.log_member_id) return;

            const logChannel = await member.guild.channels.fetch(guildConfig[0].log_member_id).catch(() => null);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                .setTitle('📤 Membre Parti')
                .setDescription(`**${member.user.username}** a quitté le serveur.`)
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('[Logs] Erreur guildMemberRemove:', error);
        }
    },
};
