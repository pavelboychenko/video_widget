import { db } from '../database/db.js';
import { config } from '../config.js';

/**
 * Сервис для извлечения релевантного контекста из проиндексированных страниц
 */
export class SiteKnowledgeBase {
    constructor(siteDomain) {
        this.siteDomain = siteDomain;
    }

    /**
     * Простой полнотекстовый поиск по контенту
     */
    searchRelevantPages(query, limit = 10) {
        const queryWords = query.toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 2)
            .map(word => word.replace(/[^\wа-яё]/gi, ''))
            .filter(word => word.length > 0);

        if (queryWords.length === 0) {
            // Если нет значимых слов, возвращаем приоритетные страницы
            return this.getPriorityPages(limit);
        }

        // Поиск страниц, содержащих слова запроса
        const placeholders = queryWords.map(() => '?').join(',');
        const queryPattern = queryWords.map(() => 'content LIKE ?').join(' OR ');

        const stmt = db.prepare(`
            SELECT url, title, content, type
            FROM site_pages
            WHERE site_domain = ?
            AND (${queryPattern})
            ORDER BY 
                CASE 
                    WHEN type IN ('pricing', 'services', 'faq') THEN 1
                    ELSE 2
                END,
                updated_at DESC
            LIMIT ?
        `);

        const searchPatterns = queryWords.map(word => `%${word}%`);
        return stmt.all(this.siteDomain, ...searchPatterns, limit);
    }

    /**
     * Получает приоритетные страницы (услуги, цены, FAQ)
     */
    getPriorityPages(limit = 5) {
        const stmt = db.prepare(`
            SELECT url, title, content, type
            FROM site_pages
            WHERE site_domain = ?
            AND type IN ('pricing', 'services', 'faq')
            ORDER BY 
                CASE type
                    WHEN 'pricing' THEN 1
                    WHEN 'services' THEN 2
                    WHEN 'faq' THEN 3
                    ELSE 4
                END,
                updated_at DESC
            LIMIT ?
        `);

        return stmt.all(this.siteDomain, limit);
    }

    /**
     * Получает общую информацию о компании (главная страница, контакты)
     */
    getGeneralInfo() {
        const stmt = db.prepare(`
            SELECT url, title, content, type
            FROM site_pages
            WHERE site_domain = ?
            AND (type = 'general' OR url LIKE '%index%' OR url LIKE '%home%' OR url = ?)
            ORDER BY 
                CASE WHEN url = ? THEN 1 ELSE 2 END,
                updated_at DESC
            LIMIT 3
        `);

        const baseUrl = `https://${this.siteDomain}`;
        return stmt.all(this.siteDomain, baseUrl, baseUrl);
    }

    /**
     * Формирует структурированный контекст для OpenAI
     */
    buildContext(userQuestion) {
        const contextParts = [];
        let totalLength = 0;
        const maxLength = config.knowledgeBase.maxContextLength;

        // 1. Общая информация о компании
        const generalInfo = this.getGeneralInfo();
        if (generalInfo.length > 0) {
            const infoText = generalInfo.map(page => {
                const title = page.title ? `[${page.title}]` : '';
                return `${title}\n${page.content.substring(0, 1000)}`;
            }).join('\n\n');
            
            if (totalLength + infoText.length < maxLength) {
                contextParts.push(`[ИНФОРМАЦИЯ О КОМПАНИИ]\n${infoText}`);
                totalLength += infoText.length;
            }
        }

        // 2. Релевантные страницы по запросу
        const relevantPages = this.searchRelevantPages(userQuestion, 8);
        if (relevantPages.length > 0) {
            const services = [];
            const pricing = [];
            const faq = [];
            const other = [];

            relevantPages.forEach(page => {
                const pageText = `[${page.title || page.url}]\n${page.content.substring(0, 1500)}`;
                
                if (page.type === 'services') services.push(pageText);
                else if (page.type === 'pricing') pricing.push(pageText);
                else if (page.type === 'faq') faq.push(pageText);
                else other.push(pageText);
            });

            // Добавляем по приоритету, пока не превысим лимит
            if (services.length > 0 && totalLength < maxLength * 0.4) {
                const text = `[УСЛУГИ]\n${services.join('\n\n')}`;
                if (totalLength + text.length < maxLength) {
                    contextParts.push(text);
                    totalLength += text.length;
                }
            }

            if (pricing.length > 0 && totalLength < maxLength * 0.7) {
                const text = `[ЦЕНЫ И ТАРИФЫ]\n${pricing.join('\n\n')}`;
                if (totalLength + text.length < maxLength) {
                    contextParts.push(text);
                    totalLength += text.length;
                }
            }

            if (faq.length > 0 && totalLength < maxLength * 0.9) {
                const text = `[FAQ / ЧАСТО ЗАДАВАЕМЫЕ ВОПРОСЫ]\n${faq.join('\n\n')}`;
                if (totalLength + text.length < maxLength) {
                    contextParts.push(text);
                    totalLength += text.length;
                }
            }

            if (other.length > 0 && totalLength < maxLength * 0.95) {
                const text = `[ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ]\n${other.slice(0, 3).join('\n\n')}`;
                if (totalLength + text.length < maxLength) {
                    contextParts.push(text);
                }
            }
        }

        return contextParts.join('\n\n---\n\n');
    }

    /**
     * Проверяет, есть ли проиндексированные страницы для домена
     */
    hasIndexedPages() {
        const stmt = db.prepare('SELECT COUNT(*) as count FROM site_pages WHERE site_domain = ?');
        const result = stmt.get(this.siteDomain);
        return result.count > 0;
    }

    /**
     * Получает статус индексации
     */
    getIndexingStatus() {
        const stmt = db.prepare('SELECT * FROM site_indexing_status WHERE site_domain = ?');
        return stmt.get(this.siteDomain);
    }
}

