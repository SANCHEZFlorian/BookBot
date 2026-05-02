import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../config/database.js';
import { createBaseEmbed, createSuccessEmbed, createErrorEmbed } from '../utils/embedBuilder.js';
import { playSignal } from './musicService.js';

// Stockage en mémoire des timers actifs (pour pouvoir les annuler)
// Structure: { guildId: timeoutId }
const activeTimers = new Map();

export async function startSession(interaction, duration, breakDuration, sessionCount = 1, currentIteration = 1) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // 1. Vérifier qu'il n'y a pas déjà une session active
    const [existing] = await db.query(
        `SELECT id FROM sessions WHERE guild_id = ? AND status IN ('active', 'break')`, 
        [guildId]
    );

    if (existing.length > 0) {
        if (interaction.replied || interaction.deferred) {
            return interaction.followUp({ embeds: [createErrorEmbed('Une session est déjà en cours sur ce serveur !')], ephemeral: true });
        } else {
            return interaction.reply({ embeds: [createErrorEmbed('Une session est déjà en cours sur ce serveur !')], ephemeral: true });
        }
    }

    // 2. Vérifier si un salon d'annonce est configuré
    const [guildConfig] = await db.query(`SELECT session_channel_id FROM guilds WHERE guild_id = ?`, [guildId]);
    const announceChannelId = guildConfig[0]?.session_channel_id;

    let announceChannel = interaction.channel; // Fallback
    if (announceChannelId) {
        try {
            announceChannel = await interaction.guild.channels.fetch(announceChannelId);
        } catch (e) {
            console.warn(`[Session] Salon d'annonce introuvable pour ${guildId}`);
        }
    }

    // Démarrer la première itération
    await startSessionInner(interaction.client, guildId, userId, duration, breakDuration, sessionCount, currentIteration, announceChannel, interaction.member?.voice?.channelId, interaction);
}

// Fonction interne pour gérer la boucle indépendamment de l'interaction originale
async function startSessionInner(client, guildId, userId, duration, breakDuration, sessionCount, currentIteration, announceChannel, voiceChannelId, interaction = null) {
    // 3. Créer la session en BDD
    const [result] = await db.query(
        `INSERT INTO sessions (guild_id, started_by, session_minutes, break_minutes, status, channel_id) 
         VALUES (?, ?, ?, ?, 'active', ?)`,
        [guildId, userId, duration, breakDuration, announceChannel.id]
    );
    const sessionId = result.insertId;

    // 4. Envoyer l'annonce de début
    const endTime = Math.floor((Date.now() + duration * 60000) / 1000);
    const embed = createBaseEmbed()
        .setTitle(`⏱️ Session de lecture [${currentIteration}/${sessionCount}]`)
        .setDescription(`Préparez vos livres et coupez vos notifications.\n\n**Durée :** ${duration} minutes\n**Fin prévue :** <t:${endTime}:R>`)
        .addFields({ name: 'Lancée par', value: `<@${userId}>` });

    const message = await announceChannel.send({ content: '@here', embeds: [embed] });

    await db.query(`UPDATE sessions SET message_id = ? WHERE id = ?`, [message.id, sessionId]);

    if (interaction && (interaction.deferred || interaction.replied)) {
        await interaction.followUp({ content: `Session [${currentIteration}/${sessionCount}] lancée avec succès dans <#${announceChannel.id}> !`, ephemeral: true });
    }

    // Jouer le son de début dans le salon vocal
    if (voiceChannelId) {
        await playSignal(guildId, process.env.AUDIO_SESSION_START || './audio/session_start.mp3', voiceChannelId);
    }
    
    // 5. Démarrer le timer de la session
    const timerId = setTimeout(async () => {
        await endSession(client, guildId, sessionId, userId, duration, breakDuration, sessionCount, currentIteration, announceChannel, voiceChannelId);
    }, duration * 60000);

    activeTimers.set(guildId, timerId);
}

