# API Документация - Video Widget

## Обзор

Виджет отправляет данные на backend через два основных endpoint'а. Эта документация описывает формат запросов и ответов.

## Endpoints

### 1. Сохранение голосового сообщения

**URL:** `POST /voice/save`

**Content-Type:** `multipart/form-data`

**Параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `audio` | Blob | Аудио файл в формате WebM |
| `userId` | string | Уникальный идентификатор пользователя |
| `duration` | number | Длительность записи в секундах |
| `timestamp` | string | Время создания в формате ISO 8601 |

**Пример запроса:**

```javascript
const formData = new FormData();
formData.append("audio", audioBlob, "recording.webm");
formData.append("userId", "user_abc123xyz_1234567890");
formData.append("duration", 45);
formData.append("timestamp", "2024-01-15T10:30:00.000Z");

fetch('/voice/save', {
    method: 'POST',
    body: formData
});
```

**Успешный ответ (200 OK):**

```json
{
    "success": true,
    "messageId": "msg_1234567890",
    "userId": "user_abc123xyz_1234567890",
    "duration": 45,
    "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Ошибка (400/500):**

```json
{
    "success": false,
    "error": "Описание ошибки"
}
```

---

### 2. Сохранение текстового сообщения

**URL:** `POST /text/save`

**Content-Type:** `application/json`

**Тело запроса:**

```json
{
    "userId": "string",
    "text": "string",
    "timestamp": "string (ISO 8601)"
}
```

**Пример запроса:**

```javascript
fetch('/text/save', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        userId: "user_abc123xyz_1234567890",
        text: "Сколько стоит внедрение?",
        timestamp: "2024-01-15T10:30:00.000Z"
    })
});
```

**Успешный ответ (200 OK):**

```json
{
    "success": true,
    "messageId": "msg_1234567890",
    "userId": "user_abc123xyz_1234567890",
    "text": "Сколько стоит внедрение?",
    "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Ошибка (400/500):**

```json
{
    "success": false,
    "error": "Описание ошибки"
}
```

---

## User ID

Каждый пользователь получает уникальный идентификатор при первой загрузке виджета:

**Формат:** `user_{random_string}_{timestamp}`

**Пример:** `user_abc123xyz_1705312200000`

User ID генерируется на клиенте и сохраняется на время сессии. Для постоянного хранения можно использовать localStorage или cookies.

---

## Примеры реализации на сервере

### Node.js (Express)

```javascript
const express = require('express');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

app.post('/voice/save', upload.single('audio'), (req, res) => {
    const { userId, duration, timestamp } = req.body;
    const audioFile = req.file;
    
    // Сохранение в базу данных
    // ...
    
    res.json({
        success: true,
        messageId: generateMessageId(),
        userId,
        duration: parseInt(duration),
        timestamp
    });
});

app.post('/text/save', express.json(), (req, res) => {
    const { userId, text, timestamp } = req.body;
    
    // Сохранение в базу данных
    // ...
    
    res.json({
        success: true,
        messageId: generateMessageId(),
        userId,
        text,
        timestamp
    });
});
```

### Python (Flask)

```python
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import os

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads/'

@app.route('/voice/save', methods=['POST'])
def save_voice():
    if 'audio' not in request.files:
        return jsonify({'success': False, 'error': 'No audio file'}), 400
    
    audio_file = request.files['audio']
    user_id = request.form.get('userId')
    duration = request.form.get('duration')
    timestamp = request.form.get('timestamp')
    
    # Сохранение файла
    filename = secure_filename(audio_file.filename)
    audio_file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
    
    # Сохранение в базу данных
    # ...
    
    return jsonify({
        'success': True,
        'messageId': generate_message_id(),
        'userId': user_id,
        'duration': int(duration),
        'timestamp': timestamp
    })

@app.route('/text/save', methods=['POST'])
def save_text():
    data = request.get_json()
    user_id = data.get('userId')
    text = data.get('text')
    timestamp = data.get('timestamp')
    
    # Сохранение в базу данных
    # ...
    
    return jsonify({
        'success': True,
        'messageId': generate_message_id(),
        'userId': user_id,
        'text': text,
        'timestamp': timestamp
    })
```

---

## Обработка ошибок

Виджет обрабатывает следующие типы ошибок:

1. **Сетевые ошибки** - отсутствие соединения с сервером
2. **Ошибки сервера** - статус коды 4xx, 5xx
3. **Ошибки доступа к микрофону** - пользователь не разрешил доступ
4. **Ошибки валидации** - некорректные данные

Все ошибки логируются в консоль браузера для отладки.

---

## CORS настройки

Если виджет размещен на другом домене, необходимо настроить CORS на сервере:

```javascript
// Express.js
app.use(cors({
    origin: 'https://yourdomain.com',
    methods: ['POST'],
    allowedHeaders: ['Content-Type']
}));
```

```python
# Flask
from flask_cors import CORS

CORS(app, resources={
    r"/voice/save": {"origins": "https://yourdomain.com"},
    r"/text/save": {"origins": "https://yourdomain.com"}
})
```

---

## Рекомендации по безопасности

1. **Валидация данных** - проверяйте все входящие данные на сервере
2. **Ограничение размера файлов** - установите максимальный размер аудио файла
3. **Rate limiting** - ограничьте количество запросов от одного пользователя
4. **HTTPS** - используйте только HTTPS для передачи данных
5. **Аутентификация** - при необходимости добавьте проверку токенов

---

## Тестирование

Для тестирования можно использовать curl:

```bash
# Тестовый запрос для текстового сообщения
curl -X POST http://localhost:3000/text/save \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "text": "Тестовое сообщение",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }'
```

---

## Версионирование

Текущая версия API: **v1.0**

При изменении API рекомендуется использовать версионирование:

- `/api/v1/voice/save`
- `/api/v1/text/save`

