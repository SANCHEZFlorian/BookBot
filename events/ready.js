import { REST, Routes } from 'discord.js';

export const event = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`[Ready] Connecté en tant que ${client.user.tag} ! 📖`);

        const isProd = process.env.NODE_ENV === 'production';
        const TOKEN = isProd ? process.env.PROD_TOKEN : process.env.DEV_TOKEN;

        if (!TOKEN) {
            console.error('[Ready] ❌ Erreur : Aucun token Discord trouvé dans le fichier .env !');
            return;
        }

        const rest = new REST({ version: '10' }).setToken(TOKEN);

        try {
            const commandsForRest = client.commandsForRest || [];
            console.log(`[Deploy] Lancement du déploiement de ${commandsForRest.length} commandes (/).`);

            // Remarque : Utiliser `Routes.applicationCommands` déploie de manière globale (peut prendre jusqu'à 1h).
            // Pour des tests immédiats, utiliser `Routes.applicationGuildCommands(clientId, guildId)`
            const data = await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commandsForRest },
            );

            console.log(`[Deploy] ✅ Déploiement réussi de ${data.length} commandes (/).`);
        } catch (error) {
            console.error('[Deploy] ❌ Erreur lors du déploiement des commandes :', error);
        }
    },
};
