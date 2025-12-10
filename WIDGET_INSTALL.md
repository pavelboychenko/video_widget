# Инструкция по установке AI Widget

## Простая установка (одна строка)

Вставьте этот код перед закрывающим тегом `</body>` на вашем сайте:

```html
<script src="https://ai-studia.ru/widget.js?site=yourdomain.com" async></script>
```

Замените `yourdomain.com` на домен вашего сайта (например, `marketolo.ru`).

## Параметры

### Обязательные параметры:
- `site` - домен вашего сайта (для контекста ИИ)

### Опциональные параметры:
- `api` - URL бэкенда (по умолчанию: `https://ai.studia.ru`)
- `ws` - URL WebSocket сервера (по умолчанию: `https://ai.studia.ru`)

## Примеры использования

### Базовый вариант:
```html
<script src="https://ai-studia.ru/widget.js?site=marketolo.ru" async></script>
```

### С кастомным API:
```html
<script src="https://ai-studia.ru/widget.js?site=marketolo.ru&api=https://api.example.com" async></script>
```

### Полный пример HTML страницы:
```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Мой сайт</title>
</head>
<body>
    <h1>Добро пожаловать!</h1>
    <!-- Ваш контент -->
    
    <!-- AI Widget -->
    <script src="https://ai-studia.ru/widget.js?site=yourdomain.com" async></script>
</body>
</html>
```

## Что нужно разместить на сервере ai.studia.ru

Убедитесь, что следующие файлы доступны по указанным путям:

1. **widget.js** → `https://ai-studia.ru/widget.js`
2. **widget.css** → `https://ai-studia.ru/widget.css` (скопируйте styles.css)
3. **script.js** → `https://ai-studia.ru/script.js`
4. **avatar.mp4** → `https://ai-studia.ru/avatar.mp4`
5. **orig.webp** → `https://ai-studia.ru/orig.webp`

## Настройка бэкенда

Бэкенд должен быть доступен по адресу, указанному в параметре `api` (по умолчанию `https://ai-studia.ru`).

Убедитесь, что:
- CORS настроен для разрешения запросов с ваших доменов
- API endpoint `/chat` работает корректно
- WebSocket сервер доступен по указанному адресу

## Проверка установки

После установки виджет должен появиться в правом нижнем углу страницы. Откройте консоль браузера (F12) и проверьте:
- Нет ошибок загрузки
- Виджет инициализирован (должно быть сообщение "AI Widget загружен и инициализирован")

## Поддержка

При возникновении проблем проверьте:
1. Правильность URL виджета
2. Доступность всех файлов на ai-studia.ru
3. Настройки CORS на бэкенде
4. Консоль браузера на наличие ошибок

