/**
 * AI Widget - Единый файл для встраивания
 * Использование: <script src="https://ai-studia.ru/widget.js?site=yourdomain.com"></script>
 */
(function() {
    'use strict';
    
    // Параметры из URL
    const script = document.currentScript || document.querySelector('script[src*="widget.js"]');
    const params = new URLSearchParams(script?.src?.split('?')[1] || '');
    const siteDomain = params.get('site') || window.location.hostname.replace(/^www\./, '') || 'marketolo.ru';
    const apiUrl = params.get('api') || 'https://ai-studia.ru';
    const wsUrl = params.get('ws') || 'https://ai-studia.ru';
    
    // Проверка, что виджет еще не загружен
    if (window.AIWidgetLoaded) {
        console.warn('AI Widget уже загружен');
        return;
    }
    window.AIWidgetLoaded = true;
    
    // Конфигурация
    window.WIDGET_API_URL = apiUrl;
    window.WIDGET_WS_URL = wsUrl;
    window.WIDGET_SITE_DOMAIN = siteDomain;
    
    // Загрузка зависимостей
    function loadScript(src, callback) {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = callback;
        document.head.appendChild(script);
    }
    
    function loadCSS(href) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onerror = function() {
            console.warn('Failed to load widget CSS:', href);
        };
        document.head.appendChild(link);
    }
    
    // Загружаем CSS
    loadCSS('https://ai-studia.ru/widget.css');
    
    // Загружаем зависимости
    let depsLoaded = 0;
    const deps = [
        'https://code.jquery.com/jquery-3.6.0.min.js',
        'https://cdn.socket.io/4.6.1/socket.io.min.js'
    ];
    
    function checkDeps() {
        depsLoaded++;
        if (depsLoaded === deps.length) {
            // Ждем готовности DOM перед инициализацией
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initWidget);
            } else {
                // DOM уже готов, но даем небольшую задержку для гарантии
                setTimeout(initWidget, 10);
            }
        }
    }
    
    deps.forEach(src => {
        if (src.includes('jquery') && window.jQuery) {
            checkDeps();
        } else if (src.includes('socket.io') && window.io) {
            checkDeps();
        } else {
            loadScript(src, checkDeps);
        }
    });
    
    // Инициализация виджета
    function initWidget() {
        // Проверяем, что виджет еще не вставлен
        if (document.querySelector('.video-widget')) {
            return;
        }
        
        // Вставляем HTML виджета
        const widgetHTML = `
<div class="video-widget" data-state="default">
    <div class="video-widget__container">
        <div class="video-widget__preview">
            <video id="video-widget__video" loop autoplay playsinline preload="auto" muted controlslist="nodownload" disablepictureinpicture class="video-widget__video">
                <source src="https://ai-studia.ru/avatar.mp4" type="video/mp4">
            </video>
            <div class="video-widget__overlay"></div>
        </div>
        <button class="video-widget__close" aria-label="Закрыть виджет"></button>
        <button class="video-widget__mute" aria-label="Включить/выключить звук" aria-pressed="true">
            <svg class="video-widget__mute-icon" viewBox="0 0 100 100" aria-hidden="true">
                <g class="video-widget__mute-bars" fill="currentColor">
                    <rect x="8"  y="40" width="6"  height="20" rx="3" />
                    <rect x="24" y="30" width="8"  height="40" rx="4" />
                    <rect x="42" y="16" width="10" height="68" rx="5" />
                    <rect x="60" y="30" width="8"  height="40" rx="4" />
                    <rect x="78" y="40" width="6"  height="20" rx="3" />
                </g>
            </svg>
        </button>
        <div class="video-widget__buttons">
            <button class="video-widget__btn video-widget__voice-btn" type="button" title="Голосовое сообщение">
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                <span class="btn-text">Голос</span>
            </button>
            <button class="video-widget__btn video-widget__text-btn" type="button" title="Текстовое сообщение">
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span class="btn-text">Текст</span>
            </button>
            <button class="video-widget__btn video-widget__manager-btn" type="button" title="Прямая связь с менеджером">
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
                <span class="btn-text">Менеджер</span>
            </button>
        </div>
        <div class="manager-connection-modal" style="display: none;">
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <button class="modal-close-btn" type="button" aria-label="Закрыть">×</button>
                <div class="modal-title">Выберите способ связи</div>
                <div class="connection-options">
                    <button class="connection-option" data-type="text" type="button">
                        <div class="option-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                        </div>
                        <div class="option-info">
                            <div class="option-title">Текстом</div>
                            <div class="option-desc">Чат с менеджером</div>
                        </div>
                    </button>
                    <button class="connection-option" data-type="audio" type="button">
                        <div class="option-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                <line x1="12" y1="19" x2="12" y2="23"/>
                                <line x1="8" y1="23" x2="16" y2="23"/>
                            </svg>
                        </div>
                        <div class="option-info">
                            <div class="option-title">Голосом</div>
                            <div class="option-desc">Аудиозвонок</div>
                        </div>
                    </button>
                    <button class="connection-option" data-type="video" type="button">
                        <div class="option-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="23 7 16 12 23 17 23 7"/>
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                            </svg>
                        </div>
                        <div class="option-info">
                            <div class="option-title">Видео</div>
                            <div class="option-desc">Видеозвонок</div>
                        </div>
                    </button>
                    <a class="connection-option" href="https://t.me/Papa_Marketinga" target="_blank" rel="noopener noreferrer">
                        <div class="option-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 2L11 13"/>
                                <path d="M22 2l-7 20-4-9-9-4 20-7z"/>
                            </svg>
                        </div>
                        <div class="option-info">
                            <div class="option-title">Telegram</div>
                            <div class="option-desc">@Papa_Marketinga</div>
                        </div>
                    </a>
                    <a class="connection-option" href="https://wa.me/79645848080" target="_blank" rel="noopener noreferrer">
                        <div class="option-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 11.5a8.38 8.38 0 0 1-1.2 4.4 8.5 8.5 0 0 1-7.3 4.1 8.38 8.38 0 0 1-4.4-1.2L3 21l2.2-5.1a8.38 8.38 0 0 1-1.2-4.4 8.5 8.5 0 0 1 4.1-7.3 8.38 8.38 0 0 1 4.4-1.2h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                                <path d="M8.5 9.5c.2 1.1.7 2 1.5 2.8.8.8 1.8 1.3 2.8 1.5l1.1-1.1c.2-.2.5-.2.7 0l1.2 1.2"/>
                            </svg>
                        </div>
                        <div class="option-info">
                            <div class="option-title">WhatsApp</div>
                            <div class="option-desc">+7 964 584 8080</div>
                        </div>
                    </a>
                </div>
            </div>
        </div>
        <div class="video-widget__faq-messages">
            <div class="faq-header">
                <button class="faq-back-btn" aria-label="Назад">←</button>
                <div class="faq-title">Популярные вопросы</div>
            </div>
            <div class="faq-list">
                <div class="faq-message" data-question="Хотите, чтобы к вам приходили только платёжеспособные клиенты?">
                    <span class="faq-icon">🚀</span>
                    <span class="faq-text">Хотите, чтобы к вам приходили только платёжеспособные клиенты?</span>
                </div>
                <div class="faq-message" data-question="Показать, какие касания работают лучше всего в премиальном сегменте?">
                    <span class="faq-icon">🎯</span>
                    <span class="faq-text">Показать, какие касания работают лучше всего в премиальном сегменте?</span>
                </div>
                <div class="faq-message" data-question="Пройтись по тарифам и подобрать оптимальный вариант под ваш продукт?">
                    <span class="faq-icon">💼</span>
                    <span class="faq-text">Пройтись по тарифам и подобрать оптимальный вариант под ваш продукт?</span>
                </div>
            </div>
        </div>
        <div class="video-widget__voice-recorder">
            <div class="recorder-header">
                <button class="recorder-back-btn" aria-label="Назад">←</button>
                <div class="recorder-title">Запись голоса</div>
            </div>
            <div class="recorder-content">
                <div class="recorder-visualizer">
                    <div class="visualizer-bar"></div>
                    <div class="visualizer-bar"></div>
                    <div class="visualizer-bar"></div>
                    <div class="visualizer-bar"></div>
                    <div class="visualizer-bar"></div>
                    <div class="visualizer-bar"></div>
                    <div class="visualizer-bar"></div>
                    <div class="visualizer-bar"></div>
                </div>
                <div class="recorder-status">
                    <div class="recorder-timer">00:00</div>
                    <div class="recorder-hint">Говорите, я слушаю...</div>
                </div>
                <button class="recorder-send-btn" type="button" aria-label="Отправить голосовое сообщение" disabled>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                    </svg>
                    <span class="send-btn-label">Отправить</span>
                </button>
            </div>
        </div>
        <div class="video-widget__text-input">
            <div class="text-input-header">
                <button class="text-input-back-btn" aria-label="Назад">←</button>
                <div class="text-input-title">Ваш вопрос</div>
            </div>
            <div class="text-input-content">
                <textarea class="question-input" placeholder="Опишите ваш вопрос подробнее..." rows="4" maxlength="500"></textarea>
                <div class="text-input-footer">
                    <span class="char-counter"><span class="char-count">0</span>/500</span>
                    <button class="send-question-btn" type="button" disabled>
                        <span>Отправить</span>
                        <span class="send-icon">→</span>
                    </button>
                </div>
            </div>
        </div>
        <div class="video-widget__chat-container">
            <div class="chat-drag-handle" title="Потяните вниз, чтобы свернуть"></div>
            <div class="chat-header">
                <div class="chat-avatar">
                    <img src="https://ai-studia.ru/orig.webp" alt="Ассистент" class="avatar-img">
                    <div class="avatar-pulse"></div>
                </div>
                <div class="chat-info">
                    <div class="chat-title">Ассистент</div>
                    <div class="chat-status">
                        <span class="status-dot"></span>
                        <span class="status-text">Онлайн</span>
                    </div>
                </div>
                <div class="chat-quick-links">
                    <a class="chat-link" href="https://t.me/Papa_Marketinga" target="_blank" rel="noopener noreferrer" aria-label="Написать в Telegram">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 2L11 13"/>
                            <path d="M22 2l-7 20-4-9-9-4 20-7z"/>
                        </svg>
                    </a>
                    <a class="chat-link" href="https://wa.me/79645848080" target="_blank" rel="noopener noreferrer" aria-label="Написать в WhatsApp">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 11.5a8.38 8.38 0 0 1-1.2 4.4 8.5 8.5 0 0 1-7.3 4.1 8.38 8.38 0 0 1-4.4-1.2L3 21l2.2-5.1a8.38 8.38 0 0 1-1.2-4.4 8.5 8.5 0 0 1 4.1-7.3 8.38 8.38 0 0 1 4.4-1.2h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                            <path d="M8.5 9.5c.2 1.1.7 2 1.5 2.8.8.8 1.8 1.3 2.8 1.5l1.1-1.1c.2-.2.5-.2.7 0l1.2 1.2"/>
                        </svg>
                    </a>
                </div>
            </div>
            <div class="chat-messages" id="chat-messages">
                <div class="chat-welcome">
                    <div class="welcome-icon">👋</div>
                    <div class="welcome-text">Привет! Я готов ответить на ваши вопросы</div>
                </div>
            </div>
            <div class="chat-input-area">
                <div class="typing-indicator" style="display: none;">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <textarea class="chat-input" placeholder="Напишите сообщение..." rows="1" maxlength="1000"></textarea>
                <button class="chat-send-btn" type="button" aria-label="Отправить сообщение" disabled>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                    </svg>
                </button>
            </div>
        </div>
    </div>
</div>`;
        
        // Убеждаемся, что body существует
        if (!document.body) {
            console.error('AI Widget: document.body не найден');
            return;
        }
        
        // Вставляем виджет в body и убеждаемся, что он фиксирован
        document.body.insertAdjacentHTML('beforeend', widgetHTML);
        
        // Принудительно применяем стили для фиксации виджета
        const widget = document.querySelector('.video-widget');
        if (widget) {
            widget.style.position = 'fixed';
            widget.style.left = '20px';
            widget.style.bottom = '6%';
            widget.style.zIndex = '999999';
            widget.style.pointerEvents = 'auto';
            console.log('✅ Widget positioned and fixed on screen');
        }
        
        // Загружаем основной скрипт виджета только один раз
        if (window.AIWidgetScriptLoaded) {
            console.warn('AI Widget: script.js уже загружен');
            return;
        }
        window.AIWidgetScriptLoaded = true;
        
        loadScript('https://ai-studia.ru/script.js', function() {
            console.log('AI Widget загружен и инициализирован');
        });
    }
    
    // Начинаем загрузку зависимостей сразу
    // Они загрузятся асинхронно и инициализируют виджет когда будут готовы
})();

