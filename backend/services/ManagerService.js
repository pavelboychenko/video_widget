import bcrypt from 'bcrypt';
import { db } from '../database/db.js';
import { randomBytes } from 'crypto';

/**
 * Сервис для управления менеджерами
 */
export class ManagerService {
    /**
     * Создает нового менеджера
     */
    static async createManager(email, password, name = null, siteDomain = null) {
        const managerId = `mngr_${randomBytes(8).toString('hex')}`;
        const passwordHash = await bcrypt.hash(password, 10);
        
        const stmt = db.prepare(`
            INSERT INTO managers (id, email, password_hash, name, site_domain)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        try {
            stmt.run(managerId, email, passwordHash, name, siteDomain);
            return { id: managerId, email, name, siteDomain };
        } catch (error) {
            if (error.message.includes('UNIQUE constraint')) {
                throw new Error('Manager with this email already exists');
            }
            throw error;
        }
    }

    /**
     * Авторизация менеджера
     */
    static async authenticate(email, password) {
        const stmt = db.prepare('SELECT * FROM managers WHERE email = ?');
        const manager = stmt.get(email);
        
        if (!manager) {
            return null;
        }
        
        const isValid = await bcrypt.compare(password, manager.password_hash);
        if (!isValid) {
            return null;
        }
        
        // Обновляем last_seen_at
        const updateStmt = db.prepare(`
            UPDATE managers 
            SET last_seen_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        updateStmt.run(manager.id);
        
        return {
            id: manager.id,
            email: manager.email,
            name: manager.name,
            siteDomain: manager.site_domain,
            online: manager.online,
        };
    }

    /**
     * Устанавливает статус онлайн/офлайн
     */
    static setOnlineStatus(managerId, online) {
        const stmt = db.prepare(`
            UPDATE managers 
            SET online = ?, last_seen_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        stmt.run(online ? 1 : 0, managerId);
    }

    /**
     * Получает список онлайн менеджеров
     */
    static getOnlineManagers(siteDomain = null) {
        let query = 'SELECT id, email, name, site_domain FROM managers WHERE online = 1';
        const params = [];
        
        if (siteDomain) {
            query += ' AND (site_domain = ? OR site_domain IS NULL)';
            params.push(siteDomain);
        }
        
        const stmt = db.prepare(query);
        return stmt.all(...params);
    }

    /**
     * Получает менеджера по ID
     */
    static getManager(managerId) {
        const stmt = db.prepare('SELECT id, email, name, site_domain, online FROM managers WHERE id = ?');
        return stmt.get(managerId);
    }
}

