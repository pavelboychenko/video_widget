import express from 'express';
import multer from 'multer';
import { OpenAI } from 'openai';
import { config } from '../config.js';
import { ChatService } from '../services/ChatService.js';
import { createReadStream, unlinkSync, readFileSync } from 'fs';
import { tmpdir } from 'os';

const router = express.Router();
const openai = new OpenAI({ apiKey: config.openai.apiKey });

// Настройка multer для загрузки аудио файлов
const upload = multer({
    dest: tmpdir(),
    limits: {
        fileSize: 25 * 1024 * 1024, // 25MB (лимит OpenAI Whisper)
    },
    fileFilter: (req, file, cb) => {
        // Принимаем аудио файлы
        if (file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm') {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'), false);
        }
    },
});

/**
 * POST /voice/save
 * Сохранение и обработка голосовых сообщений с распознаванием речи
 */
router.post('/voice/save', upload.single('audio'), async (req, res) => {
    let audioFilePath = null;
    
    try {
        const { userId, duration, timestamp, siteDomain } = req.body;
        const audioFile = req.file;

        console.log('Received voice save request:', {
            userId,
            duration,
            siteDomain,
            hasFile: !!audioFile,
            fileInfo: audioFile ? {
                path: audioFile.path,
                size: audioFile.size,
                mimetype: audioFile.mimetype,
                originalname: audioFile.originalname
            } : null
        });

        if (!audioFile) {
            console.error('No audio file received');
            return res.status(400).json({
                success: false,
                error: 'Audio file is required',
            });
        }

        audioFilePath = audioFile.path;

        // Распознавание речи через OpenAI Whisper API
        console.log('Transcribing audio with Whisper...');
        console.log('Audio file path:', audioFilePath);
        console.log('Audio file size:', audioFile.size, 'bytes');
        console.log('Audio file mimetype:', audioFile.mimetype);
        
        // OpenAI Whisper API в Node.js
        // Читаем файл в Buffer
        const audioBuffer = readFileSync(audioFilePath);
        
        // OpenAI SDK принимает Buffer напрямую
        // Создаем File объект для правильной передачи
        const audioFileForOpenAI = new File(
            [audioBuffer],
            audioFile.originalname || 'recording.webm',
            { type: audioFile.mimetype || 'audio/webm' }
        );
        
        // Передаем File объект в OpenAI API
        const transcription = await openai.audio.transcriptions.create({
            file: audioFileForOpenAI,
            model: 'whisper-1',
            language: 'ru', // Русский язык
        });

        const transcribedText = transcription.text.trim();
        console.log('Transcribed text:', transcribedText);

        if (!transcribedText) {
            return res.json({
                success: true,
                messageId: `msg_${Date.now()}`,
                userId: userId || 'unknown',
                duration: parseInt(duration) || 0,
                timestamp: timestamp || new Date().toISOString(),
                transcribedText: '',
                message: 'Не удалось распознать речь. Попробуйте еще раз.',
            });
        }

        // Отправляем распознанный текст в ИИ через ChatService
        let aiResponse = null;
        try {
            const chatService = new ChatService();
            aiResponse = await chatService.getChatResponse(
                siteDomain || 'unknown',
                transcribedText,
                [] // История пустая, так как это новое сообщение
            );
        } catch (aiError) {
            console.error('AI response error:', aiError);
            // Продолжаем без ответа ИИ
        }

        // Удаляем временный файл
        try {
            unlinkSync(audioFilePath);
        } catch (e) {
            console.warn('Failed to delete temp file:', e);
        }

        res.json({
            success: true,
            messageId: `msg_${Date.now()}`,
            userId: userId || 'unknown',
            duration: parseInt(duration) || 0,
            timestamp: timestamp || new Date().toISOString(),
            transcribedText: transcribedText,
            aiResponse: aiResponse?.answer || null,
            meta: aiResponse?.meta || null,
        });
    } catch (error) {
        console.error('Voice save error:', error);
        
        // Удаляем временный файл в случае ошибки
        if (audioFilePath) {
            try {
                unlinkSync(audioFilePath);
            } catch (e) {
                // Игнорируем ошибки удаления
            }
        }

        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
});

/**
 * POST /text/save
 * Сохранение текстовых сообщений (legacy endpoint)
 */
router.post('/text/save', async (req, res) => {
    try {
        const { userId, text, timestamp } = req.body;

        // Здесь можно добавить логику сохранения текста
        // Пока просто возвращаем успешный ответ
        
        res.json({
            success: true,
            messageId: `msg_${Date.now()}`,
            userId: userId || 'unknown',
            text: text || '',
            timestamp: timestamp || new Date().toISOString(),
        });
    } catch (error) {
        console.error('Text save error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
});

export default router;

