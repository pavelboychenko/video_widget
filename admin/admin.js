/**
 * Админ-панель для менеджеров
 */

const API_BASE_URL = window.ADMIN_API_URL || '';
const WS_BASE_URL = window.ADMIN_WS_URL || '';

let currentManager = null;
let currentSessionId = null;
let chatSocket = null;
let callSocket = null;
let peerConnection = null;
let localStream = null;

// --- Настройки и генерация кода ---
const defaults = {
    widgetOrigin: 'https://your-domain.com',
    apiUrl: 'https://api.your-domain.com',
    wsUrl: 'wss://api.your-domain.com',
    videoUrl: 'https://your-domain.com/demo.mp4',
};

function getValue(id) {
    return (document.getElementById(id)?.value || '').trim();
}

function buildEmbedCode() {
    const widgetOrigin = getValue('cfg-widget-origin') || defaults.widgetOrigin;
    const apiUrl = getValue('cfg-api-url') || defaults.apiUrl;
    const wsUrl = getValue('cfg-ws-url') || defaults.wsUrl;
    const videoUrl = getValue('cfg-video-url') || '';

    return `<!-- Video Widget Embed -->
<div id="video-widget-root"></div>
<script>
(function () {
  const WIDGET_ORIGIN = '${widgetOrigin}';
  const API_URL = '${apiUrl}';
  const WS_URL = '${wsUrl}';
  const siteDomain = window.location.hostname.replace(/^www\\./, '');
  const userId = 'user_' + Math.random().toString(36).slice(2) + '_' + Date.now();

  // Статические файлы
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = WIDGET_ORIGIN + '/styles.css';
  document.head.appendChild(l);

  // Видео по желанию
  if ('${videoUrl}') {
    window.VIDEO_WIDGET_CUSTOM_VIDEO = '${videoUrl}';
  }

  // API и WS
  window.WIDGET_API_URL = API_URL;
  window.WIDGET_WS_URL = WS_URL;

  // Корневой контейнер
  const root = document.getElementById('video-widget-root') || document.body.appendChild(document.createElement('div'));
  root.id = 'video-widget-root';

  // Подгружаем JS
  const s = document.createElement('script');
  s.src = WIDGET_ORIGIN + '/script.js';
  s.defer = true;
  s.onload = function() {
    // Инициализируем индексацию сайта (фоново)
    fetch(API_URL + '/site/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteDomain })
    }).catch(() => {});
  };
  document.body.appendChild(s);
})();
</script>`;
}

function updateEmbedPreview() {
    const pre = document.getElementById('embed-code');
    if (pre) pre.textContent = buildEmbedCode();
}

function initEmbedSettings() {
    // Проставляем значения по умолчанию
    document.getElementById('cfg-widget-origin').value = defaults.widgetOrigin;
    document.getElementById('cfg-api-url').value = defaults.apiUrl;
    document.getElementById('cfg-ws-url').value = defaults.wsUrl;
    document.getElementById('cfg-video-url').value = defaults.videoUrl;

    ['cfg-widget-origin','cfg-api-url','cfg-ws-url','cfg-video-url'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateEmbedPreview);
        }
    });

    const genBtn = document.getElementById('generate-embed-btn');
    if (genBtn) genBtn.addEventListener('click', updateEmbedPreview);

    const copyBtn = document.getElementById('copy-embed-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            const code = buildEmbedCode();
            try {
                await navigator.clipboard.writeText(code);
                alert('Код скопирован в буфер обмена');
            } catch (e) {
                alert('Не удалось скопировать. Скопируйте вручную.');
            }
        });
    }

    updateEmbedPreview();
}

