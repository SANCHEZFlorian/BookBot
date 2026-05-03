import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

/**
 * Scrape toutes les pages d'une PAL Livraddict
 * @param {string} url L'URL de la PAL (?goto=pal)
 * @returns {Promise<{books: Array, maxPage: number}|null>}
 */
export async function scrapeLivraddictPAL(url) {
    const fetchPage = async (pageUrl) => {
        try {
            const response = await fetch(pageUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36' },
                timeout: 15000 
            });
            if (!response.ok) return null;
            return await response.text();
        } catch (e) {
            console.error(`[Scraper] Erreur fetch ${pageUrl}:`, e.message);
            return null;
        }
    };

    const htmlInitial = await fetchPage(url);
    if (!htmlInitial) return null;

    const $init = cheerio.load(htmlInitial);
    let maxPage = 1;
    $init('a[href*="page="]').each((i, el) => {
        const href = $init(el).attr('href');
        const match = href.match(/page=(\d+)/);
        if (match) {
            const p = parseInt(match[1]);
            if (p > maxPage) maxPage = p;
        }
    });

    if (maxPage > 20) maxPage = 20;
    const allBooks = [];
    const baseUrl = url.split('?')[0];

    for (let p = 1; p <= maxPage; p++) {
        const pageUrl = `${baseUrl}?page=${p}&goto=pal`;
        const html = (p === 1 && !url.includes('page=')) ? htmlInitial : await fetchPage(pageUrl);
        if (!html) continue;

        const $page = cheerio.load(html);
        $page('.bibliotheque_list li').each((i, el) => {
            const title = $page(el).find('h2 a').first().text().trim();
            const author = $page(el).find('p a[href*="/biblio/auteur/"]').first().text().trim();
            let coverUrl = $page(el).find('img.miniature').attr('src');
            
            if (coverUrl && coverUrl.startsWith('/')) {
                coverUrl = 'https://www.livraddict.com' + coverUrl;
            }
            
            const allText = $page(el).text();
            const pagesMatch = allText.match(/(\d+)\s*pages/);
            const totalPages = pagesMatch ? parseInt(pagesMatch[1]) : null;

            if (title) {
                allBooks.push({ title, author, coverUrl, totalPages });
            }
        });
        if (maxPage > 1) await new Promise(r => setTimeout(r, 1000));
    }

    return { books: allBooks, maxPage };
}
