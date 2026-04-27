import { EmbedBuilder } from 'discord.js';
import db from '../config/database.js';

export const event = {
    name: 'messageDelete',
    async execute(message) {
        if (!message.guild || message.author?.bot) return;

        try {
            const [guildConfig] = await db.query(`SELECT log_msg_id FROM guilds WHERE guild_id = ?`, [message.guild.id]);
            if (!guildConfig[0]?.log_msg_id) return;

            const logChannel = await message.guild.channels.fetch(guildConfig[0].log_msg_id).catch(() => null);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setTitle('🗑️ Message Supprimé')
                .addFields(
                    { name: 'Auteur', value: `<@${message.author.id}>`, inline: true },
                    { name: 'Salon', value: `<#${message.channel.id}>`, inline: true },
                    { name: 'Contenu', value: message.content ? (message.content.substring(0, 1000) || '*Vide*') : '*Message non textuel ou cache vide*' }
                )
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('[Logs] Erreur messageDelete:', error);
        }
    },
};
