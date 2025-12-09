import { Server } from 'socket.io';
import { queueManager } from './QueueManager.js';
import { SessionManager } from './SessionManager.js';
import { ManagerService } from './ManagerService.js';

/**
 * WebSocket сервер для real-time коммуникаций
 */
export class WebSocketServer {
    constructor(httpServer) {
        this.io = new Server(httpServer, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST'],
            },
        });

        this.setupNamespaces();
    }

    setupNamespaces() {
        // Namespace для чата
        const chatNamespace = this.io.of('/chat');
        this.setupChatNamespace(chatNamespace);

        // Namespace для WebRTC signaling
        const callNamespace = this.io.of('/call');
        this.setupCallNamespace(callNamespace);
    }

    /**
     * Настройка namespace для текстового чата
     */
    setupChatNamespace(io) {
        io.on('connection', (socket) => {
            console.log('Chat client connected:', socket.id);

            // Пользователь подключается
            socket.on('user_connect', async (data) => {
                const { sessionId } = data;
                
                if (!sessionId) {
                    socket.emit('error', { message: 'sessionId required' });
                    return;
                }

                const session = SessionManager.getSession(sessionId);
                if (!session) {
                    socket.emit('error', { message: 'Session not found' });
                    return;
                }

                socket.sessionId = sessionId;
                socket.userId = session.user_id;
                socket.role = 'user';

                queueManager.registerUser(sessionId, socket);

                // Отправляем историю сообщений
                const messages = SessionManager.getSessionMessages(sessionId);
                socket.emit('chat_history', messages);

                // Если менеджер уже подключен
                if (session.status === 'active' && session.manager_id) {
                    const manager = ManagerService.getManager(session.manager_id);
                    socket.emit('manager_connected', {
                        sessionId,
                        managerId: session.manager_id,
                        managerName: manager?.name || 'Менеджер',
                    });
                }
            });

            // Менеджер подключается
            socket.on('manager_connect', async (data) => {
                const { managerId } = data;
                
                if (!managerId) {
                    socket.emit('error', { message: 'managerId required' });
                    return;
                }

                const manager = ManagerService.getManager(managerId);
                if (!manager) {
                    socket.emit('error', { message: 'Manager not found' });
                    return;
                }

                socket.managerId = managerId;
                socket.role = 'manager';

                ManagerService.setOnlineStatus(managerId, true);
                queueManager.registerManager(managerId, socket);

                socket.emit('connected', { managerId, name: manager.name });
            });

            // Менеджер принимает сессию
            socket.on('manager_accept', (data) => {
                const { sessionId } = data;
                const managerId = socket.managerId;

                if (!managerId) {
                    socket.emit('error', { message: 'Not authenticated as manager' });
                    return;
                }

                const result = queueManager.acceptSession(sessionId, managerId);
                
                if (result.success) {
                    socket.emit('session_accepted', { sessionId });
                    
                    // Подключаем менеджера к сессии
                    socket.join(`session:${sessionId}`);
                    
                    // Отправляем историю менеджеру
                    const messages = SessionManager.getSessionMessages(sessionId);
                    socket.emit('chat_history', messages);
                } else {
                    socket.emit('error', { message: result.error });
                }
            });

            // Отправка сообщения
            socket.on('chat_message', (data) => {
                const { message } = data;
                
                if (!socket.sessionId && !socket.managerId) {
                    socket.emit('error', { message: 'Not connected to session' });
                    return;
                }

                let sessionId, sender, senderId;

                if (socket.role === 'user') {
                    sessionId = socket.sessionId;
                    sender = 'user';
                    senderId = socket.userId;
                } else {
                    // Менеджер отправляет сообщение
                    // sessionId должен быть в data или в активной сессии
                    sessionId = data.sessionId;
                    if (!sessionId) {
                        // Находим активную сессию менеджера
                        const activeSessions = SessionManager.getManagerActiveSessions(socket.managerId);
                        if (activeSessions.length === 0) {
                            socket.emit('error', { message: 'No active session' });
                            return;
                        }
                        sessionId = activeSessions[0].session_id;
                    }
                    sender = 'manager';
                    senderId = socket.managerId;
                }

                const result = queueManager.sendMessage(sessionId, sender, senderId, message);
                
                if (result.success) {
                    // Сообщение уже отправлено через QueueManager
                    socket.emit('message_sent', { sessionId, message });
                } else {
                    socket.emit('error', { message: result.error });
                }
            });

            // Отключение
            socket.on('disconnect', () => {
                if (socket.role === 'manager' && socket.managerId) {
                    ManagerService.setOnlineStatus(socket.managerId, false);
                }
                console.log('Chat client disconnected:', socket.id);
            });
        });
    }

    /**
     * Настройка namespace для WebRTC signaling
     */
    setupCallNamespace(io) {
        io.on('connection', (socket) => {
            console.log('Call client connected:', socket.id);

            socket.on('join_session', (data) => {
                const { sessionId } = data;
                socket.sessionId = sessionId;
                socket.join(`call:${sessionId}`);
                socket.emit('joined_session', { sessionId });
            });

            // WebRTC Offer
            socket.on('call_offer', (data) => {
                const { sessionId, offer } = data;
                socket.to(`call:${sessionId}`).emit('call_offer', {
                    sessionId,
                    offer,
                    from: socket.id,
                });
            });

            // WebRTC Answer
            socket.on('call_answer', (data) => {
                const { sessionId, answer } = data;
                socket.to(`call:${sessionId}`).emit('call_answer', {
                    sessionId,
                    answer,
                    from: socket.id,
                });
            });

            // ICE Candidate
            socket.on('ice_candidate', (data) => {
                const { sessionId, candidate } = data;
                socket.to(`call:${sessionId}`).emit('ice_candidate', {
                    sessionId,
                    candidate,
                    from: socket.id,
                });
            });

            // Завершение звонка
            socket.on('call_end', (data) => {
                const { sessionId } = data;
                socket.to(`call:${sessionId}`).emit('call_end', {
                    sessionId,
                    from: socket.id,
                });
            });

            socket.on('disconnect', () => {
                console.log('Call client disconnected:', socket.id);
            });
        });
    }

    /**
     * Получить экземпляр Socket.IO
     */
    getIO() {
        return this.io;
    }
}

