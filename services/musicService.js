import { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    VoiceConnectionStatus,
    entersState,
    StreamType,
    generateDependencyReport
} from '@discordjs/voice';
import ffmpegPath from 'ffmpeg-static';
import play from 'play-dl';
import fs from 'fs';
import path from 'path';

// Forcer discord.js à utiliser le ffmpeg fourni par npm
process.env.FFMPEG_PATH = ffmpegPath;

// Map pour stocker les lecteurs audio par serveur { guildId: { connection, player, currentRadio } }
const guildPlayers = new Map();

// Raccourcis pour les webradios (Creative Commons / Libres)
export const RADIOS = {
    'chillhop': process.env.RADIO_CHILLHOP_URL || 'https://streams.ilovemusic.de/iloveradio17.mp3', // Lofi Chill
    'lofi': process.env.RADIO_LOFI_URL || 'http://stream.zeno.fm/f3wvbbqmdg8uv',
    'jazz': process.env.RADIO_JAZZ_URL || 'http://stream.zeno.fm/wrv5ykqm7grudv'
};

/**
 * Rejoint un salon vocal et joue une radio
 */
export async function playRadio(interaction, radioKey) {
    const channel = interaction.member?.voice?.channel;
    
    if (!channel) {
        throw new Error("Vous devez être dans un salon vocal pour lancer la musique.");
    }

    const url = RADIOS[radioKey];
    if (!url) throw new Error("Radio introuvable.");

    // Log des dépendances pour débugger le VPS
    console.log(generateDependencyReport());

    // Nettoyer l'ancienne connexion si elle existe
    const existing = guildPlayers.get(channel.guild.id);
    if (existing) {
        console.log(`[Music] Nettoyage de l'ancienne connexion pour ${channel.guild.id}`);
        try { existing.connection.destroy(); } catch(e) {}
    }

    // Créer la connexion
    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
    });

    // Créer le lecteur audio
    const player = createAudioPlayer();
    
    player.on('error', error => {
        console.error(`[AudioPlayerError]`, error.message);
    });

    player.on('stateChange', (oldState, newState) => {
        console.log(`[AudioPlayer] ${oldState.status} -> ${newState.status}`);
    });

    connection.on('stateChange', (oldState, newState) => {
        console.log(`[VoiceConnection] ${oldState.status} -> ${newState.status}`);
        
        // Fix agressif pour la boucle de signalisation sur Linux
        const networking = Reflect.get(newState, 'networking') || Reflect.get(connection, 'networking');
        if (networking) {
            const udp = Reflect.get(networking, 'udp');
            if (udp && udp.keepAliveInterval) {
                clearInterval(udp.keepAliveInterval);
            }
        }
    });

    connection.on('error', error => {
        console.error(`[VoiceConnectionError]`, error.message);
    });

    try {
        // Attendre que la connexion UDP soit bien établie (Délai 30s)
        console.log(`[VoiceConnection] En attente de l'état READY...`);
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
        console.log(`[VoiceConnection] UDP Connecté et Prêt !`);

        // Utiliser play-dl pour générer un flux propre
        const stream = await play.stream(url);
        const resource = createAudioResource(stream.stream, { inputType: stream.type });
        
        player.play(resource);
        connection.subscribe(player);
    } catch (err) {
        console.error(`[Audio/Network Error] Connexion impossible (Timeout UDP ?) :`, err.message);
        stopMusic(channel.guild.id);
    }

    // Stocker dans la map
    guildPlayers.set(channel.guild.id, {
        connection,
        player,
        currentRadio: radioKey,
        channelId: channel.id
    });

    // Gestion des déconnexions
    connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
            ]);
            // Reconnecté, on fait rien
        } catch (error) {
            // Vraie déconnexion
            stopMusic(channel.guild.id);
        }
    });

    return radioKey;
}

/**
 * Arrête la musique et quitte le salon
 */
export function stopMusic(guildId) {
    const guildPlayer = guildPlayers.get(guildId);
    if (guildPlayer) {
        guildPlayer.player.stop();
        if (guildPlayer.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            guildPlayer.connection.destroy();
        }
        guildPlayers.delete(guildId);
        return true;
    }
    return false;
}

/**
 * Joue un son court (cloche/signal) par-dessus la musique si existante, 
 * ou se connecte brièvement pour le jouer.
 */
export async function playSignal(guildId, audioFileName, voiceChannelId) {
    // Si on a le chemin du fichier, on le joue
    const filePath = path.resolve(audioFileName);
    if (!fs.existsSync(filePath)) {
        console.warn(`[Audio] Fichier audio introuvable : ${filePath}`);
        return;
    }

    let connection;
    let player;
    const existingPlayer = guildPlayers.get(guildId);

    if (existingPlayer) {
        // Le bot est déjà dans un vocal
        connection = existingPlayer.connection;
        // On met pause sur la radio ? Ou on joue par-dessus ? 
        // Discord ne permet pas de jouer deux flux en même temps sur un seul bot
        // Solution simple : arrêter la radio, jouer le son, relancer la radio (complexe)
        // Alternative Discord.js v14 : changer la ressource, écouter l'event idle, et remettre la radio
        const signalResource = createAudioResource(filePath);
        existingPlayer.player.play(signalResource);
        
        // Quand le signal est fini, on relance la webradio
        existingPlayer.player.once(AudioPlayerStatus.Idle, () => {
            if (existingPlayer.currentRadio) {
                const radioResource = createAudioResource(RADIOS[existingPlayer.currentRadio], { inputType: StreamType.Arbitrary });
                existingPlayer.player.play(radioResource);
            }
        });
        
    } else if (voiceChannelId) {
        // Le bot n'est pas en vocal, on le connecte juste pour le signal
        try {
            // Note: Nécessite que le channel original ou config soit passé
            // Simplification: pour l'instant on skip si le bot n'est pas déjà appelé en vocal pour la musique
            console.log(`[Audio] Signal joué dans ${voiceChannelId} (implémentation standalone si besoin)`);
        } catch (e) {
            console.error(e);
        }
    }
}

export function getCurrentRadio(guildId) {
    const gp = guildPlayers.get(guildId);
    return gp ? gp.currentRadio : null;
}
