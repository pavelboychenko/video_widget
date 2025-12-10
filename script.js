/**
 * Video Widget - Модульная система управления виджетом
 * Улучшенная версия с современной архитектурой
 */

// ===== Конфигурация =====
const CONFIG = {
    maxRecordingTime: 300, // 5 минут
    maxTextLength: 500,
    maxChatLength: 1000,
    typingDelay: 1000, // Задержка перед показом индикатора печати
    answerDelay: 1500, // Задержка перед ответом
    maxHistoryMessages: 10, // Максимальное количество сообщений в истории для API
    wsUrl: window.WIDGET_WS_URL || '', // WebSocket URL (если пусто - определяется автоматически)
};

// ===== Утилиты =====
const Utils = {
    generateUserId() {
        return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    },
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// ===== Управление состоянием виджета =====
const WidgetState = {
    currentState: 'default',
    userId: Utils.generateUserId(),
    siteDomain: null, // Будет определен при инициализации
    recordingTimer: null,
    recordingStartTime: null,
    audioStream: null,
    mediaRecorder: null,
    
    setState(newState) {
        this.currentState = newState;
        $('.video-widget').attr('data-state', newState);
    },
    
    getState() {
        return this.currentState;
    },
    
    // Определяет домен сайта, на котором установлен виджет
    detectSiteDomain() {
        try {
            // Пытаемся получить домен из window.location
            const hostname = window.location.hostname;
            const normalized = (hostname || '').replace(/^www\./, '');
            // Локальные/тестовые хосты мапим на демо-домен, чтобы был контекст
            const isLocal =
                normalized === 'localhost' ||
                normalized === '127.0.0.1' ||
                normalized === '0.0.0.0' ||
                /^\d+\.\d+\.\d+\.\d+$/.test(normalized);
            
            if (isLocal) {
                return window.WIDGET_SITE_DOMAIN || 'marketolo.ru';
            }
            return normalized || (window.WIDGET_SITE_DOMAIN || 'marketolo.ru');
        } catch (e) {
            console.warn('Could not detect site domain:', e);
            return window.WIDGET_SITE_DOMAIN || 'marketolo.ru';
        }
    },
    
    init() {
        this.siteDomain = this.detectSiteDomain();
        console.log('Site domain detected:', this.siteDomain);
    }
};

// Управление видео превью
let VideoControl = null;

// ===== Управление видимостью компонентов =====
const ViewManager = {
    show(element, className = 'active') {
        $(element).addClass(className).show();
    },
    
    hide(element, className = 'active') {
        $(element).removeClass(className).hide();
    },
    
    toggle(element, className = 'active') {
        $(element).toggleClass(className);
    },
    
    resetToMainMenu() {
        // Скрываем все внутренние экраны
        this.hide('.video-widget__faq-messages');
        this.hide('.video-widget__voice-recorder');
        this.hide('.video-widget__text-input');
        this.hide('.video-widget__chat-container');
        
        // Показываем/скрываем кнопки в зависимости от состояния
        if (WidgetState.getState() === 'opened') {
            $('.video-widget__buttons').show();
            $('.video-widget__preview').show();
            // Перезапускаем превью-видео, если было свернуто
            const video = document.getElementById("video-widget__video");
            if (video) {
                video.muted = false;
                video.play().catch(() => {});
            }
        } else {
            $('.video-widget__buttons').hide();
            $('.video-widget__preview').show();
        }
        if (VideoControl) VideoControl.play();
    },
    
    resetToDefault() {
        // Полный сброс в состояние по умолчанию
        this.hide('.video-widget__faq-messages');
        this.hide('.video-widget__voice-recorder');
        this.hide('.video-widget__text-input');
        this.hide('.video-widget__chat-container');
        $('.video-widget__buttons').hide();
        $('.video-widget__preview').show();
        if (VideoControl) VideoControl.play();
    }
};

// ===== Управление чатом =====
const ChatManager = {
    messages: [],
    apiBaseUrl: '', // Будет определен при инициализации
    isLiveMode: false, // Режим живого чата с менеджером
    sessionId: null, // ID сессии с менеджером
    
    init() {
        // Определяем базовый URL API
        // Если виджет на том же домене - используем относительный путь
        // Иначе можно настроить через переменную окружения или конфиг
        this.apiBaseUrl = window.WIDGET_API_URL || '';
        console.log('Chat API base URL:', this.apiBaseUrl || 'relative');
    },
    
    // Переключает в режим живого чата
    switchToLiveMode(sessionId, managerName) {
        this.isLiveMode = true;
        this.sessionId = sessionId;
        
        // Добавляем разделитель в чат
        const divider = $('<div class="chat-divider">')
            .html(`<span class="divider-text">⚡ Подключился личный менеджер: ${managerName}</span>`);
        $('#chat-messages').append(divider);
        
        // Обновляем заголовок чата
        $('.chat-title').text(managerName || 'Менеджер');
        $('.chat-status .status-text').text('Онлайн');
        
        // Показываем кнопки звонков
        $('.chat-call-buttons').show();
        
        // Подключаемся к WebSocket
        WebSocketManager.connectToChat(sessionId);
        
        // Скрываем ожидание
        $('.waiting-for-manager').fadeOut(300);
        
        this.scrollToBottom();
    },
    
    // Возвращает в режим ИИ
    switchToAIMode() {
        this.isLiveMode = false;
        this.sessionId = null;
        
        // Обновляем заголовок
        $('.chat-title').text('Ассистент по данным');
        
        // Скрываем кнопки звонков
        $('.chat-call-buttons').hide();
        
        // Отключаемся от WebSocket
        WebSocketManager.disconnect();
    },
    
    addMessage(text, sender, animate = true) {
        const message = {
            text: Utils.escapeHtml(text),
            sender: sender,
            timestamp: new Date()
        };
        
        this.messages.push(message);
        
        const messageElement = $('<div>')
            .addClass(`chat-message ${sender}`)
            .text(text);
        
        if (animate) {
            messageElement.css({ opacity: 0, transform: 'translateY(10px)' });
        }
        
        $('.chat-welcome').remove();
        $('#chat-messages').append(messageElement);
        
        if (animate) {
            setTimeout(() => {
                messageElement.css({ 
                    opacity: 1, 
                    transform: 'translateY(0)',
                    transition: 'all 0.3s ease-out'
                });
            }, 10);
        }
        
        this.scrollToBottom();
    },
    
    showTypingIndicator() {
        const indicator = $('.typing-indicator');
        // Переносим индикатор под последнее сообщение, чтобы не двигать инпут
        indicator.appendTo('#chat-messages').show();
        this.scrollToBottom();
    },
    
    hideTypingIndicator() {
        const indicator = $('.typing-indicator');
        indicator.hide().appendTo('.chat-input-area');
    },
    
    scrollToBottom() {
        const messagesContainer = $('#chat-messages');
        messagesContainer.animate({
            scrollTop: messagesContainer[0].scrollHeight
        }, 300);
    },
    
    clear() {
        this.messages = [];
        $('#chat-messages').html('');
    },
    
    // Получает историю сообщений в формате для API
    getHistoryForAPI() {
        return this.messages
            .filter(msg => msg.sender === 'user' || msg.sender === 'assistant')
            .slice(-CONFIG.maxHistoryMessages)
            .map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: msg.text
            }));
    },
    
    // Отправляет сообщение в API и получает ответ
    async sendMessage(messageText) {
        if (!messageText || messageText.trim().length === 0) {
            return;
        }

        // Если в режиме живого чата - отправляем через WebSocket
        if (this.isLiveMode && this.sessionId) {
            WebSocketManager.sendMessage(this.sessionId, messageText);
            this.addMessage(messageText, 'user');
            return;
        }

        // Иначе используем ИИ
        // Добавляем сообщение пользователя
        this.addMessage(messageText, 'user');
        
        // Показываем индикатор печати
        this.showTypingIndicator();
        
        try {
            // Формируем запрос
            const requestBody = {
                siteDomain: WidgetState.siteDomain,
                userId: WidgetState.userId,
                message: messageText.trim(),
                history: this.getHistoryForAPI(),
            };
            
            // Отправляем запрос
            const response = await fetch(`${this.apiBaseUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Unknown error');
            }
            
            // Скрываем индикатор печати
            this.hideTypingIndicator();
            
            // Добавляем ответ ассистента
            this.addMessage(data.answer, 'assistant');
            
            // Логируем метаданные (для отладки)
            if (data.meta) {
                console.log('Chat response meta:', data.meta);
            }

            // Best-effort пересылка вопроса в Telegram (не блокирует UX)
            // Пересылка в Telegram отключена, если нет конфигурации на бэкенде
            if (window.WIDGET_TELEGRAM_ENABLED) {
                const forwardPayload = {
                    siteDomain: WidgetState.siteDomain,
                    userId: WidgetState.userId,
                    message: messageText.trim(),
                };
                fetch(`${this.apiBaseUrl}/telegram/forward`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(forwardPayload),
                }).catch(err => console.warn('Telegram forward failed:', err?.message || err));
            }
            
        } catch (error) {
            console.error('Error sending message:', error);
            
            // Скрываем индикатор печати
            this.hideTypingIndicator();
            
            // Показываем сообщение об ошибке
            this.addMessage(
                'Извините, произошла ошибка при обработке вашего вопроса. Пожалуйста, попробуйте еще раз или обратитесь к нам через контакты на сайте.',
                'assistant'
            );
        }
    }
};

// ===== Управление записью голоса =====
const VoiceRecorder = {
    isRecording: false,
    timerInterval: null,
    
    async start() {
        try {
            ViewManager.hide('.video-widget__buttons');
            ViewManager.show('.video-widget__voice-recorder');
            // Паузим превью-видео во время записи
            if (VideoControl) VideoControl.pause();
            
            // Деактивируем кнопку отправки при старте
            $('.recorder-send-btn').prop('disabled', true);
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            
            WidgetState.audioStream = stream;
            const mediaRecorder = new MediaRecorder(stream);
            WidgetState.mediaRecorder = mediaRecorder;
            
            const audioChunks = [];
            
            mediaRecorder.addEventListener("dataavailable", (event) => {
                audioChunks.push(event.data);
            });
            
            mediaRecorder.addEventListener("stop", () => {
                this.handleRecordingStop(audioChunks);
            });
            
            mediaRecorder.start();
            this.isRecording = true;
            this.startTimer();
            this.startVisualization();
            
            // Активируем кнопку отправки после минимальной длительности
            setTimeout(() => {
                $('.recorder-send-btn').prop('disabled', false);
            }, 1000); // 1 секунда минимальная длительность
            
        } catch (error) {
            console.error('Ошибка доступа к микрофону:', error);
            
            // Детализируем сообщение для кейса "устройство не найдено"
            const isNotFound = error?.name === 'NotFoundError' || error?.name === 'NotFoundError ';
            const message = isNotFound
                ? 'Микрофон не найден. Подключите устройство или выберите доступный микрофон в настройках системы/браузера.'
                : 'Не удалось получить доступ к микрофону. Пожалуйста, разрешите доступ в настройках браузера.';
            
            this.showError(message);
            ViewManager.resetToMainMenu();
        }
    },
    
    stop() {
        if (WidgetState.mediaRecorder && this.isRecording) {
            WidgetState.mediaRecorder.stop();
            this.isRecording = false;
            this.stopTimer();
            this.stopVisualization();
            
            // Деактивируем кнопку отправки
            $('.recorder-send-btn').prop('disabled', true);
            
            if (WidgetState.audioStream) {
                WidgetState.audioStream.getTracks().forEach(track => track.stop());
                WidgetState.audioStream = null;
            }
        }
    },
    
    handleRecordingStop(audioChunks) {
        const duration = Math.floor((Date.now() - WidgetState.recordingStartTime) / 1000);
        
        if (duration < 1) {
            this.showError('Запись слишком короткая. Попробуйте еще раз.');
            ViewManager.resetToMainMenu();
            return;
        }
        
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        this.sendAudioToServer(audioBlob, duration);
    },
    
    async sendAudioToServer(audioBlob, duration) {
        try {
            ViewManager.show('.video-widget__chat-container');
            ChatManager.showTypingIndicator();
            
            const formData = new FormData();
            formData.append("audio", audioBlob, "recording.webm");
            formData.append("userId", WidgetState.userId);
            formData.append("siteDomain", WidgetState.siteDomain);
            formData.append("duration", duration);
            formData.append("timestamp", new Date().toISOString());
            
            const apiUrl = ChatManager.apiBaseUrl || '';
            const response = await fetch(`${apiUrl}/voice/save`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Ошибка сервера');
            }
            
            const data = await response.json();
            console.log('Голосовое сообщение обработано:', data);
            
            ChatManager.hideTypingIndicator();
            
            // Показываем распознанный текст как сообщение пользователя
            if (data.transcribedText) {
                ChatManager.addMessage(`🎤 ${data.transcribedText}`, 'user');
            } else {
                ChatManager.addMessage("🎤 Голосовое сообщение отправлено", 'user');
            }
            
            // Показываем ответ ИИ
            if (data.aiResponse) {
                ChatManager.addMessage(data.aiResponse, 'assistant');
            } else if (data.message) {
                ChatManager.addMessage(data.message, 'assistant');
            } else {
                // Если нет ответа, отправляем распознанный текст в чат
                if (data.transcribedText) {
                    ChatManager.sendMessage(data.transcribedText);
                }
            }
            
        } catch (error) {
            console.error('Ошибка при сохранении:', error);
            ChatManager.hideTypingIndicator();
            this.showError('Не удалось обработать голосовое сообщение. Попробуйте еще раз.');
            ViewManager.resetToMainMenu();
        }
    },
    
    startTimer() {
        WidgetState.recordingStartTime = Date.now();
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - WidgetState.recordingStartTime) / 1000);
            $('.recorder-timer').text(Utils.formatTime(elapsed));
            
            if (elapsed >= CONFIG.maxRecordingTime) {
                this.stop();
            }
        }, 100);
    },
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        $('.recorder-timer').text('00:00');
    },
    
    startVisualization() {
        $('.recorder-visualizer').addClass('recording');
    },
    
    stopVisualization() {
        $('.recorder-visualizer').removeClass('recording');
    },
    
    showError(message) {
        // Можно добавить красивое уведомление
        alert(message);
    }
};

// ===== Управление текстовым вводом =====
const TextInputManager = {
    show() {
        ViewManager.hide('.video-widget__buttons');
        ViewManager.show('.video-widget__text-input');
        $('.question-input').focus();
    },
    
    updateCharCounter() {
        const length = $('.question-input').val().length;
        $('.char-count').text(length);
        
        const sendBtn = $('.send-question-btn');
        if (length > 0 && length <= CONFIG.maxTextLength) {
            sendBtn.prop('disabled', false);
        } else {
            sendBtn.prop('disabled', true);
        }
        
        // Изменение цвета счетчика при приближении к лимиту
        const counter = $('.char-counter');
        if (length > CONFIG.maxTextLength * 0.9) {
            counter.css('color', 'var(--primary-color)');
        } else {
            counter.css('color', 'var(--text-light)');
        }
    },
    
    async send() {
        const question = $('.question-input').val().trim();
        
        if (!question || question.length === 0) {
            return;
        }
        
        if (question.length > CONFIG.maxTextLength) {
            alert(`Максимальная длина сообщения: ${CONFIG.maxTextLength} символов`);
            return;
        }
        
        try {
            const response = await fetch('/text/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: WidgetState.userId,
                    text: question,
                    timestamp: new Date().toISOString()
                })
            });
            
            if (!response.ok) {
                throw new Error('Ошибка сервера');
            }
            
            const data = await response.json();
            console.log('Текстовое сообщение сохранено:', data);
            
            $('.question-input').val('');
            this.updateCharCounter();
            
            ViewManager.show('.video-widget__chat-container');
            // Используем реальный API вместо имитации
            ChatManager.sendMessage(question);
            
        } catch (error) {
            console.error('Ошибка при сохранении:', error);
            alert('Не удалось отправить сообщение. Попробуйте еще раз.');
        }
    }
};

// ===== FAQ менеджер =====
const FAQManager = {
    answers: {
        "Как Big Data помогает увеличить продажи?": "Big Data позволяет анализировать поведение клиентов, выявлять паттерны и предсказывать потребности. Это помогает персонализировать предложения и увеличить конверсию до 35%. Наши клиенты отмечают рост продаж в среднем на 28% после внедрения наших решений.",
        "Какие данные вы собираете?": "Мы собираем данные о поведении пользователей, истории покупок, предпочтениях и демографии. Все данные обрабатываются с соблюдением требований законодательства о защите персональных данных. Мы используем только обезличенные данные для аналитики и не передаем их третьим лицам.",
        "Сколько стоит внедрение?": "Стоимость внедрения зависит от масштаба вашего бизнеса и требуемого функционала. Базовое решение начинается от 12.5 млн рублей. Мы предлагаем индивидуальный расчет после консультации. Также доступны гибкие варианты оплаты и пилотные проекты для оценки эффективности."
    },
    
    show() {
        ViewManager.hide('.video-widget__buttons');
        ViewManager.show('.video-widget__faq-messages');
        if (VideoControl) VideoControl.pause();
    },
    
    handleQuestionClick(question) {
        ViewManager.show('.video-widget__chat-container');
        // Используем реальный API вместо предустановленных ответов
        ChatManager.sendMessage(question);
    }
};

// ===== WebSocket Manager =====
const WebSocketManager = {
    chatSocket: null,
    callSocket: null,
    sessionId: null,
    
    // Подключается к чату
    connectToChat(sessionId) {
        if (this.chatSocket && this.chatSocket.connected) {
            return;
        }
        
        const wsUrl = this.getWebSocketUrl('/chat');
        this.chatSocket = io(wsUrl);
        this.sessionId = sessionId;
        
        this.chatSocket.on('connect', () => {
            console.log('WebSocket connected to chat');
            this.chatSocket.emit('user_connect', { sessionId });
        });
        
        this.chatSocket.on('manager_connected', (data) => {
            ManagerRequestService.handleManagerConnected(data.sessionId, data.managerName);
        });
        
        this.chatSocket.on('chat_message', (data) => {
            if (data.from === 'manager') {
                ChatManager.addMessage(data.message, 'assistant');
            }
        });
        
        this.chatSocket.on('chat_history', (messages) => {
            messages.forEach(msg => {
                const sender = msg.sender === 'user' ? 'user' : 'assistant';
                ChatManager.addMessage(msg.message, sender, false);
            });
        });
        
        this.chatSocket.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    },
    
    // Отправляет сообщение через WebSocket
    sendMessage(sessionId, message) {
        if (this.chatSocket && this.chatSocket.connected) {
            this.chatSocket.emit('chat_message', { message });
        }
    },
    
    // Подключается к signaling для звонков
    connectToCall(sessionId) {
        if (this.callSocket && this.callSocket.connected) {
            return;
        }
        
        const wsUrl = this.getWebSocketUrl('/call');
        this.callSocket = io(wsUrl);
        
        this.callSocket.on('connect', () => {
            console.log('WebSocket connected to call');
            this.callSocket.emit('join_session', { sessionId });
        });
        
        this.setupCallHandlers(sessionId);
    },
    
    // Настраивает обработчики для WebRTC
    setupCallHandlers(sessionId) {
        this.callSocket.on('call_offer', (data) => {
            WebRTCManager.handleOffer(data.offer);
        });
        
        this.callSocket.on('call_answer', (data) => {
            WebRTCManager.handleAnswer(data.answer);
        });
        
        this.callSocket.on('ice_candidate', (data) => {
            WebRTCManager.handleIceCandidate(data.candidate);
        });
        
        this.callSocket.on('call_end', () => {
            WebRTCManager.endCall();
        });
    },
    
    // Отключается от WebSocket
    disconnect() {
        if (this.chatSocket) {
            this.chatSocket.disconnect();
            this.chatSocket = null;
        }
        if (this.callSocket) {
            this.callSocket.disconnect();
            this.callSocket = null;
        }
    },
    
    // Получает URL для WebSocket
    getWebSocketUrl(namespace) {
        if (CONFIG.wsUrl) {
            return CONFIG.wsUrl + namespace;
        }
        
        // Определяем автоматически
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        return `${protocol}//${host}${namespace}`;
    }
};

// ===== WebRTC Manager =====
const WebRTCManager = {
    peerConnection: null,
    localStream: null,
    isVideoCall: false,
    sessionId: null,
    
    // Инициализирует звонок
    async startCall(sessionId, isVideo = false) {
        this.sessionId = sessionId;
        this.isVideoCall = isVideo;
        
        try {
            // Получаем медиа-поток
            const constraints = {
                audio: true,
                video: isVideo,
            };
            
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Показываем локальное видео
            const localVideo = document.getElementById('local-video');
            if (localVideo) {
                localVideo.srcObject = this.localStream;
            }
            
            // Создаем RTCPeerConnection
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                ],
            });
            
            // Добавляем локальный поток
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
            
            // Обработчики ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    WebSocketManager.callSocket.emit('ice_candidate', {
                        sessionId: this.sessionId,
                        candidate: event.candidate,
                    });
                }
            };
            
            // Обработчик удаленного потока
            this.peerConnection.ontrack = (event) => {
                const remoteVideo = document.getElementById('remote-video');
                if (remoteVideo) {
                    remoteVideo.srcObject = event.streams[0];
                    $('.video-placeholder').hide();
                }
            };
            
            // Подключаемся к signaling
            WebSocketManager.connectToCall(sessionId);
            
            // Создаем offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            WebSocketManager.callSocket.emit('call_offer', {
                sessionId: this.sessionId,
                offer: offer,
            });
            
            // Показываем модалку
            $('.video-call-modal').fadeIn(300);
            
        } catch (error) {
            console.error('Error starting call:', error);
            alert('Не удалось начать звонок. Проверьте разрешения на доступ к камере/микрофону.');
        }
    },
    
    // Обрабатывает offer (для менеджера)
    async handleOffer(offer) {
        if (!this.peerConnection) {
            await this.startCall(this.sessionId, this.isVideoCall);
        }
        
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        
        WebSocketManager.callSocket.emit('call_answer', {
            sessionId: this.sessionId,
            answer: answer,
        });
    },
    
    // Обрабатывает answer
    async handleAnswer(answer) {
        if (this.peerConnection) {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
    },
    
    // Обрабатывает ICE candidate
    async handleIceCandidate(candidate) {
        if (this.peerConnection) {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    },
    
    // Завершает звонок
    endCall() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        // Очищаем видео элементы
        const localVideo = document.getElementById('local-video');
        const remoteVideo = document.getElementById('remote-video');
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;
        
        // Скрываем модалку
        $('.video-call-modal').fadeOut(300);
        
        // Отправляем событие завершения
        if (WebSocketManager.callSocket && this.sessionId) {
            WebSocketManager.callSocket.emit('call_end', { sessionId: this.sessionId });
        }
        
        this.sessionId = null;
    },
    
    // Переключает камеру/микрофон
    toggleMedia(type) {
        if (!this.localStream) return;
        
        const tracks = this.localStream.getTracks();
        tracks.forEach(track => {
            if (track.kind === type) {
                track.enabled = !track.enabled;
            }
        });
    }
};