export async function endSession(client, guildId, sessionId, userId, duration, breakDuration, sessionCount, currentIteration, announceChannel, voiceChannelId) {
    activeTimers.delete(guildId);

    // Mettre à jour le statut
    await db.query(`UPDATE sessions SET status = 'break' WHERE id = ?`, [sessionId]);

    // Jouer le son de fin
    await playSignal(guildId, process.env.AUDIO_SESSION_END || './audio/session_end.mp3', null);

    const isLast = currentIteration >= sessionCount;

    // Bouton pour saisir le score
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`session_score_${sessionId}`).setLabel('Saisir mes pages lues').setStyle(ButtonStyle.Success).setEmoji('📝')
    );

    const embed = createSuccessEmbed(`La session [${currentIteration}/${sessionCount}] est terminée !`)
        .setDescription(`Bravo à tous pour ces **${duration} minutes** de lecture ! ☕\nPrenez maintenant une pause de **${breakDuration} minutes**.\n\nCliquez sur le bouton ci-dessous pour enregistrer votre progression.`);

    if (isLast) {
        embed.addFields({ name: 'Fin de la session', value: 'C\'était la dernière session de cette série. Bon repos !' });
    } else {
        const nextTime = Math.floor((Date.now() + breakDuration * 60000) / 1000);
        embed.addFields({ name: 'Prochaine session', value: `La session [${currentIteration + 1}/${sessionCount}] commencera <t:${nextTime}:R>.` });
    }

    await announceChannel.send({ embeds: [embed], components: [row] });

    // Démarrer le timer de pause s'il y a d'autres sessions
    if (!isLast) {
        const breakTimerId = setTimeout(async () => {
            await endBreak(client, guildId, userId, duration, breakDuration, sessionCount, currentIteration, announceChannel, voiceChannelId);
        }, breakDuration * 60000);
        activeTimers.set(guildId, breakTimerId);
    } else {
        // Clôturer définitivement la session si c'est la dernière
        await db.query(`UPDATE sessions SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE id = ?`, [sessionId]);
    }
}

async function endBreak(client, guildId, userId, duration, breakDuration, sessionCount, currentIteration, announceChannel, voiceChannelId) {
    activeTimers.delete(guildId);
    
    // On doit clôturer l'ancienne session 'break' avant d'en rouvrir une nouvelle pour la prochaine session
    // (Pour simplifier, on laisse l'ancienne en break car on n'a plus l'ID sous la main, ou on maj toutes celles en break)
    await db.query(`UPDATE sessions SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE guild_id = ? AND status = 'break'`, [guildId]);

    // Lancer l'itération suivante
    await startSessionInner(client, guildId, userId, duration, breakDuration, sessionCount, currentIteration + 1, announceChannel, voiceChannelId);
}

export async function stopCurrentSession(interaction) {
    const guildId = interaction.guildId;

    const [rows] = await db.query(
        `SELECT id FROM sessions WHERE guild_id = ? AND status IN ('active', 'break')`, 
        [guildId]
    );

    if (rows.length === 0) {
        if (interaction.replied || interaction.deferred) return interaction.followUp({ embeds: [createErrorEmbed('Aucune session n\'est en cours.')], ephemeral: true });
        else return interaction.reply({ embeds: [createErrorEmbed('Aucune session n\'est en cours.')], ephemeral: true });
    }

    const sessionId = rows[0].id;

    if (activeTimers.has(guildId)) {
        clearTimeout(activeTimers.get(guildId));
        activeTimers.delete(guildId);
    }

    await db.query(`UPDATE sessions SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE id = ?`, [sessionId]);

    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [createSuccessEmbed('La session (ou la boucle) en cours a été arrêtée manuellement.')], ephemeral: true });
    } else {
        await interaction.reply({ embeds: [createSuccessEmbed('La session (ou la boucle) en cours a été arrêtée manuellement.')], ephemeral: true });
    }
}
