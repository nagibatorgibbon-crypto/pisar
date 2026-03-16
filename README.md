# 🧠 Писарь v2 — ИИ-диктовка для врачей

Врач говорит или загружает аудиофайл → Whisper распознаёт → Claude структурирует → Готовый документ приёма.

## Что нового в v2

- **Загрузка аудиофайлов** — MP3, WAV, M4A, OGG, FLAC, WebM, AAC
- **Медицинский дизайн** — зелёная тема, профессиональный вид
- **Расширенные шаблоны** — полный анамнез, детализация жалоб, развёрнутый психический статус
- **Карточка пациента** — ФИО, МКБ-10, дата автоматически извлекаются
- **Мобильная адаптация** — работает на телефоне

## Быстрый старт (Windows)

### 1. Установи программы
- **Python**: python.org/downloads (галочка "Add to PATH"!)
- **Node.js**: nodejs.org (версия LTS)

### 2. Получи API-ключи
- **OpenAI** (Whisper): platform.openai.com/api-keys
- **Anthropic** (Claude): console.anthropic.com/settings/keys

### 3. Запусти бэкенд (PowerShell)

```powershell
cd C:\med-dictation\backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
$env:OPENAI_API_KEY="sk-ваш-ключ"
$env:ANTHROPIC_API_KEY="sk-ant-ваш-ключ"
python main.py
```

### 4. Запусти фронтенд (второе окно PowerShell)

```powershell
cd C:\med-dictation\frontend
npm install
npm start
```

Откроется http://localhost:3000

## API

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/health` | Проверка сервера |
| POST | `/transcribe` | Аудио → текст (Whisper) |
| POST | `/structure` | Текст → документ (Claude) |
| POST | `/process` | Аудио → документ (полный пайплайн) |

## Стоимость

~$0.03 за приём (3 мин) ≈ 2.5 руб.

## Структура

```
med-dictation/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── public/index.html
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   └── index.js
│   └── package.json
└── README.md
```