// ===== Manager Request Service =====
const ManagerRequestService = {
    connectionType: 'text', // text, audio, video
    
    // Запрашивает менеджера
    async requestManager(connectionType = 'text') {
        this.connectionType = connectionType;
        
        try {
            const response = await fetch(`${ChatManager.apiBaseUrl}/manager/request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    siteDomain: WidgetState.siteDomain,
                    userId: WidgetState.userId,
                }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to request manager');
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Показываем состояние ожидания
                $('.waiting-for-manager').fadeIn(300);
                ViewManager.show('.video-widget__chat-container');
                
                // Если менеджер уже подключен
                if (data.status === 'active') {
                    ChatManager.switchToLiveMode(data.sessionId, 'Менеджер');
                    $('.waiting-for-manager').fadeOut(300);
                    
                    // Если выбран звонок - сразу запускаем
                    if (connectionType === 'audio' || connectionType === 'video') {
                        setTimeout(() => {
                            WebRTCManager.startCall(data.sessionId, connectionType === 'video');
                        }, 500);
                    }
                } else {
                    // Подключаемся к WebSocket и ждем
                    setTimeout(() => {
                        WebSocketManager.connectToChat(data.sessionId);
                    }, 500);
                }
                
                return data;
            }
            
        } catch (error) {
            console.error('Error requesting manager:', error);
            alert('Не удалось связаться с менеджером. Попробуйте позже.');
        }
    },
    
    // Отменяет запрос
    cancelRequest() {
        $('.waiting-for-manager').fadeOut(300);
        WebSocketManager.disconnect();
    },
    
    // Обрабатывает подключение менеджера
    handleManagerConnected(sessionId, managerName) {
        ChatManager.switchToLiveMode(sessionId, managerName);
        
        // Если был выбран звонок - запускаем его
        if (this.connectionType === 'audio' || this.connectionType === 'video') {
            setTimeout(() => {
                WebRTCManager.startCall(sessionId, this.connectionType === 'video');
            }, 1000);
        }
    }
};

// ===== Инициализация =====
$(document).ready(function() {
    const widget = $(".video-widget");
    const video = document.getElementById("video-widget__video");
    const muteBtn = document.querySelector('.video-widget__mute');
    
    // Инициализация контроллера видео
    VideoControl = {
        video,
        muteBtn,
        setMuted(muted) {
            if (!this.video) return;
            this.video.muted = muted;
            if (this.muteBtn) {
                this.muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
                this.muteBtn.setAttribute('data-muted', muted ? 'true' : 'false');
            }
        },
        toggleMute() {
            this.setMuted(!this.video?.muted);
        },
        pause() {
            if (this.video && !this.video.paused) {
                this.video.pause();
            }
        },
        play() {
            if (this.video) {
                this.video.play().catch(() => {});
            }
        }
    };
    // Стартуем в беззвучном режиме (как было в разметке)
    VideoControl.setMuted(true);
    
    // Обработчик закрытия виджета
    $(".video-widget__close").on('click', function(e) {
        e.stopPropagation();
        if (WidgetState.getState() === "default") {
            widget.fadeOut(300);
        } else {
            WidgetState.setState("default");
            video.muted = true;
            video.currentTime = 0;
            VoiceRecorder.stop();
            ViewManager.resetToDefault();
            ChatManager.clear();
        }
    });
    
    // Обработчик открытия виджета
    $(".video-widget__container").on("click", function(e) {
        if ($(e.target).closest('.video-widget__buttons, .video-widget__voice-recorder, .video-widget__text-input, .video-widget__close, .faq-message, .video-widget__chat-container, .video-widget__faq-messages, .faq-back-btn, .recorder-back-btn, .text-input-back-btn').length === 0) {
            if (WidgetState.getState() === "default") {
                WidgetState.setState("opened");
                video.currentTime = 0;
                if (VideoControl) VideoControl.setMuted(false);
                // Показываем видео-превью и главное меню одновременно
                $('.video-widget__preview').show();
                $('.video-widget__buttons').fadeIn(200);
                // Стартуем проигрывание на всякий случай (некоторые браузеры паузят при скрытии)
                if (VideoControl) VideoControl.play();
            }
        }
    });
    
    // Переключатель звука
    if (muteBtn) {
        muteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            VideoControl.toggleMute();
        });
    }
    
    // Кнопки главного меню
    $('.video-widget__voice-btn').on('click', function(e) {
        e.stopPropagation();
        VoiceRecorder.start();
    });
    
    $('.video-widget__text-btn').on('click', function(e) {
        e.stopPropagation();
        FAQManager.show();
    });
    
    $('.video-widget__manager-btn').on('click', function(e) {
        e.stopPropagation();
        // Показываем модальное окно выбора типа связи
        $('.manager-connection-modal').fadeIn(300);
        if (VideoControl) VideoControl.pause();
    });
    
    // Закрытие модального окна
    $('.modal-close-btn, .modal-overlay').on('click', function(e) {
        if ($(e.target).hasClass('modal-overlay') || $(e.target).hasClass('modal-close-btn')) {
            $('.manager-connection-modal').fadeOut(300);
            if (VideoControl) VideoControl.play();
        }
    });
    
    // Выбор типа связи с менеджером
    $('.connection-option').on('click', function(e) {
        e.stopPropagation();
        const connectionType = $(this).data('type');
        $('.manager-connection-modal').fadeOut(300);
        
        // Запрашиваем менеджера
        ManagerRequestService.requestManager(connectionType);
    });
    
    // FAQ
    $('.faq-message').on('click', function(e) {
        e.stopPropagation();
        const question = $(this).data('question');
        FAQManager.handleQuestionClick(question);
    });
    
    $('.faq-back-btn').on('click', function(e) {
        e.stopPropagation();
        ViewManager.resetToMainMenu();
    });
    
    // Голосовой рекордер - отправка записи
    $('.recorder-send-btn').on('click', function(e) {
        e.stopPropagation();
        if (!$(this).prop('disabled')) {
            VoiceRecorder.stop();
        }
    });
    
    $('.recorder-back-btn').on('click', function(e) {
        e.stopPropagation();
        VoiceRecorder.stop();
        ViewManager.resetToMainMenu();
    });
    
    // Текстовый ввод
    $('.question-input').on('input', Utils.debounce(function() {
        TextInputManager.updateCharCounter();
    }, 100));
    
    $('.question-input').on('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            TextInputManager.send();
        }
    });
    
    $('.send-question-btn').on('click', function(e) {
        e.stopPropagation();
        TextInputManager.send();
    });
    
    $('.text-input-back-btn').on('click', function(e) {
        e.stopPropagation();
        ViewManager.resetToMainMenu();
    });
    
    // Чат - Drag/Swipe функциональность
    const chatContainer = $('.video-widget__chat-container');
    const chatDragHandle = $('.chat-drag-handle');
    
    let isDragging = false;
    let startY = 0;
    let currentY = 0;
    let startTranslateY = 0;
    let currentTranslateY = 0;
    const swipeThreshold = 50; // Минимальное расстояние для свайпа
    
    // Mouse события
    chatDragHandle.on('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        startY = e.clientY;
        startTranslateY = 0;
        chatContainer.addClass('dragging');
    });
    
    $(document).on('mousemove', function(e) {
        if (!isDragging) return;
        
        currentY = e.clientY;
        currentTranslateY = currentY - startY;
        
        // Ограничиваем движение только вниз
        if (currentTranslateY > 0) {
            chatContainer.css('transform', `translateY(${currentTranslateY}px)`);
            // Изменяем прозрачность при перетаскивании
            const opacity = Math.max(0.3, 1 - (currentTranslateY / 200));
            chatContainer.css('opacity', opacity);
        }
    });
    
    $(document).on('mouseup', function(e) {
        if (!isDragging) return;
        
        isDragging = false;
        chatContainer.removeClass('dragging');
        
        // Если свайпнули достаточно далеко, сворачиваем чат
        if (currentTranslateY > swipeThreshold) {
            chatContainer.addClass('collapsing');
            setTimeout(() => {
                ViewManager.hide('.video-widget__chat-container');
                ViewManager.resetToMainMenu();
                chatContainer.removeClass('collapsing');
                chatContainer.css({ transform: '', opacity: '' });
            }, 300);
        } else {
            // Возвращаем на место
            chatContainer.css({ transform: '', opacity: '' });
        }
    });
    
    // Touch события для мобильных устройств
    chatDragHandle.on('touchstart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        startY = e.touches[0].clientY;
        startTranslateY = 0;
        chatContainer.addClass('dragging');
    });
    
    $(document).on('touchmove', function(e) {
        if (!isDragging) return;
        
        currentY = e.touches[0].clientY;
        currentTranslateY = currentY - startY;
        
        if (currentTranslateY > 0) {
            chatContainer.css('transform', `translateY(${currentTranslateY}px)`);
            const opacity = Math.max(0.3, 1 - (currentTranslateY / 200));
            chatContainer.css('opacity', opacity);
        }
    });
    
    $(document).on('touchend', function(e) {
        if (!isDragging) return;
        
        isDragging = false;
        chatContainer.removeClass('dragging');
        
        if (currentTranslateY > swipeThreshold) {
            chatContainer.addClass('collapsing');
            setTimeout(() => {
                ViewManager.hide('.video-widget__chat-container');
                ViewManager.resetToMainMenu();
                chatContainer.removeClass('collapsing');
                chatContainer.css({ transform: '', opacity: '' });
            }, 300);
        } else {
            chatContainer.css({ transform: '', opacity: '' });
        }
    });
    
    // Предотвращаем скролл при перетаскивании
    chatDragHandle.on('touchmove', function(e) {
        if (isDragging) {
            e.preventDefault();
        }
    });
    
    $('.chat-input').on('input', function() {
        const value = $(this).val().trim();
        $('.chat-send-btn').prop('disabled', value.length === 0);
        
        // Автоматическое изменение высоты до 4 строк, далее скролл
        const styles = window.getComputedStyle(this);
        const lineHeight = parseFloat(styles.lineHeight) || 20;
        const paddingTop = parseFloat(styles.paddingTop) || 0;
        const paddingBottom = parseFloat(styles.paddingBottom) || 0;
        const maxHeight = lineHeight * 4 + paddingTop + paddingBottom;

        this.style.height = 'auto';
        const newHeight = Math.min(this.scrollHeight, maxHeight);
        this.style.height = newHeight + 'px';
        this.style.overflowY = this.scrollHeight > maxHeight ? 'auto' : 'hidden';
    });
    
    $('.chat-input').on('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if ($(this).val().trim().length > 0) {
                ChatManager.sendMessage();
            }
        }
    });
    
    $('.chat-send-btn').on('click', function(e) {
        e.stopPropagation();
        const message = $('.chat-input').val().trim();
        if (message.length === 0 || message.length > CONFIG.maxChatLength) {
            return;
        }
        
        $('.chat-input').val('').css({ height: 'auto', overflowY: 'hidden' });
        $('.chat-send-btn').prop('disabled', true);
        ChatManager.sendMessage(message);
    });
    
    // Кнопка отмены ожидания менеджера
    $('.waiting-cancel-btn').on('click', function(e) {
        e.stopPropagation();
        ManagerRequestService.cancelRequest();
    });
    
    // Кнопки звонков (появляются когда менеджер подключен)
    $('.audio-call-btn').on('click', function(e) {
        e.stopPropagation();
        if (ChatManager.sessionId) {
            WebRTCManager.startCall(ChatManager.sessionId, false);
        }
    });
    
    $('.video-call-btn').on('click', function(e) {
        e.stopPropagation();
        if (ChatManager.sessionId) {
            WebRTCManager.startCall(ChatManager.sessionId, true);
        }
    });
    
    // Кнопки управления видеозвонком
    $('.call-close-btn, .call-end-btn').on('click', function(e) {
        e.stopPropagation();
        WebRTCManager.endCall();
    });
    
    $('.video-toggle-btn').on('click', function(e) {
        e.stopPropagation();
        const type = $(this).data('type');
        WebRTCManager.toggleMedia(type);
        $(this).toggleClass('disabled');
    });
    
    // Инициализация виджета
    WidgetState.init();
    ChatManager.init();
    
    // Инициализация счетчика символов
    TextInputManager.updateCharCounter();
    
    console.log('Video Widget инициализирован.');
    console.log('User ID:', WidgetState.userId);
    console.log('Site Domain:', WidgetState.siteDomain);
});
