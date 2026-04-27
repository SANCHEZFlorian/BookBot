import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.OVERLAY_PORT || 8437;

app.use(express.static(path.join(__dirname, 'public')));

// --- API Livre Unique ---
app.get('/api/overlay/book/:bookId', async (req, res) => {
    try {
        const [books] = await db.query(
            `SELECT title, author, cover_url, total_pages, current_page FROM books WHERE id = ?`,
            [req.params.bookId]
        );

        if (books.length === 0) return res.json({ error: 'Livre introuvable' });

        const book = books[0];
        const percent = book.total_pages ? Math.floor((book.current_page / book.total_pages) * 100) : null;

        res.json({
            title: book.title,
            author: book.author,
            cover: book.cover_url,
            currentPage: book.current_page,
            totalPages: book.total_pages,
            percent: percent
        });
    } catch (err) {
        console.error('[API Book] Erreur:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// --- API Timer ---
app.get('/api/overlay/timer/:userId', async (req, res) => {
    try {
        // On récupère la session active lancée par cet utilisateur
        const [sessions] = await db.query(
            `SELECT id, sprint_minutes, started_at, status 
             FROM sessions 
             WHERE started_by = ? AND status IN ('active', 'break') 
             ORDER BY started_at DESC LIMIT 1`,
            [req.params.userId]
        );

        if (sessions.length === 0) return res.json({ error: 'Aucun sprint' });

        const session = sessions[0];
        const startTime = new Date(session.started_at).getTime();
        const endTime = startTime + (session.sprint_minutes * 60000);
        const now = Date.now();
        
        if (now < endTime && session.status === 'active') {
            res.json({ isActive: true, remainingMs: endTime - now });
        } else if (session.status === 'break') {
            res.json({ isActive: false, isBreak: true });
        } else {
            res.json({ error: 'Terminé' });
        }
    } catch (err) {
        console.error('[API Timer] Erreur:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// --- Routes HTML ---
app.get('/overlay/book/:bookId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'book.html'));
});

app.get('/overlay/timer/:userId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'timer.html'));
});

export function startOverlayServer() {
    app.listen(PORT, () => {
        console.log(`[Overlay] 🌐 Serveur web démarré sur le port ${PORT}`);
    });
}
