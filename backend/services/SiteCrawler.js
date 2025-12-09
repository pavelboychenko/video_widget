import * as cheerio from 'cheerio';
import axios from 'axios';
import { URL } from 'url';
import { config } from '../config.js';
import { db } from '../database/db.js';

/**
 * Сервис для парсинга и индексации сайтов
 */
export class SiteCrawler {
    constructor(siteDomain) {
        this.siteDomain = siteDomain;
        this.baseUrl = `https://${siteDomain}`;
        this.visitedUrls = new Set();
        this.pagesToVisit = [];
        this.pagesProcessed = 0;
        this.maxDepth = config.crawler.maxDepth;
        this.maxPages = config.crawler.maxPages;
    }

    /**
     * Определяет тип страницы на основе контента
     */
    detectPageType(url, title, content) {
        const lowerContent = content.toLowerCase();
        const lowerTitle = title?.toLowerCase() || '';
        const lowerUrl = url.toLowerCase();

        // Проверка на цены/тарифы
        const pricingKeywords = ['цена', 'стоимость', 'тариф', 'пакет', 'руб', '₽', '$', 'eur', '€', 'прайс'];
        if (pricingKeywords.some(kw => lowerContent.includes(kw) || lowerTitle.includes(kw) || lowerUrl.includes(kw))) {
            return 'pricing';
        }

        // Проверка на услуги
        const servicesKeywords = ['услуг', 'сервис', 'решение', 'продукт', 'что мы делаем'];
        if (servicesKeywords.some(kw => lowerContent.includes(kw) || lowerTitle.includes(kw) || lowerUrl.includes('service'))) {
            return 'services';
        }

        // Проверка на FAQ
        if (lowerUrl.includes('faq') || lowerUrl.includes('вопрос') || lowerTitle.includes('faq') || lowerTitle.includes('вопрос')) {
            return 'faq';
        }

        // Проверка на контакты
        if (lowerUrl.includes('contact') || lowerUrl.includes('контакт') || lowerTitle.includes('контакт')) {
            return 'contacts';
        }

        // Проверка на условия/политику
        if (lowerUrl.includes('terms') || lowerUrl.includes('policy') || lowerUrl.includes('условия') || lowerUrl.includes('политика')) {
            return 'terms';
        }

        return 'general';
    }

    /**
     * Очищает HTML от ненужных элементов и извлекает текст
     */
    extractCleanContent(html, url) {
        const $ = cheerio.load(html);
        
        // Удаляем ненужные элементы
        $('script, style, nav, header, footer, aside, .menu, .navigation, .sidebar, .ads, .advertisement').remove();
        
        // Извлекаем заголовок
        const title = $('title').text().trim() || 
                     $('h1').first().text().trim() || 
                     $('meta[property="og:title"]').attr('content') || 
                     '';

        // Извлекаем основной контент
        let content = '';
        
        // Пытаемся найти основной контент
        const mainSelectors = ['main', 'article', '.content', '.main-content', '#content', '#main'];
        let mainElement = null;
        
        for (const selector of mainSelectors) {
            const element = $(selector).first();
            if (element.length > 0) {
                mainElement = element;
                break;
            }
        }
        
        if (mainElement && mainElement.length > 0) {
            content = mainElement.text();
        } else {
            // Fallback: берем body без header/footer
            content = $('body').clone().find('header, footer, nav').remove().end().text();
        }

        // Очистка текста
        content = content
            .replace(/\s+/g, ' ') // Множественные пробелы
            .replace(/\n\s*\n/g, '\n') // Множественные переносы
            .trim()
            .substring(0, 50000); // Ограничение длины

        return { title, content };
    }

    /**
     * Нормализует URL
     */
    normalizeUrl(url, baseUrl) {
        try {
            const urlObj = new URL(url, baseUrl);
            // Убираем фрагменты и параметры сортировки
            urlObj.hash = '';
            return urlObj.href;
        } catch (e) {
            return null;
        }
    }

