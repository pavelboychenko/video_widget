import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

export const config = {
    // OpenAI
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        maxTokens: 1000,
        temperature: 0.7,
    },
    
    // Server
    server: {
        port: parseInt(process.env.PORT || '3000', 10),
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
    
    // Indexing
    indexing: {
        enabled: process.env.INDEXING_ENABLED !== 'false',
        autoIndexOnFirstRequest: process.env.AUTO_INDEX_ON_FIRST_REQUEST !== 'false',
    },
};

// Validate required config
if (!config.openai.apiKey) {
    console.warn('⚠️  WARNING: OPENAI_API_KEY is not set in .env file');
}

