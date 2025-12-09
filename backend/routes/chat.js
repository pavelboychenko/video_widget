import express from 'express';
import { ChatService } from '../services/ChatService.js';
import { SiteCrawler } from '../services/SiteCrawler.js';
import { SiteKnowledgeBase } from '../services/SiteKnowledgeBase.js';

const router = express.Router();
const chatService = new ChatService();

/**
 * POST /chat
 * Основной endpoint для чата с ИИ
 */
router.post('/chat', async (req, res) => {
    try {
        const { siteDomain, userId, message, history } = req.body;

        // Валидация
        if (!siteDomain || !userId || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: siteDomain, userId, message',
            });
        }

        if (typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Message must be a non-empty string',
            });
        }

        // Получаем ответ от ИИ
        const response = await chatService.getChatResponse(
            siteDomain,
            message.trim(),
            history || []
        );

        res.json({
            success: true,
            answer: response.answer,
            meta: response.meta,
        });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
});

/**
 * POST /site/init
 * Ручной триггер индексации сайта
 */
router.post('/site/init', async (req, res) => {
    try {
        const { siteDomain } = req.body;

        if (!siteDomain) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: siteDomain',
            });
        }

        const knowledgeBase = new SiteKnowledgeBase(siteDomain);
        const status = knowledgeBase.getIndexingStatus();

        // Если уже идет индексация
        if (status && status.status === 'in_progress') {
            return res.json({
                success: true,
                status: 'in_progress',
                message: 'Indexing is already in progress',
            });
        }

        // Запускаем индексацию асинхронно
        chatService.startIndexingAsync(siteDomain);

        res.json({
            success: true,
            status: 'started',
            message: 'Indexing started',
        });
    } catch (error) {
        console.error('Site init error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
});

/**
 * GET /site/status
 * Получить статус индексации сайта
 */
router.get('/site/status', (req, res) => {
    try {
        const { siteDomain } = req.query;

        if (!siteDomain) {
            return res.status(400).json({
                success: false,
                error: 'Missing required query parameter: siteDomain',
            });
        }

        const knowledgeBase = new SiteKnowledgeBase(siteDomain);
        const status = knowledgeBase.getIndexingStatus();
        const hasPages = knowledgeBase.hasIndexedPages();

        res.json({
            success: true,
            status: status?.status || 'not_started',
            pagesCount: status?.pages_count || 0,
            hasIndexedPages: hasPages,
            lastIndexedAt: status?.last_indexed_at || null,
        });
    } catch (error) {
        console.error('Site status error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
});

export default router;

