import express from 'express';
import { SessionManager } from '../services/SessionManager.js';
import { queueManager } from '../services/QueueManager.js';
import { ManagerService } from '../services/ManagerService.js';

const router = express.Router();

/**
 * POST /manager/request
 * Пользователь запрашивает менеджера
 */
router.post('/manager/request', async (req, res) => {
    try {
        const { siteDomain, userId } = req.body;

        if (!siteDomain || !userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: siteDomain, userId',
            });
        }

        // Проверяем, есть ли уже активная сессия
        const existingSession = SessionManager.getActiveUserSession(siteDomain, userId);
        if (existingSession) {
            return res.json({
                success: true,
                status: existingSession.status,
                sessionId: existingSession.session_id,
                message: existingSession.status === 'active' 
                    ? 'Manager already connected' 
                    : 'Waiting for manager',
            });
        }

        // Создаем новую сессию
        const session = SessionManager.createSession(siteDomain, userId);
        
        // Добавляем в очередь
        queueManager.addToQueue(session);

        res.json({
            success: true,
            status: 'waiting',
            sessionId: session.sessionId,
            message: 'Request sent to managers',
        });
    } catch (error) {
        console.error('Manager request error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
});

/**
 * POST /manager/auth
 * Авторизация менеджера
 */
router.post('/manager/auth', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Missing email or password',
            });
        }

        const manager = await ManagerService.authenticate(email, password);
        
        if (!manager) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials',
            });
        }

        res.json({
            success: true,
            manager: {
                id: manager.id,
                email: manager.email,
                name: manager.name,
                siteDomain: manager.siteDomain,
            },
        });
    } catch (error) {
        console.error('Manager auth error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
});

/**
 * GET /manager/queue
 * Получить очередь для менеджера
 */
router.get('/manager/queue', (req, res) => {
    try {
        const { siteDomain } = req.query;
        const stats = queueManager.getQueueStats(siteDomain);
        
        res.json({
            success: true,
            ...stats,
        });
    } catch (error) {
        console.error('Queue stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
});

/**
 * GET /manager/sessions
 * Получить активные сессии менеджера
 */
router.get('/manager/sessions', (req, res) => {
    try {
        const { managerId } = req.query;
        
        if (!managerId) {
            return res.status(400).json({
                success: false,
                error: 'Missing managerId',
            });
        }

        const sessions = SessionManager.getManagerActiveSessions(managerId);
        
        res.json({
            success: true,
            sessions,
        });
    } catch (error) {
        console.error('Manager sessions error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
});

/**
 * POST /manager/create
 * Создание нового менеджера (для админки)
 */
router.post('/manager/create', async (req, res) => {
    try {
        const { email, password, name, siteDomain } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Missing email or password',
            });
        }

        const manager = await ManagerService.createManager(email, password, name, siteDomain);
        
        res.json({
            success: true,
            manager: {
                id: manager.id,
                email: manager.email,
                name: manager.name,
                siteDomain: manager.siteDomain,
            },
        });
    } catch (error) {
        console.error('Create manager error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
});

export default router;