    /**
     * Проверяет, является ли URL валидным для индексации
     */
    isValidUrl(url, baseUrl) {
        try {
            const urlObj = new URL(url, baseUrl);
            // Только HTTP/HTTPS
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return false;
            }
            // Только тот же домен
            if (urlObj.hostname !== new URL(baseUrl).hostname) {
                return false;
            }
            // Исключаем файлы
            const pathname = urlObj.pathname.toLowerCase();
            const excludedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.zip', '.rar', '.doc', '.docx'];
            if (excludedExtensions.some(ext => pathname.endsWith(ext))) {
                return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Скачивает и парсит страницу
     */
    async fetchPage(url) {
        try {
            const response = await axios.get(url, {
                timeout: config.crawler.timeout,
                headers: {
                    'User-Agent': config.crawler.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
            });

            const { title, content } = this.extractCleanContent(response.data, url);
            const type = this.detectPageType(url, title, content);

            return { url, title, content, type, success: true };
        } catch (error) {
            console.error(`Error fetching ${url}:`, error.message);
            return { url, success: false, error: error.message };
        }
    }

    /**
     * Извлекает ссылки со страницы
     */
    extractLinks(html, baseUrl) {
        const $ = cheerio.load(html);
        const links = new Set();

        $('a[href]').each((_, element) => {
            const href = $(element).attr('href');
            if (!href) return;

            const normalized = this.normalizeUrl(href, baseUrl);
            if (normalized && this.isValidUrl(normalized, baseUrl)) {
                links.add(normalized);
            }
        });

        return Array.from(links);
    }

    /**
     * Сохраняет страницу в базу данных
     */
    savePage(url, title, content, type) {
        try {
            db.prepare(`
                INSERT OR REPLACE INTO site_pages (site_domain, url, title, content, type, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(this.siteDomain, url, title, content, type);
            return true;
        } catch (error) {
            console.error(`Error saving page ${url}:`, error.message);
            return false;
        }
    }

    /**
     * Обновляет статус индексации
     */
    updateIndexingStatus(status, pagesCount = null, errorMessage = null) {
        const stmt = db.prepare(`
            INSERT INTO site_indexing_status (site_domain, status, pages_count, last_indexed_at, started_at, error_message, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, COALESCE((SELECT started_at FROM site_indexing_status WHERE site_domain = ?), CURRENT_TIMESTAMP), ?, CURRENT_TIMESTAMP)
            ON CONFLICT(site_domain) DO UPDATE SET
                status = excluded.status,
                pages_count = COALESCE(excluded.pages_count, pages_count),
                last_indexed_at = excluded.last_indexed_at,
                error_message = excluded.error_message,
                updated_at = CURRENT_TIMESTAMP
        `);
        stmt.run(this.siteDomain, status, pagesCount, this.siteDomain, errorMessage);
    }

    /**
     * Основной метод индексации сайта
     */
    async index() {
        console.log(`🚀 Starting indexing for ${this.siteDomain}`);
        
        this.updateIndexingStatus('in_progress', 0);
        this.visitedUrls.clear();
        this.pagesToVisit = [{ url: this.baseUrl, depth: 0 }];
        this.pagesProcessed = 0;

        while (this.pagesToVisit.length > 0 && this.pagesProcessed < this.maxPages) {
            const { url, depth } = this.pagesToVisit.shift();

            if (this.visitedUrls.has(url) || depth > this.maxDepth) {
                continue;
            }

            this.visitedUrls.add(url);
            this.pagesProcessed++;

            console.log(`📄 [${this.pagesProcessed}/${this.maxPages}] Processing: ${url} (depth: ${depth})`);

            // Задержка между запросами
            if (this.pagesProcessed > 1) {
                await new Promise(resolve => setTimeout(resolve, config.crawler.delay));
            }

            const result = await this.fetchPage(url);

            if (result.success && result.content) {
                // Сохраняем страницу
                this.savePage(result.url, result.title, result.content, result.type);

                // Извлекаем ссылки для дальнейшего обхода
                if (depth < this.maxDepth) {
                    try {
                        const response = await axios.get(url, {
                            timeout: config.crawler.timeout,
                            headers: { 'User-Agent': config.crawler.userAgent },
                        });
                        const links = this.extractLinks(response.data, this.baseUrl);
                        
                        for (const link of links) {
                            if (!this.visitedUrls.has(link)) {
                                this.pagesToVisit.push({ url: link, depth: depth + 1 });
                            }
                        }
                    } catch (e) {
                        // Игнорируем ошибки при извлечении ссылок
                    }
                }
            }
        }

        const finalCount = db.prepare('SELECT COUNT(*) as count FROM site_pages WHERE site_domain = ?')
            .get(this.siteDomain).count;

        this.updateIndexingStatus('completed', finalCount);
        console.log(`✅ Indexing completed for ${this.siteDomain}: ${finalCount} pages`);

        return {
            success: true,
            pagesIndexed: finalCount,
            pagesProcessed: this.pagesProcessed,
        };
    }
}

