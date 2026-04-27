import { EmbedBuilder } from 'discord.js';
import db from '../config/database.js';

export const event = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage) {
        if (!oldMessage.guild || oldMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return; // Ignore embed updates

        try {
            const [guildConfig] = await db.query(`SELECT log_msg_id FROM guilds WHERE guild_id = ?`, [oldMessage.guild.id]);
            if (!guildConfig[0]?.log_msg_id) return;

            const logChannel = await oldMessage.guild.channels.fetch(guildConfig[0].log_msg_id).catch(() => null);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setColor('#F1C40F')
                .setAuthor({ name: oldMessage.author.tag, iconURL: oldMessage.author.displayAvatarURL() })
                .setTitle('📝 Message Modifié')
                .addFields(
                    { name: 'Auteur', value: `<@${oldMessage.author.id}>`, inline: true },
                    { name: 'Salon', value: `<#${oldMessage.channel.id}>`, inline: true },
                    { name: 'Avant', value: oldMessage.content ? oldMessage.content.substring(0, 1024) : '*Vide*' },
                    { name: 'Après', value: newMessage.content ? newMessage.content.substring(0, 1024) : '*Vide*' }
                )
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('[Logs] Erreur messageUpdate:', error);
        }
    },
};
