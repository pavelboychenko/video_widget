import express from 'express';
import { TelegramService } from '../services/TelegramService.js';
import { config } from '../config.js';

const router = express.Router();

function getTelegramService(res) {
    try {
        return new TelegramService();
    } catch (err) {
        console.error('Telegram config error:', err.message);
        if (res) {
            res.status(500).json({ success: false, error: 'Telegram is not configured' });
        }
        return null;
    }
}

/**
 * Webhook для Telegram (пока только для подтверждения и логов)
 */
router.post('/telegram/webhook', express.json(), async (req, res) => {
    // Проверяем секрет, если задан
    if (config.telegram.webhookSecret) {
        const token = req.header('x-telegram-bot-api-secret-token');
        if (token !== config.telegram.webhookSecret) {
            return res.status(401).json({ ok: false });
        }
    }

    const update = req.body || {};
    const message = update.message;

    if (message?.text) {
        console.log('Telegram webhook update text:', message.text);
    } else {
        console.log('Telegram webhook update received (ignored type)');
    }

    return res.json({ ok: true });
});

/**
 * Эндпоинт для пересылки вопросов из виджета в Telegram
 */
router.post('/telegram/forward', express.json(), async (req, res) => {
    const { siteDomain, userId, message } = req.body || {};

    if (!siteDomain || !userId || !message) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: siteDomain, userId, message',
        });
    }

    const tg = getTelegramService(res);
    if (!tg) return;

    const text = [
        '🔔 Новый вопрос с сайта',
        `🌐 Домен: ${siteDomain}`,
        `🙋 Пользователь: ${userId}`,
        '',
        '💬 Вопрос:',
        message,
    ].join('\n');

    try {
        await tg.sendMessage(text);
        return res.json({ success: true });
    } catch (error) {
        console.error('Telegram forward error:', error?.response?.data || error?.message || error);
        return res.status(500).json({
            success: false,
            error: 'Failed to send message to Telegram',
        });
    }
});

export default router;
