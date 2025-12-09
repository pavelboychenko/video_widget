import OpenAI from 'openai';
import { config } from '../config.js';
import { SiteKnowledgeBase } from './SiteKnowledgeBase.js';
import { SiteCrawler } from './SiteCrawler.js';
import { db } from '../database/db.js';

/**
 * Сервис для работы с чатом и OpenAI API
 */
export class ChatService {
    constructor() {
        if (!config.openai.apiKey) {
            throw new Error('OpenAI API key is not configured');
        }
        
        this.openai = new OpenAI({
            apiKey: config.openai.apiKey,
        });
    }

    /**
     * Проверяет и инициирует индексацию сайта при необходимости
     */
    async ensureSiteIndexed(siteDomain) {
        const knowledgeBase = new SiteKnowledgeBase(siteDomain);
        
        // Проверяем статус индексации
        const status = knowledgeBase.getIndexingStatus();
        
        if (status && status.status === 'in_progress') {
            // Индексация уже идет
            return { indexing: false, status: 'in_progress' };
        }

        if (!knowledgeBase.hasIndexedPages() && config.indexing.autoIndexOnFirstRequest) {
            // Запускаем индексацию асинхронно
            console.log(`🔄 Auto-starting indexing for ${siteDomain}`);
            this.startIndexingAsync(siteDomain);
            return { indexing: true, status: 'started' };
        }

        return { indexing: false, status: status?.status || 'completed' };
    }

    /**
     * Запускает индексацию асинхронно (не блокирует запрос)
     */
    async startIndexingAsync(siteDomain) {
        // Запускаем в фоне
        setImmediate(async () => {
            try {
                const crawler = new SiteCrawler(siteDomain);
                await crawler.index();
            } catch (error) {
                console.error(`Error indexing ${siteDomain}:`, error);
                const stmt = db.prepare(`
                    UPDATE site_indexing_status 
                    SET status = 'error', error_message = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE site_domain = ?
                `);
                stmt.run(error.message, siteDomain);
            }
        });
    }

    /**
     * Формирует системный промпт для ассистента
     */
    buildSystemPrompt(siteDomain, context) {
        return `Ты ассистент компании, работающей на сайте ${siteDomain}. 

Твоя задача — отвечать на вопросы пользователей на основе информации, которая есть на сайте компании.

ВАЖНЫЕ ПРАВИЛА:
1. Отвечай ТОЛЬКО на основе предоставленного контекста. Если информации нет — честно говори об этом.
2. Отвечай кратко, по делу, на естественном русском языке.
3. Если пользователь спрашивает о конкретной цене или услуге, которой нет в контексте — предложи обратиться к контактам на сайте.
4. Будь дружелюбным и профессиональным.
5. Не выдумывай информацию, которой нет в контексте.

КОНТЕКСТ О КОМПАНИИ:
${context || 'Информация о компании пока индексируется. Отвечай общими фразами и предлагай обратиться к контактам на сайте.'}`;
    }

    /**
     * Ограничивает историю сообщений
     */
    limitHistory(history, maxMessages = config.knowledgeBase.maxHistoryMessages) {
        if (!history || history.length === 0) {
            return [];
        }
        
        // Берем последние N сообщений, сохраняя пары user-assistant
        const limited = history.slice(-maxMessages);
        
        // Если последнее сообщение от ассистента, а первое в ограниченном списке от пользователя,
        // это нормально. Иначе можем обрезать неполную пару.
        return limited;
    }

    /**
     * Отправляет сообщение в OpenAI и получает ответ
     */
    async getChatResponse(siteDomain, userMessage, history = []) {
        // Проверяем/инициируем индексацию
        await this.ensureSiteIndexed(siteDomain);

        // Получаем контекст из базы знаний
        const knowledgeBase = new SiteKnowledgeBase(siteDomain);
        const context = knowledgeBase.hasIndexedPages() 
            ? knowledgeBase.buildContext(userMessage)
            : null;

        // Формируем системный промпт
        const systemPrompt = this.buildSystemPrompt(siteDomain, context);

        // Ограничиваем историю
        const limitedHistory = this.limitHistory(history);

        // Формируем сообщения для OpenAI
        const messages = [
            { role: 'system', content: systemPrompt },
            ...limitedHistory,
            { role: 'user', content: userMessage },
        ];

        try {
            const completion = await this.openai.chat.completions.create({
                model: config.openai.model,
                messages: messages,
                temperature: config.openai.temperature,
                max_tokens: config.openai.maxTokens,
            });

            const assistantMessage = completion.choices[0].message.content;
            const usage = completion.usage;

            return {
                answer: assistantMessage,
                meta: {
                    usedSiteDomain: siteDomain,
                    hasContext: !!context,
                    tokens: {
                        prompt: usage.prompt_tokens,
                        completion: usage.completion_tokens,
                        total: usage.total_tokens,
                    },
                },
            };
        } catch (error) {
            console.error('OpenAI API error:', error);
            
            // Обработка различных типов ошибок
            if (error.status === 429) {
                throw new Error('Превышен лимит запросов к OpenAI. Попробуйте позже.');
            } else if (error.status === 401) {
                throw new Error('Неверный API ключ OpenAI.');
            } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                throw new Error('Таймаут при обращении к OpenAI. Попробуйте еще раз.');
            } else {
                throw new Error(`Ошибка при обращении к OpenAI: ${error.message}`);
            }
        }
    }
}

