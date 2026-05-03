import cron from 'node-cron';
import db from '../config/database.js';
import { scrapeLivraddictPAL } from './scraperService.js';
import { searchBook } from './bookApiService.js';

/**
 * Initialise les tâches planifiées du bot
 */
export function initCronJobs() {
    // Synchronisation automatique des PAL chaque jour à 04:00 du matin
    cron.schedule('0 4 * * *', async () => {
        console.log('[Cron] Lancement de la synchronisation automatique des PAL...');
        
        try {
            // On récupère tous les utilisateurs qui ont lié leur compte Livraddict
            const [users] = await db.query(`SELECT user_id, pal_url FROM users WHERE pal_url IS NOT NULL`);
            
            if (users.length === 0) {
                console.log('[Cron] Aucun utilisateur à synchroniser.');
                return;
            }

            for (const user of users) {
                try {
                    console.log(`[Cron] Synchronisation en cours pour l'utilisateur ${user.user_id}...`);
                    const result = await scrapeLivraddictPAL(user.pal_url);
                    
                    if (!result || result.books.length === 0) {
                        console.log(`[Cron] Aucun livre trouvé ou erreur pour ${user.user_id}.`);
                        continue;
                    }

                    const scrapedTitles = result.books.map(b => b.title);
                    
                    // 1. Suppression des livres qui ne sont plus dans la PAL (seulement ceux avec le statut 'to_read')
                    // On fait ça en boucle pour éviter les problèmes de limites SQL sur de très grosses listes
                    const [dbBooks] = await db.query(`SELECT id, title FROM books WHERE user_id = ? AND status = 'to_read'`, [user.user_id]);
                    for (const dbBook of dbBooks) {
                        if (!scrapedTitles.includes(dbBook.title)) {
                            await db.query(`DELETE FROM books WHERE id = ?`, [dbBook.id]);
                        }
                    }

                    // 2. Ajout des nouveaux livres
                    for (const b of result.books) {
                        const [existing] = await db.query(`SELECT id FROM books WHERE user_id = ? AND title = ?`, [user.user_id, b.title]);
                        if (existing.length === 0) {
                            let googleId = null;
                            const searchResults = await searchBook(`${b.title} ${b.author}`);
                            if (searchResults && searchResults.length > 0) {
                                const bestMatch = searchResults[0];
                                googleId = bestMatch.id;
                                if (!b.coverUrl && bestMatch.coverUrl) b.coverUrl = bestMatch.coverUrl;
                                if (!b.totalPages && bestMatch.pageCount) b.totalPages = bestMatch.pageCount;
                            }

                            await db.query(
                                `INSERT INTO books (user_id, title, author, cover_url, total_pages, status, google_book_id) VALUES (?, ?, ?, ?, ?, 'to_read', ?)`,
                                [user.user_id, b.title, b.author, b.coverUrl, b.totalPages, googleId]
                            );
                            
                            // Petit délai pour l'API Google Books
                            await new Promise(r => setTimeout(r, 500));
                        }
                    }

                    console.log(`[Cron] Fin de sync pour ${user.user_id}.`);
                    // Délai entre chaque utilisateur pour ne pas saturer Livraddict
                    await new Promise(r => setTimeout(r, 3000));

                } catch (userErr) {
                    console.error(`[Cron] Erreur lors de la sync de ${user.user_id}:`, userErr.message);
                }
            }
            console.log('[Cron] Synchronisation automatique journalière terminée.');
        } catch (err) {
            console.error('[Cron] Erreur globale dans le cron de synchronisation:', err);
        }
    });

    console.log('[Cron] Tâches planifiées initialisées (Sync PAL à 04:00).');
}
