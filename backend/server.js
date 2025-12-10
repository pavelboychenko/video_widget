import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import './database/db.js'; // Initialize database
import chatRoutes from './routes/chat.js';
import legacyRoutes from './routes/legacy.js';
import managerRoutes from './routes/manager.js';
import { WebSocketServer } from './services/WebSocketServer.js';
import telegramRoutes from './routes/telegram.js';

const app = express();
const httpServer = createServer(app);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Middleware
app.use(cors({
    origin: [
        'https://marketolo.ru',
        'https://www.marketolo.ru',
        'https://ai-studia.ru',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3002',
    ],
    credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Статика для демо-видео и фронтенда (корень проекта)
app.use(express.static(join(__dirname, '..')));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/', chatRoutes);
app.use('/', legacyRoutes);
app.use('/', managerRoutes);
app.use('/', telegramRoutes);

// Initialize WebSocket server
const wsServer = new WebSocketServer(httpServer);

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found',
    });
});

// Start server
const PORT = config.server.port;
httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Environment: ${config.server.nodeEnv}`);
    console.log(`🤖 OpenAI Model: ${config.openai.model}`);
    console.log(`🔌 WebSocket server initialized`);
    console.log(`   - Chat namespace: /chat`);
    console.log(`   - Call namespace: /call`);
    
    if (!config.openai.apiKey) {
        console.warn('⚠️  WARNING: OpenAI API key is not set!');
    }
});

