import { EmbedBuilder } from 'discord.js';
import db from '../config/database.js';

export const event = {
    name: 'guildMemberAdd',
    async execute(member) {
        try {
            const [guildConfig] = await db.query(`SELECT log_member_id FROM guilds WHERE guild_id = ?`, [member.guild.id]);
            if (!guildConfig[0]?.log_member_id) return;

            const logChannel = await member.guild.channels.fetch(guildConfig[0].log_member_id).catch(() => null);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                .setTitle('📥 Nouveau Membre')
                .setDescription(`<@${member.id}> a rejoint le serveur.`)
                .addFields({ name: 'Date de création du compte', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` })
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('[Logs] Erreur guildMemberAdd:', error);
        }
    },
};
