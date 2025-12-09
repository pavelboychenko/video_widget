import { EventEmitter } from 'events';
import { SessionManager } from './SessionManager.js';
import { ManagerService } from './ManagerService.js';

/**
 * Менеджер очереди запросов к менеджерам
 */
export class QueueManager extends EventEmitter {
    constructor() {
        super();
        this.waitingSessions = new Map(); // sessionId -> session data
        this.managerSockets = new Map(); // managerId -> socket
        this.userSockets = new Map(); // sessionId -> socket
    }

    /**
     * Добавляет сессию в очередь
     */
    addToQueue(session) {
        this.waitingSessions.set(session.sessionId, session);
        this.notifyManagers(session);
        this.emit('session_waiting', session);
    }

    /**
     * Уведомляет онлайн менеджеров о новой сессии
     */
    notifyManagers(session) {
        const onlineManagers = ManagerService.getOnlineManagers(session.siteDomain);
        
        onlineManagers.forEach(manager => {
            const socket = this.managerSockets.get(manager.id);
            if (socket) {
                socket.emit('new_session_available', {
                    sessionId: session.sessionId,
                    siteDomain: session.siteDomain,
                    userId: session.userId,
                    createdAt: session.created_at,
                });
            }
        });
    }

    /**
     * Регистрирует менеджера (WebSocket соединение)
     */
    registerManager(managerId, socket) {
        this.managerSockets.set(managerId, socket);
        
        // Отправляем текущие ожидающие сессии
        const waitingSessions = SessionManager.getWaitingSessions();
        socket.emit('queue_update', waitingSessions);
        
        socket.on('disconnect', () => {
            this.managerSockets.delete(managerId);
            ManagerService.setOnlineStatus(managerId, false);
        });
    }

    /**
     * Регистрирует пользователя (WebSocket соединение)
     */
    registerUser(sessionId, socket) {
        this.userSockets.set(sessionId, socket);
        
        socket.on('disconnect', () => {
            this.userSockets.delete(sessionId);
        });
    }

    /**
     * Менеджер принимает сессию
     */
    acceptSession(sessionId, managerId) {
        const session = this.waitingSessions.get(sessionId);
        if (!session) {
            return { success: false, error: 'Session not found in queue' };
        }

        const success = SessionManager.assignManager(sessionId, managerId);
        if (!success) {
            return { success: false, error: 'Failed to assign manager' };
        }

        this.waitingSessions.delete(sessionId);

        // Уведомляем пользователя
        const userSocket = this.userSockets.get(sessionId);
        if (userSocket) {
            const manager = ManagerService.getManager(managerId);
            userSocket.emit('manager_connected', {
                sessionId,
                managerId,
                managerName: manager?.name || 'Менеджер',
            });
        }

        // Уведомляем других менеджеров об обновлении очереди
        this.broadcastQueueUpdate();

        this.emit('session_accepted', { sessionId, managerId });

        return { success: true, session };
    }

    /**
     * Отправляет сообщение между пользователем и менеджером
     */
    sendMessage(sessionId, from, senderId, message) {
        const session = SessionManager.getSession(sessionId);
        if (!session || session.status !== 'active') {
            return { success: false, error: 'Session not active' };
        }

        // Сохраняем в БД
        SessionManager.saveMessage(sessionId, from, senderId, message);

        // Определяем получателя
        let targetSocket = null;
        if (from === 'user') {
            // Отправляем менеджеру
            const managerSocket = this.managerSockets.get(session.manager_id);
            if (managerSocket) {
                managerSocket.emit('chat_message', {
                    sessionId,
                    from: 'user',
                    senderId,
                    message,
                    timestamp: new Date().toISOString(),
                });
            }
        } else {
            // Отправляем пользователю
            const userSocket = this.userSockets.get(sessionId);
            if (userSocket) {
                userSocket.emit('chat_message', {
                    sessionId,
                    from: 'manager',
                    senderId,
                    message,
                    timestamp: new Date().toISOString(),
                });
            }
        }

        return { success: true };
    }

    /**
     * Рассылает обновление очереди всем менеджерам
     */
    broadcastQueueUpdate() {
        const waitingSessions = Array.from(this.waitingSessions.values());
        this.managerSockets.forEach((socket) => {
            socket.emit('queue_update', waitingSessions);
        });
    }

    /**
     * Получает статистику очереди
     */
    getQueueStats(siteDomain = null) {
        const waiting = SessionManager.getWaitingSessions(siteDomain);
        const onlineManagers = ManagerService.getOnlineManagers(siteDomain);
        
        return {
            waitingCount: waiting.length,
            onlineManagersCount: onlineManagers.length,
            waitingSessions: waiting,
        };
    }
}

// Singleton instance
export const queueManager = new QueueManager();

