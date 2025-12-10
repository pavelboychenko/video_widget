import axios from 'axios';
import { config } from '../config.js';

/**
 * Простая обертка для Telegram Bot API
 */
export class TelegramService {
    constructor() {
        if (!config.telegram.botToken) {
            throw new Error('TELEGRAM_BOT_TOKEN is not configured');
        }
        if (!config.telegram.chatId) {
            throw new Error('TELEGRAM_CHAT_ID is not configured');
        }

        const baseURL = `https://api.telegram.org/bot${config.telegram.botToken}`;
        const proxyUrl = config.telegram.proxy || config.proxy?.openai || '';

        let axiosConfig = { baseURL };

        if (proxyUrl) {
            try {
                const u = new URL(proxyUrl);
                axiosConfig = {
                    ...axiosConfig,
                    proxy: {
                        protocol: u.protocol.replace(':', '') || 'http',
                        host: u.hostname,
                        port: Number(u.port || (u.protocol === 'https:' ? 443 : 80)),
                        auth: u.username
                            ? {
                                username: u.username,
                                password: u.password || '',
                              }
                            : undefined,
                    },
                };
            } catch (err) {
                console.warn('Invalid TELEGRAM_PROXY, fallback without proxy:', err?.message);
            }
        }

        this.api = axios.create(axiosConfig);
        this.chatId = config.telegram.chatId;
        this.webhookSecret = config.telegram.webhookSecret || '';
    }

    /**
     * Отправка текстового сообщения
     */
    async sendMessage(text, extra = {}) {
        const safeText = (text || '').toString();
        const truncated = safeText.length > 3500 ? `${safeText.slice(0, 3500)}…` : safeText;

        await this.api.post('/sendMessage', {
            chat_id: this.chatId,
            text: truncated,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            ...extra,
        });
    }

    /**
     * Установка вебхука
     */
    async setWebhook(url) {
        const payload = {
            url,
            drop_pending_updates: true,
        };

        if (this.webhookSecret) {
            payload.secret_token = this.webhookSecret;
        }

        const res = await this.api.post('/setWebhook', payload);
        return res.data;
    }
}