// Инициализация
$(document).ready(function() {
    // Проверяем сохраненную сессию
    const savedManager = localStorage.getItem('manager');
    if (savedManager) {
        try {
            currentManager = JSON.parse(savedManager);
            showMainScreen();
            connectWebSocket();
            initEmbedSettings();
        } catch (e) {
            localStorage.removeItem('manager');
        }
    }

    // Обработчик авторизации
    $('#login-form').on('submit', async function(e) {
        e.preventDefault();
        const email = $('#login-email').val();
        const password = $('#login-password').val();

        try {
            const response = await fetch(`${API_BASE_URL}/manager/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (data.success) {
                currentManager = data.manager;
                localStorage.setItem('manager', JSON.stringify(currentManager));
                $('#manager-name').text(currentManager.name || currentManager.email);
                showMainScreen();
                connectWebSocket();
                initEmbedSettings();
            } else {
                showError('#login-error', data.error || 'Ошибка авторизации');
            }
        } catch (error) {
            showError('#login-error', 'Ошибка подключения к серверу');
        }
    });

    // Выход
    $('#logout-btn').on('click', function() {
        localStorage.removeItem('manager');
        currentManager = null;
        disconnectWebSocket();
        showLoginScreen();
    });

    // Обновление очереди
    setInterval(updateQueue, 5000);
    updateQueue();

    // Инициализация генерации кода (если не авторизованы, тоже можно посмотреть)
    initEmbedSettings();
});

// Показ экранов
function showLoginScreen() {
    $('#login-screen').show();
    $('#main-screen').hide();
}

function showMainScreen() {
    $('#login-screen').hide();
    $('#main-screen').show();
}

function showError(selector, message) {
    $(selector).text(message).addClass('show');
    setTimeout(() => $(selector).removeClass('show'), 5000);
}

// WebSocket подключение
function connectWebSocket() {
    if (!currentManager) return;

    const wsUrl = getWebSocketUrl('/chat');
    chatSocket = io(wsUrl);

    chatSocket.on('connect', () => {
        console.log('WebSocket connected');
        chatSocket.emit('manager_connect', { managerId: currentManager.id });
        updateOnlineStatus(true);
    });

    chatSocket.on('new_session_available', (session) => {
        updateQueue();
    });

    chatSocket.on('queue_update', (sessions) => {
        renderQueue(sessions);
    });

    chatSocket.on('chat_message', (data) => {
        if (data.sessionId === currentSessionId) {
            addMessage(data.message, 'user');
        }
    });

    chatSocket.on('chat_history', (messages) => {
        $('#session-messages').empty();
        messages.forEach(msg => {
            const sender = msg.sender === 'user' ? 'user' : 'manager';
            addMessage(msg.message, sender, false);
        });
    });

    chatSocket.on('disconnect', () => {
        updateOnlineStatus(false);
    });
}

function disconnectWebSocket() {
    if (chatSocket) {
        chatSocket.disconnect();
        chatSocket = null;
    }
    if (callSocket) {
        callSocket.disconnect();
        callSocket = null;
    }
}

function updateOnlineStatus(online) {
    const badge = $('#status-badge');
    badge.removeClass('online offline');
    badge.addClass(online ? 'online' : 'offline');
    badge.text(online ? 'Онлайн' : 'Офлайн');
}

// Обновление очереди
async function updateQueue() {
    try {
        const response = await fetch(`${API_BASE_URL}/manager/queue`);
        const data = await response.json();

        if (data.success) {
            $('#waiting-count').text(data.waitingCount);
            $('#managers-count').text(data.onlineManagersCount);
            renderQueue(data.waitingSessions || []);
        }
    } catch (error) {
        console.error('Error updating queue:', error);
    }
}

function renderQueue(sessions) {
    const container = $('#queue-list');
    container.empty();

    if (sessions.length === 0) {
        container.html('<div class="empty-queue">Нет ожидающих запросов</div>');
        return;
    }

    sessions.forEach(session => {
        const item = $(`
            <div class="queue-item" data-session-id="${session.session_id}">
                <div class="queue-item-header">Пользователь: ${session.user_id}</div>
                <div class="queue-item-info">Сайт: ${session.site_domain}</div>
                <div class="queue-item-time">${formatTime(session.created_at)}</div>
            </div>
        `);

        item.on('click', function() {
            acceptSession(session.session_id);
        });

        container.append(item);
    });
}

// Принятие сессии
function acceptSession(sessionId) {
    if (!chatSocket || !chatSocket.connected) {
        alert('WebSocket не подключен');
        return;
    }

    chatSocket.emit('manager_accept', { sessionId });

    currentSessionId = sessionId;
    
    // Находим сессию в очереди
    const queueItems = $('.queue-item');
    let sessionData = null;
    queueItems.each(function() {
        if ($(this).data('session-id') === sessionId) {
            const header = $(this).find('.queue-item-header').text();
            const info = $(this).find('.queue-item-info').text();
            sessionData = {
                user_id: header.replace('Пользователь: ', ''),
                site_domain: info.replace('Сайт: ', ''),
            };
            return false;
        }
    });
    
    $('#session-user-id').text(sessionData?.user_id || 'Пользователь');
    $('#session-site').text(sessionData?.site_domain || '');
    
    $('#no-session').hide();
    $('#active-session').show();

    // Загружаем историю
    loadSessionHistory(sessionId);
}

// Загрузка истории
function loadSessionHistory(sessionId) {
    // История загружается автоматически через WebSocket событие chat_history
}

// Отправка сообщения
$('#session-send-btn').on('click', sendMessage);
$('#session-input').on('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function sendMessage() {
    const message = $('#session-input').val().trim();
    if (!message || !currentSessionId) return;

    if (chatSocket && chatSocket.connected) {
        chatSocket.emit('chat_message', {
            sessionId: currentSessionId,
            message: message,
        });

        addMessage(message, 'manager');
        $('#session-input').val('');
    }
}

function addMessage(text, sender, animate = true) {
    const messageEl = $(`
        <div class="message ${sender}">
            ${escapeHtml(text)}
        </div>
    `);

    if (animate) {
        messageEl.css({ opacity: 0, transform: 'translateY(10px)' });
    }

    $('#session-messages').append(messageEl);

    if (animate) {
        setTimeout(() => {
            messageEl.css({ opacity: 1, transform: 'translateY(0)' });
        }, 10);
    }

    // Прокрутка вниз
    const container = $('#session-messages');
    container.scrollTop(container[0].scrollHeight);
}

// Завершение сессии
$('#end-session-btn').on('click', function() {
    if (currentSessionId) {
        // Можно добавить API для закрытия сессии
        currentSessionId = null;
        $('#no-session').show();
        $('#active-session').hide();
        $('#session-messages').empty();
    }
});

// WebRTC для звонков
function connectToCall(sessionId) {
    const wsUrl = getWebSocketUrl('/call');
    callSocket = io(wsUrl);

    callSocket.on('connect', () => {
        callSocket.emit('join_session', { sessionId });
    });

    callSocket.on('call_offer', async (data) => {
        await handleOffer(data.offer);
    });

    callSocket.on('call_answer', async (data) => {
        await handleAnswer(data.answer);
    });

    callSocket.on('ice_candidate', async (data) => {
        await handleIceCandidate(data.candidate);
    });

    callSocket.on('call_end', () => {
        endCall();
    });
}

async function startCall(isVideo = false) {
    if (!currentSessionId) return;

    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: isVideo,
        });

        const localVideo = document.getElementById('local-video');
        if (localVideo) {
            localVideo.srcObject = localStream;
        }

        peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.onicecandidate = (event) => {
            if (event.candidate && callSocket) {
                callSocket.emit('ice_candidate', {
                    sessionId: currentSessionId,
                    candidate: event.candidate,
                });
            }
        };

        peerConnection.ontrack = (event) => {
            const remoteVideo = document.getElementById('remote-video');
            if (remoteVideo) {
                remoteVideo.srcObject = event.streams[0];
                $('.video-placeholder').hide();
            }
        };

        connectToCall(currentSessionId);

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        callSocket.emit('call_offer', {
            sessionId: currentSessionId,
            offer: offer,
        });

        $('#video-call-modal').fadeIn(300);
        $('#call-status').text('Звонок...');

    } catch (error) {
        console.error('Error starting call:', error);
        alert('Не удалось начать звонок');
    }
}

async function handleOffer(offer) {
    if (!peerConnection) {
        await startCall(true);
    }
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    callSocket.emit('call_answer', {
        sessionId: currentSessionId,
        answer: answer,
    });
}

async function handleAnswer(answer) {
    if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
}

async function handleIceCandidate(candidate) {
    if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
}

function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;
    $('#video-call-modal').fadeOut(300);
    if (callSocket && currentSessionId) {
        callSocket.emit('call_end', { sessionId: currentSessionId });
    }
}

$('#audio-call-btn').on('click', () => startCall(false));
$('#video-call-btn').on('click', () => startCall(true));
$('#call-close-btn, #call-end-btn').on('click', endCall);

$('.video-toggle-btn').on('click', function() {
    const type = $(this).data('type');
    if (localStream) {
        localStream.getTracks().forEach(track => {
            if (track.kind === type) {
                track.enabled = !track.enabled;
            }
        });
        $(this).toggleClass('disabled');
    }
});

// Утилиты
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Только что';
    if (minutes < 60) return `${minutes} мин назад`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч назад`;
    return date.toLocaleDateString('ru-RU');
}

function getWebSocketUrl(namespace) {
    if (WS_BASE_URL) {
        return WS_BASE_URL + namespace;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}${namespace}`;
}

// Инициализация при загрузке
let sessions = [];

