import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';
const OPEN_LIBRARY_API = 'https://openlibrary.org/search.json';

/**
 * Recherche un livre via l'API Google Books (prioritaire) ou Open Library (fallback)
 * @param {string} query La recherche (titre, auteur, ou ISBN)
 * @returns {Promise<Array>} Un tableau de résultats de livres formatés
 */
export async function searchBook(query) {
    try {
        // 1. Essayer Google Books
        const googleResults = await searchGoogleBooks(query);
        if (googleResults && googleResults.length > 0) {
            return googleResults;
        }

        // 2. Fallback sur Open Library si aucun résultat
        console.log(`[BookAPI] Aucun résultat sur Google Books pour "${query}", fallback sur Open Library...`);
        const openLibResults = await searchOpenLibrary(query);
        return openLibResults || [];

    } catch (error) {
        console.error('[BookAPI] Erreur globale lors de la recherche:', error);
        return [];
    }
}

async function searchGoogleBooks(query) {
    try {
        const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
        let url = `${GOOGLE_BOOKS_API}?q=${encodeURIComponent(query)}&maxResults=5&langRestrict=fr`;
        
        if (apiKey) {
            url += `&key=${apiKey}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Google Books HTTP Error: ${response.status}`);
        
        const data = await response.json();
        
        if (!data.items) return [];

        return data.items.map(item => {
            const info = item.volumeInfo;
            // Essayer de récupérer le meilleur ISBN (le 13 de préférence)
            let isbn = null;
            if (info.industryIdentifiers) {
                const isbn13 = info.industryIdentifiers.find(id => id.type === 'ISBN_13');
                const isbn10 = info.industryIdentifiers.find(id => id.type === 'ISBN_10');
                isbn = (isbn13 || isbn10 || {}).identifier;
            }

            return {
                id: item.id, // ID Google
                source: 'google',
                title: info.title || 'Titre inconnu',
                author: info.authors ? info.authors.join(', ') : 'Auteur inconnu',
                description: info.description || 'Aucun résumé disponible.',
                pageCount: info.pageCount || 0,
                coverUrl: info.imageLinks ? info.imageLinks.thumbnail.replace('http:', 'https:') : null,
                isbn: isbn
            };
        });
    } catch (error) {
        console.error('[BookAPI] Erreur Google Books:', error.message);
        return [];
    }
}

async function searchOpenLibrary(query) {
    try {
        const url = `${OPEN_LIBRARY_API}?q=${encodeURIComponent(query)}&limit=5&language=fre`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Open Library HTTP Error: ${response.status}`);
        
        const data = await response.json();
        
        if (!data.docs || data.docs.length === 0) return [];

        return data.docs.map(doc => {
            // Couverture Open Library (M = Medium size)
            const coverUrl = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null;
            
            return {
                id: doc.key.replace('/works/', ''), // ID Open Library
                source: 'openlibrary',
                title: doc.title || 'Titre inconnu',
                author: doc.author_name ? doc.author_name.join(', ') : 'Auteur inconnu',
                description: 'Résumé non disponible via Open Library.',
                pageCount: doc.number_of_pages_median || 0,
                coverUrl: coverUrl,
                isbn: doc.isbn ? doc.isbn[0] : null // Prend le premier ISBN dispo
            };
        });
    } catch (error) {
        console.error('[BookAPI] Erreur Open Library:', error.message);
        return [];
    }
}
