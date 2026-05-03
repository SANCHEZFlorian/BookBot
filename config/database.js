import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// Pool de connexions MySQL réutilisable
const pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'bookbot',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'bookbot',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    charset:  'utf8mb4',
});

/**
 * Initialise la BDD : vérifie la connexion et crée les tables si elles n'existent pas.
 */
export async function initDatabase() {
    try {
        const conn = await pool.getConnection();
        console.log('[DB] ✅ Connexion MySQL établie.');
        conn.release();

        await createTables();
        console.log('[DB] ✅ Tables vérifiées/créées.');
    } catch (err) {
        console.error('[DB] ❌ Erreur de connexion MySQL :', err.message);
        process.exit(1);
    }
}

async function createTables() {
    const queries = [
        // Guilds
        `CREATE TABLE IF NOT EXISTS guilds (
            guild_id            VARCHAR(20)  NOT NULL,
            guild_name          VARCHAR(100) DEFAULT NULL,
            session_channel_id  VARCHAR(20)  DEFAULT NULL,
            announce_channel_id VARCHAR(20)  DEFAULT NULL,
            reader_role_id      VARCHAR(20)  DEFAULT NULL,
            voice_hub_id        VARCHAR(20)  DEFAULT NULL,
            voice_category_id   VARCHAR(20)  DEFAULT NULL,
            log_msg_id          VARCHAR(20)  DEFAULT NULL,
            log_voice_id        VARCHAR(20)  DEFAULT NULL,
            log_member_id       VARCHAR(20)  DEFAULT NULL,
            reviews_channel_id  VARCHAR(20)  DEFAULT NULL,
            welcome_channel_id  VARCHAR(20)  DEFAULT NULL,
            session_manager_role_id VARCHAR(20) DEFAULT NULL,
            music_volume        INT          NOT NULL DEFAULT 50,
            created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (guild_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        // Users
        `CREATE TABLE IF NOT EXISTS users (
            user_id          VARCHAR(20)  NOT NULL,
            display_name     VARCHAR(100) DEFAULT NULL,
            livraddict_url   VARCHAR(500) DEFAULT NULL,
            pal_url          VARCHAR(500) DEFAULT NULL,
            total_pages_read INT          NOT NULL DEFAULT 0,
            level_id         INT          NOT NULL DEFAULT 1,
            created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        // Books
        `CREATE TABLE IF NOT EXISTS books (
            id             INT          NOT NULL AUTO_INCREMENT,
            user_id        VARCHAR(20)  NOT NULL,
            google_book_id VARCHAR(100) DEFAULT NULL,
            title          VARCHAR(300) NOT NULL,
            author         VARCHAR(200) DEFAULT NULL,
            cover_url      TEXT         DEFAULT NULL,
            total_pages    INT          DEFAULT NULL,
            current_page   INT          NOT NULL DEFAULT 0,
            status         ENUM('to_read','reading','read','abandoned') NOT NULL DEFAULT 'to_read',
            is_current     TINYINT(1)   NOT NULL DEFAULT 0,
            notes          TEXT         DEFAULT NULL,
            added_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            started_at     TIMESTAMP    NULL DEFAULT NULL,
            finished_at    TIMESTAMP    NULL DEFAULT NULL,
            PRIMARY KEY (id),
            KEY idx_user_status (user_id, status),
            KEY idx_user_current (user_id, is_current)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        // Sessions
        `CREATE TABLE IF NOT EXISTS sessions (
            id            INT          NOT NULL AUTO_INCREMENT,
            guild_id      VARCHAR(20)  NOT NULL,
            started_by    VARCHAR(20)  NOT NULL,
            session_minutes INT         NOT NULL DEFAULT 45,
            break_minutes  INT         NOT NULL DEFAULT 15,
            status        ENUM('active','break','ended') NOT NULL DEFAULT 'active',
            message_id    VARCHAR(20)  DEFAULT NULL,
            channel_id    VARCHAR(20)  DEFAULT NULL,
            started_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ended_at      TIMESTAMP    NULL DEFAULT NULL,
            PRIMARY KEY (id),
            KEY idx_guild_status (guild_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        // Session scores
        `CREATE TABLE IF NOT EXISTS session_scores (
            id           INT          NOT NULL AUTO_INCREMENT,
            session_id   INT          NOT NULL,
            user_id      VARCHAR(20)  NOT NULL,
            pages_read   INT          NOT NULL DEFAULT 0,
            submitted_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_session_user (session_id, user_id),
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        // Reading levels
        `CREATE TABLE IF NOT EXISTS reading_levels (
            id        INT          NOT NULL AUTO_INCREMENT,
            name      VARCHAR(50)  NOT NULL,
            emoji     VARCHAR(10)  NOT NULL,
            min_pages INT          NOT NULL DEFAULT 0,
            color     VARCHAR(7)   NOT NULL DEFAULT '#D4A853',
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        // Book Reviews
        `CREATE TABLE IF NOT EXISTS book_reviews (
            id             INT          NOT NULL AUTO_INCREMENT,
            user_id        VARCHAR(20)  NOT NULL,
            google_book_id VARCHAR(100) NOT NULL,
            book_title     VARCHAR(300) NOT NULL,
            rating         INT          NOT NULL,
            comment        TEXT         NOT NULL,
            thread_id      VARCHAR(20)  DEFAULT NULL,
            message_id     VARCHAR(20)  DEFAULT NULL,
            created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_book_reviews (google_book_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        // Seed des niveaux
        `INSERT IGNORE INTO reading_levels (id, name, emoji, min_pages, color) VALUES
            (1, 'Novice',           '📖', 0,     '#8B7355'),
            (2, 'Apprenti Lecteur', '✨', 100,   '#D4A853'),
            (3, 'Lecteur Assidu',   '🌿', 500,   '#7A9E7E'),
            (4, 'Bibliophile',      '🔖', 1500,  '#C8A2C8'),
            (5, 'Érudit',           '🦉', 3500,  '#5B8DD9'),
            (6, 'Sage des Livres',  '📜', 7500,  '#9B59B6'),
            (7, 'Grand Sage',       '⭐', 15000, '#FFD700')`,
    ];

    for (const q of queries) {
        await pool.query(q);
    }

    // --- MIGRATIONS (Ajout des colonnes manquantes si la table existe déjà) ---
    const migrations = [
        "ALTER TABLE guilds ADD voice_hub_id VARCHAR(20) DEFAULT NULL",
        "ALTER TABLE guilds ADD voice_category_id VARCHAR(20) DEFAULT NULL",
        "ALTER TABLE guilds ADD log_msg_id VARCHAR(20) DEFAULT NULL",
        "ALTER TABLE guilds ADD log_voice_id VARCHAR(20) DEFAULT NULL",
        "ALTER TABLE guilds ADD log_member_id VARCHAR(20) DEFAULT NULL",
        "ALTER TABLE guilds ADD reviews_channel_id VARCHAR(20) DEFAULT NULL",
        "ALTER TABLE guilds ADD welcome_channel_id VARCHAR(20) DEFAULT NULL",
        "ALTER TABLE guilds ADD session_manager_role_id VARCHAR(20) DEFAULT NULL",
        "ALTER TABLE users ADD pal_url VARCHAR(500) DEFAULT NULL",
        "ALTER TABLE sessions CHANGE sprint_minutes session_minutes INT NOT NULL DEFAULT 45",
        "ALTER TABLE guilds ADD music_volume INT NOT NULL DEFAULT 50",
        "ALTER TABLE book_reviews ADD thread_id VARCHAR(20) DEFAULT NULL",
        "ALTER TABLE book_reviews ADD message_id VARCHAR(20) DEFAULT NULL"
    ];

    for (const m of migrations) {
        try {
            await pool.query(m);
        } catch (err) {
            // On ignore l'erreur si la colonne existe déjà (ER_DUP_FIELDNAME)
        }
    }
}

export default pool;
