import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadCommands(client) {
    const commandsPath = path.join(__dirname, '../commands');
    
    // Si le dossier n'existe pas encore, on le crée pour éviter un crash
    if (!fs.existsSync(commandsPath)) {
        fs.mkdirSync(commandsPath, { recursive: true });
        console.log('[Loader] Dossier "commands" créé.');
        return;
    }

    let commandCount = 0;

    // Fonction récursive pour lire les dossiers (catégories)
    async function readCommandsDir(dirPath) {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const item of items) {
            const itemPath = path.join(dirPath, item.name);

            if (item.isDirectory()) {
                await readCommandsDir(itemPath); // Lecture récursive
            } else if (item.isFile() && item.name.endsWith('.js')) {
                try {
                    const { command } = await import(pathToFileURL(itemPath).href);

                    if (command && command.data && command.execute) {
                        client.commands.set(command.data.name, command);
                        client.commandsForRest.push(command.data.toJSON());
                        commandCount++;
                    } else {
                        console.warn(`[WARNING] La commande ${item.name} n'a pas de propriété "data" ou "execute".`);
                    }
                } catch (error) {
                    console.error(`[ERROR] Erreur lors du chargement de la commande ${item.name}:`, error);
                }
            }
        }
    }

    await readCommandsDir(commandsPath);
    console.log(`[Loader] ✅ ${commandCount} commande(s) chargée(s) en mémoire.`);
}
