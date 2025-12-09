import { db } from '../database/db.js';
import { randomBytes } from 'crypto';

/**
 * Управление сессиями чата с менеджерами
 */
export class SessionManager {
    /**
     * Создает новую сессию и ставит в очередь
     */
    static createSession(siteDomain, userId) {
        const sessionId = `session_${randomBytes(16).toString('hex')}`;
        
        const stmt = db.prepare(`
            INSERT INTO chat_sessions (session_id, site_domain, user_id, status)
            VALUES (?, ?, ?, 'waiting')
        `);
        
        stmt.run(sessionId, siteDomain, userId);
        
        return {
            sessionId,
            siteDomain,
            userId,
            status: 'waiting',
        };
    }

    /**
     * Получает сессию по ID
     */
    static getSession(sessionId) {
        const stmt = db.prepare('SELECT * FROM chat_sessions WHERE session_id = ?');
        return stmt.get(sessionId);
    }

    /**
     * Получает активную сессию пользователя
     */
    static getActiveUserSession(siteDomain, userId) {
        const stmt = db.prepare(`
            SELECT * FROM chat_sessions 
            WHERE site_domain = ? AND user_id = ? AND status IN ('waiting', 'active')
            ORDER BY created_at DESC
            LIMIT 1
        `);
        return stmt.get(siteDomain, userId);
    }

    /**
     * Менеджер принимает сессию
     */
    static assignManager(sessionId, managerId) {
        const stmt = db.prepare(`
            UPDATE chat_sessions 
            SET manager_id = ?, status = 'active', last_message_at = CURRENT_TIMESTAMP
            WHERE session_id = ? AND status = 'waiting'
        `);
        const result = stmt.run(managerId, sessionId);
        return result.changes > 0;
    }

    /**
     * Закрывает сессию
     */
    static closeSession(sessionId) {
        const stmt = db.prepare(`
            UPDATE chat_sessions 
            SET status = 'closed', closed_at = CURRENT_TIMESTAMP
            WHERE session_id = ?
        `);
        stmt.run(sessionId);
    }

    /**
     * Получает сессии в очереди для менеджера
     */
    static getWaitingSessions(siteDomain = null) {
        let query = 'SELECT * FROM chat_sessions WHERE status = \'waiting\'';
        const params = [];
        
        if (siteDomain) {
            query += ' AND site_domain = ?';
            params.push(siteDomain);
        }
        
        query += ' ORDER BY created_at ASC';
        
        const stmt = db.prepare(query);
        return stmt.all(...params);
    }

    /**
     * Получает активные сессии менеджера
     */
    static getManagerActiveSessions(managerId) {
        const stmt = db.prepare(`
            SELECT * FROM chat_sessions 
            WHERE manager_id = ? AND status = 'active'
            ORDER BY last_message_at DESC
        `);
        return stmt.all(managerId);
    }

    /**
     * Сохраняет сообщение в БД
     */
    static saveMessage(sessionId, sender, senderId, message) {
        const stmt = db.prepare(`
            INSERT INTO chat_messages (session_id, sender, sender_id, message)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(sessionId, sender, senderId, message);
        
        // Обновляем last_message_at в сессии
        const updateStmt = db.prepare(`
            UPDATE chat_sessions 
            SET last_message_at = CURRENT_TIMESTAMP
            WHERE session_id = ?
        `);
        updateStmt.run(sessionId);
    }

    /**
     * Получает историю сообщений сессии
     */
    static getSessionMessages(sessionId, limit = 100) {
        const stmt = db.prepare(`
            SELECT * FROM chat_messages 
            WHERE session_id = ?
            ORDER BY created_at ASC
            LIMIT ?
        `);
        return stmt.all(sessionId, limit);
    }
}

