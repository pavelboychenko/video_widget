import Database from 'better-sqlite3';
import { config } from '../config.js';
import { dirname } from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure data directory exists
const dbDir = dirname(config.database.path);
mkdirSync(dbDir, { recursive: true });

// Initialize database
export const db = new Database(config.database.path);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize tables
db.exec(`
    CREATE TABLE IF NOT EXISTS site_pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_domain TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'general',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(site_domain, url)
    );

    CREATE INDEX IF NOT EXISTS idx_site_domain ON site_pages(site_domain);
    CREATE INDEX IF NOT EXISTS idx_site_type ON site_pages(site_domain, type);
    CREATE INDEX IF NOT EXISTS idx_site_updated ON site_pages(site_domain, updated_at DESC);

    CREATE TABLE IF NOT EXISTS site_indexing_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_domain TEXT NOT NULL UNIQUE,
        status TEXT DEFAULT 'pending',
        pages_count INTEGER DEFAULT 0,
        last_indexed_at DATETIME,
        started_at DATETIME,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_indexing_status ON site_indexing_status(status);

    CREATE TABLE IF NOT EXISTS chat_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        site_domain TEXT NOT NULL,
        user_id TEXT NOT NULL,
        manager_id TEXT,
        status TEXT DEFAULT 'waiting',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (manager_id) REFERENCES managers(id)
    );

    CREATE INDEX IF NOT EXISTS idx_chat_site_user ON chat_sessions(site_domain, user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_status ON chat_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_chat_manager ON chat_sessions(manager_id);
    CREATE INDEX IF NOT EXISTS idx_chat_last_message ON chat_sessions(last_message_at DESC);

    CREATE TABLE IF NOT EXISTS managers (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        online BOOLEAN DEFAULT 0,
        site_domain TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_managers_email ON managers(email);
    CREATE INDEX IF NOT EXISTS idx_managers_online ON managers(online, site_domain);
    CREATE INDEX IF NOT EXISTS idx_managers_site ON managers(site_domain);

    CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id, created_at);
`);

console.log('✅ Database initialized');

export default db;

