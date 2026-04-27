import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadEvents(client) {
    const eventsPath = path.join(__dirname, '../events');
    
    if (!fs.existsSync(eventsPath)) {
        fs.mkdirSync(eventsPath, { recursive: true });
        console.log('[Loader] Dossier "events" créé.');
        return;
    }

    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    let eventCount = 0;

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        
        try {
            const { event } = await import(pathToFileURL(filePath).href);

            if (event && event.name && event.execute) {
                if (event.once) {
                    client.once(event.name, (...args) => event.execute(...args));
                } else {
                    client.on(event.name, (...args) => event.execute(...args));
                }
                eventCount++;
            } else {
                console.warn(`[WARNING] L'événement ${file} n'a pas de propriété "name" ou "execute".`);
            }
        } catch (error) {
            console.error(`[ERROR] Erreur lors du chargement de l'événement ${file}:`, error);
        }
    }

    console.log(`[Loader] ✅ ${eventCount} événement(s) chargé(s).`);
}
