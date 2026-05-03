import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import dotenv from 'dotenv';
import dns from 'dns';
import { initDatabase } from './config/database.js';
import { loadCommands } from './loader/commandLoader.js';
import { loadEvents } from './loader/eventLoader.js';
import { startOverlayServer } from './overlay/server.js';
import { initCronJobs } from './services/cronService.js';

dotenv.config();

// Fix pour le bug de connexion vocale sur les serveurs avec IPv6
dns.setDefaultResultOrder('ipv4first');

// Initialisation du client Discord avec les intents nécessaires pour BookBot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates, // Indispensable pour la musique/signaux sonores
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Collections pour stocker les commandes
client.commands = new Collection();
client.commandsForRest = [];

// Fonction de démarrage asynchrone
async function startBot() {
    try {
        // 1. Initialiser la base de données
        await initDatabase();

        // 2. Démarrer le serveur de l'Overlay OBS
        startOverlayServer();

        // 3. Initialiser les tâches planifiées (Sync PAL)
        initCronJobs();

        // 4. Charger les événements
        await loadEvents(client);

        // 3. Charger les commandes
        await loadCommands(client);

        // 4. Lancement du bot
        const isProd = process.env.NODE_ENV === 'production';
        const TOKEN = isProd ? process.env.PROD_TOKEN : process.env.DEV_TOKEN;
        
        await client.login(TOKEN);
    } catch (error) {
        console.error('[FATAL] Erreur lors du démarrage du bot :', error);
        process.exit(1);
    }
}

startBot();

import { getVoiceConnections } from '@discordjs/voice';

// Gestionnaire d'arrêt propre pour PM2 (Évite les connexions vocales fantômes au redémarrage)
const gracefulShutdown = () => {
    console.log('[System] Arrêt en cours, déconnexion vocale...');
    try {
        const connections = getVoiceConnections();
        for (const connection of connections.values()) {
            connection.destroy();
        }
        client.destroy();
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export { client };
