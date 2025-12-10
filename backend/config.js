import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

// Fallbacks (avoid empty API key / port conflicts)
const DEFAULT_OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const DEFAULT_PORT = 3001;

// Логирование для отладки (первые и последние символы ключа)
if (process.env.OPENAI_API_KEY) {
    const key = process.env.OPENAI_API_KEY;
    const preview = key.length > 20 
        ? `${key.substring(0, 10)}...${key.substring(key.length - 10)}` 
        : '***';
    console.log('🔑 OpenAI API Key loaded:', preview);
}

export const config = {
    // OpenAI
    openai: {
        apiKey: process.env.OPENAI_API_KEY || DEFAULT_OPENAI_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        maxTokens: 1000,
        temperature: 0.7,
    },
    
    // Server
    server: {
        port: parseInt(process.env.PORT || `${DEFAULT_PORT}`, 10),
        nodeEnv: process.env.NODE_ENV || 'development',
    },
    
    // Database
    database: {
        path: process.env.DB_PATH || join(__dirname, 'data', 'widget.db'),
    },
    
    // Crawler
    crawler: {
        maxDepth: parseInt(process.env.CRAWLER_MAX_DEPTH || '3', 10),
        maxPages: parseInt(process.env.CRAWLER_MAX_PAGES || '100', 10),
        userAgent: process.env.CRAWLER_USER_AGENT || 'Mozilla/5.0 (compatible; VideoWidgetBot/1.0)',
        timeout: 10000, // 10 seconds
        delay: 500, // 500ms between requests
    },
    
    // Context & Knowledge Base
    knowledgeBase: {
        maxContextLength: parseInt(process.env.MAX_CONTEXT_LENGTH || '8000', 10),
        maxHistoryMessages: parseInt(process.env.MAX_HISTORY_MESSAGES || '10', 10),
        priorityTypes: ['pricing', 'services', 'faq'], // Priority page types
    },

    // Proxy (например, для OpenAI)
    proxy: {
        // Формат: http://user:password@host:port
        openai: process.env.OPENAI_PROXY || '',
    },

    // Telegram
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        chatId: process.env.TELEGRAM_CHAT_ID || '',
        webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
        proxy: process.env.TELEGRAM_PROXY || '',
    },
    
    // Indexing
    indexing: {
        enabled: process.env.INDEXING_ENABLED !== 'false',
        // По умолчанию автоиндексацию отключаем (особенно для локального стенда)
        autoIndexOnFirstRequest: process.env.AUTO_INDEX_ON_FIRST_REQUEST === 'true',
    },
};

// Validate required config
if (!config.openai.apiKey) {
    console.warn('⚠️  WARNING: OPENAI_API_KEY is not set in .env file');
}

