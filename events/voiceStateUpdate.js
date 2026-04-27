import { ChannelType, PermissionFlagsBits } from 'discord.js';
import db from '../config/database.js';
import { createBaseEmbed } from '../utils/embedBuilder.js';

// Cache en mémoire pour suivre les salons créés dynamiquement
const tempChannels = new Set();

export const event = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        if (oldState.channelId === newState.channelId) return;

        const guild = newState.guild || oldState.guild;
        const member = newState.member || oldState.member;
        
        try {
            const [guildConfig] = await db.query(
                `SELECT voice_hub_id, voice_category_id, log_voice_id FROM guilds WHERE guild_id = ?`, 
                [guild.id]
            );

            if (guildConfig.length === 0) return;

            const hubId = guildConfig[0].voice_hub_id;
            const catId = guildConfig[0].voice_category_id;
            const logId = guildConfig[0].log_voice_id;

            // --- 1. LOGS VOCAUX ---
            if (logId) {
                const logChannel = await guild.channels.fetch(logId).catch(() => null);
                if (logChannel) {
                    if (!oldState.channelId && newState.channelId) {
                        logChannel.send(`📥 **${member.user.username}** s'est connecté à \`${newState.channel.name}\``);
                    } else if (oldState.channelId && !newState.channelId) {
                        logChannel.send(`📤 **${member.user.username}** s'est déconnecté de \`${oldState.channel.name}\``);
                    } else if (oldState.channelId && newState.channelId) {
                        logChannel.send(`🔄 **${member.user.username}** a bougé de \`${oldState.channel.name}\` vers \`${newState.channel.name}\``);
                    }
                }
            }

            // --- 2. JOIN TO CREATE ---
            // Quelqu'un rejoint la porte d'entrée
            if (newState.channelId === hubId) {
                const channelName = `🛋️ Cocon de ${member.user.username}`;
                
                const newChannel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildVoice,
                    parent: catId,
                    permissionOverwrites: [
                        { id: member.id, allow: [PermissionFlagsBits.ManageChannels] }
                    ]
                });

                tempChannels.add(newChannel.id);
                await member.voice.setChannel(newChannel);
            }

            // --- 3. SUPPRESSION SALON VIDE ---
            if (oldState.channelId && tempChannels.has(oldState.channelId)) {
                const oldChannel = await guild.channels.fetch(oldState.channelId).catch(() => null);
                if (oldChannel && oldChannel.members.size === 0) {
                    await oldChannel.delete('Salon vide (Join to Create)');
                    tempChannels.delete(oldState.channelId);
                }
            }
        } catch (error) {
            console.error('[VoiceStateUpdate] Erreur:', error);
        }
    },
};
