"""
Писарь v3 — Backend API
FastAPI + OpenAI Whisper + Anthropic Claude + SQLite
"""

import os
import json
import re
import tempfile
import sqlite3
import uuid
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from anthropic import Anthropic

app = FastAPI(title="Писарь API", version="3.0.0")

# Serve React static files in production
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import pathlib

STATIC_DIR = pathlib.Path(__file__).parent / "static"
DB_PATH = pathlib.Path(__file__).parent / "pisar.db"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Database ───

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS records (
            id TEXT PRIMARY KEY,
            patient_name TEXT DEFAULT '',
            diagnosis_code TEXT DEFAULT '',
            specialty TEXT DEFAULT '',
            summary TEXT DEFAULT '',
            sections TEXT DEFAULT '[]',
            transcript TEXT DEFAULT '',
            created_at TEXT DEFAULT ''
        )
    """)
    conn.commit()
    conn.close()


init_db()

openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
anthropic_client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

ALLOWED_AUDIO = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".webm", ".mp4", ".mpeg", ".mpga", ".oga", ".wma", ".aac"}

# ─── Расширенные промпты по специальностям ───

PROMPTS = {
    "psychiatrist": """Ты — ИИ-ассистент психиатра. Получив расшифровку речи врача, структурируй её в полноценный медицинский документ психиатрического приёма.

Формат ответа — СТРОГО JSON (без markdown, без backticks):
{
  "patient_name": "ФИО пациента если упомянуто, иначе пустая строка",
  "date": "Дата приёма если упомянута, иначе пустая строка",
  "specialty": "Психиатр",
  "diagnosis_code": "Код МКБ-10 если определён, иначе пустая строка",
  "sections": [
    {
      "title": "Жалобы",
      "content": "Основные жалобы больного с детальной характеристикой:\n- Точная локализация и характер болезненных явлений\n- Время появления (днём, ночью)\n- Факторы, вызывающие симптомы\n- Интенсивность и продолжительность\n- Чем купируются\n- Дополнительные жалобы при активном опросе"
    },
    {
      "title": "Анамнез заболевания (Anamnesis morbi)",
      "content": "Хронологическое описание:\n- Когда и при каких обстоятельствах заболел впервые\n- С каких жалоб началось заболевание\n- Факторы, способствующие началу\n- Первое обращение к врачу, диагноз, лечение, эффективность\n- Динамика симптомов, новые симптомы\n- Частота обострений, длительность ремиссий\n- Применявшееся лечение (стационарное, амбулаторное, медикаменты, психотерапия)\n- Трудоспособность за период заболевания"
    },
    {
      "title": "Анамнез жизни (Anamnesis vitae)",
      "content": "- Краткие биографические данные (год/место рождения, развитие)\n- Образование, военная служба\n- Семейно-половой анамнез\n- Трудовой анамнез, условия труда, профвредности\n- Бытовой анамнез (жильё, питание)\n- Вредные привычки (курение, алкоголь, наркотики — с какого возраста, количество)\n- Перенесённые заболевания, операции, травмы\n- Эпидемиологический анамнез\n- Аллергологический анамнез\n- Наследственность (заболевания родственников)"
    },
    {
      "title": "Психический статус",
      "content": "- Сознание и ориентировка (время, место, собственная личность)\n- Внешний вид и поведение\n- Контакт, отношение к беседе\n- Восприятие (иллюзии, галлюцинации — слуховые, зрительные, тактильные)\n- Мышление (темп, форма, содержание — навязчивые, сверхценные, бредовые идеи)\n- Эмоциональная сфера (настроение, аффект, суицидальные мысли/намерения)\n- Волевая сфера (мотивация, побуждения, активность)\n- Внимание и память\n- Интеллект\n- Критика к состоянию и заболеванию"
    },
    {
      "title": "Соматический статус",
      "content": "- Общее состояние, телосложение, питание\n- Кожные покровы (следы самоповреждений, инъекций)\n- АД, ЧСС, температура\n- Органы и системы (кратко)"
    },
    {
      "title": "Диагноз",
      "content": "Основной диагноз по МКБ-10 с кодом.\nСопутствующие диагнозы если есть."
    },
    {
      "title": "Назначения",
      "content": "- Фармакотерапия (препарат, дозировка, схема приёма, длительность)\n- Психотерапия (вид, частота)\n- Дополнительные обследования\n- Дата повторного приёма\n- Рекомендации"
    }
  ],
  "summary": "Краткое резюме приёма в 1-2 предложения"
}

Правила:
- Используй профессиональную психиатрическую терминологию
- Заполняй разделы ТОЛЬКО на основе предоставленных данных
- Если данных для раздела или подраздела нет — напиши "Данные не предоставлены"
- НЕ придумывай информацию, которой нет в расшифровке
- Диагноз по МКБ-10 если возможно определить
- Пиши на русском языке""",

    "therapist": """Ты — ИИ-ассистент терапевта. Получив расшифровку речи врача, структурируй её в полноценный медицинский документ терапевтического приёма.

Формат ответа — СТРОГО JSON (без markdown, без backticks):
{
  "patient_name": "ФИО пациента если упомянуто, иначе пустая строка",
  "date": "Дата приёма если упомянута, иначе пустая строка",
  "specialty": "Терапевт",
  "diagnosis_code": "Код МКБ-10 если определён, иначе пустая строка",
  "sections": [
    {
      "title": "Жалобы",
      "content": "Основные жалобы с детализацией каждой:\n- Локализация, иррадиация\n- Характер (жжение, покалывание, давление и т.д.)\n- Провоцирующие факторы\n- Продолжительность и интенсивность\n- Что приносит облегчение\n- Сопутствующие симптомы\n- Дополнительные жалобы"
    },
    {
      "title": "Анамнез заболевания (Anamnesis morbi)",
      "content": "Хронологическое описание:\n- Когда и при каких обстоятельствах заболел\n- Первые проявления\n- Обращения к врачам, обследования, диагнозы\n- Проводившееся лечение и его эффективность\n- Динамика симптомов\n- Частота обострений\n- Трудоспособность"
    },
    {
      "title": "Анамнез жизни (Anamnesis vitae)",
      "content": "- Биографические данные\n- Семейно-половой анамнез\n- Трудовой анамнез, профвредности\n- Бытовые условия, питание\n- Вредные привычки\n- Перенесённые заболевания\n- Эпидемиологический анамнез\n- Аллергологический анамнез\n- Наследственность"
    },
    {
      "title": "Объективный осмотр (Status praesens)",
      "content": "- Общее состояние, сознание, положение\n- Телосложение, рост, вес, ИМТ\n- Кожные покровы и слизистые\n- Лимфатические узлы\n- Опорно-двигательная система\n- Органы дыхания (ЧДД, перкуссия, аускультация)\n- Сердечно-сосудистая система (АД, ЧСС, тоны, шумы)\n- Органы пищеварения (язык, живот, печень, селезёнка)\n- Мочевыделительная система\n- Нервная система\n- Температура тела"
    },
    {
      "title": "Диагноз",
      "content": "Основной диагноз по МКБ-10.\nСопутствующие заболевания."
    },
    {
      "title": "Назначения",
      "content": "- Медикаментозная терапия (препарат, дозировка, кратность, длительность)\n- Немедикаментозное лечение\n- Обследования (анализы, ЭКГ, УЗИ и т.д.)\n- Консультации специалистов\n- Дата повторного приёма\n- Рекомендации по режиму и питанию"
    }
  ],
  "summary": "Краткое резюме приёма в 1-2 предложения"
}

Правила:
- Профессиональная медицинская терминология
- Заполняй ТОЛЬКО на основе предоставленных данных
- Нет данных = "Данные не предоставлены"
- НЕ придумывай информацию
- МКБ-10, русский язык""",

    "pediatrician": """Ты — ИИ-ассистент педиатра. Получив расшифровку речи врача, структурируй её в полноценный медицинский документ педиатрического приёма.

Формат ответа — СТРОГО JSON (без markdown, без backticks):
{
  "patient_name": "ФИО ребёнка если упомянуто, иначе пустая строка",
  "date": "Дата приёма если упомянута, иначе пустая строка",
  "specialty": "Педиатр",
  "diagnosis_code": "Код МКБ-10 если определён, иначе пустая строка",
  "sections": [
    {
      "title": "Жалобы",
      "content": "Жалобы (со слов родителей/ребёнка):\n- Основные жалобы с детализацией\n- Дополнительные жалобы"
    },
    {
      "title": "Анамнез заболевания",
      "content": "- Когда заболел, с чего началось\n- Динамика симптомов\n- Проводившееся лечение до обращения\n- Эффективность лечения"
    },
    {
      "title": "Анамнез жизни",
      "content": "- Течение беременности и родов у матери\n- Вес и рост при рождении, оценка по Апгар\n- Вскармливание (грудное/искусственное)\n- Перенесённые заболевания\n- Прививки (по календарю/нет)\n- Аллергологический анамнез\n- Наследственность"
    },
    {
      "title": "Объективный осмотр",
      "content": "- Общее состояние, сознание, активность\n- Температура тела\n- Кожные покровы и слизистые\n- Зев, миндалины\n- Лимфатические узлы\n- Носовое дыхание\n- Органы дыхания (ЧДД, аускультация)\n- Сердечно-сосудистая система (ЧСС)\n- Живот\n- Стул, мочеиспускание"
    },
    {
      "title": "Физическое развитие",
      "content": "- Возраст\n- Вес, рост\n- Соответствие возрастным нормам\n- Центильные коридоры если возможно оценить"
    },
    {
      "title": "Диагноз",
      "content": "Основной диагноз по МКБ-10.\nСопутствующие."
    },
    {
      "title": "Назначения",
      "content": "- Медикаментозная терапия (с дозировками по весу/возрасту)\n- Режим, питание\n- Обследования\n- Дата повторного осмотра\n- Показания для экстренного обращения"
    }
  ],
  "summary": "Краткое резюме приёма в 1-2 предложения"
}

Правила:
- Педиатрическая терминология, учитывать возраст
- Заполняй ТОЛЬКО на основе данных
- Нет данных = "Данные не предоставлены"
- НЕ придумывай
- МКБ-10, русский язык""",
}


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}


@app.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """Распознавание речи через Whisper API. Принимает аудиофайл любого формата."""
    if not os.environ.get("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY не задан")

    # Проверяем формат файла
    filename = audio.filename or "audio.webm"
    ext = os.path.splitext(filename)[1].lower()
    if ext and ext not in ALLOWED_AUDIO:
        raise HTTPException(
            status_code=400,
            detail=f"Формат {ext} не поддерживается. Допустимые: MP3, WAV, M4A, OGG, FLAC, WebM",
        )

    # Сохраняем во временный файл
    suffix = ext or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await audio.read()
        if len(content) > 25 * 1024 * 1024:  # 25 МБ лимит Whisper
            raise HTTPException(status_code=400, detail="Файл слишком большой (максимум 25 МБ)")
        tmp.write(content)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as audio_file:
            transcript = openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="ru",
                response_format="text",
            )
        return {"text": transcript.strip(), "filename": filename}
    except Exception as e:
        err_str = str(e)
        if "insufficient_quota" in err_str or "exceeded" in err_str:
            raise HTTPException(status_code=429, detail="Недостаточно средств на аккаунте OpenAI. Пополните баланс на platform.openai.com → Billing")
        raise HTTPException(status_code=500, detail=f"Ошибка распознавания речи: {err_str}")
    finally:
        os.unlink(tmp_path)


@app.post("/structure")
async def structure_text(
    text: str = Form(...),
    specialty: str = Form("psychiatrist"),
):
    """Структурирование текста через Claude API."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY не задан")

    if specialty not in PROMPTS:
        raise HTTPException(status_code=400, detail=f"Неизвестная специальность: {specialty}")

    try:
        message = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": f'{PROMPTS[specialty]}\n\nРасшифровка речи врача:\n"{text}"',
                }
            ],
        )
        response_text = ""
        for block in message.content:
            if block.type == "text":
                response_text += block.text

        cleaned = response_text.strip()
        # Убираем markdown обёртки если есть
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()

        # Убираем управляющие символы внутри JSON-строк
        cleaned = re.sub(r'[\x00-\x1f\x7f]', lambda m: {
            '\n': '\\n', '\r': '\\r', '\t': '\\t'
        }.get(m.group(), ''), cleaned)

        result = json.loads(cleaned)
        return result

    except json.JSONDecodeError as e:
        # Вторая попытка: попросить Claude исправить JSON
        try:
            fix_message = anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                messages=[
                    {"role": "user", "content": f"Исправь этот невалидный JSON и верни ТОЛЬКО валидный JSON без пояснений:\n{response_text}"}
                ],
            )
            fix_text = ""
            for block in fix_message.content:
                if block.type == "text":
                    fix_text += block.text
            fix_text = fix_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            fix_text = re.sub(r'[\x00-\x1f\x7f]', lambda m: {
                '\n': '\\n', '\r': '\\r', '\t': '\\t'
            }.get(m.group(), ''), fix_text)
            result = json.loads(fix_text)
            return result
        except Exception:
            raise HTTPException(status_code=500, detail=f"Ошибка парсинга ответа. Попробуйте ещё раз.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка Claude: {str(e)}")


@app.post("/process")
async def process_audio(
    audio: UploadFile = File(...),
    specialty: str = Form("psychiatrist"),
):
    """Полный пайплайн: аудио → Whisper → Claude → документ."""
    transcription = await transcribe_audio(audio)
    text = transcription["text"]
    if not text.strip():
        raise HTTPException(status_code=400, detail="Не удалось распознать речь в записи")
    result = await structure_text(text=text, specialty=specialty)
    return {"transcript": text, "document": result}


# ─── Patient Records API ───

@app.post("/records")
async def save_record(
    patient_name: str = Form(""),
    diagnosis_code: str = Form(""),
    specialty: str = Form(""),
    summary: str = Form(""),
    sections: str = Form("[]"),
    transcript: str = Form(""),
):
    """Сохранить запись приёма в базу данных."""
    record_id = str(uuid.uuid4())[:8]
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    conn = get_db()
    conn.execute(
        "INSERT INTO records (id, patient_name, diagnosis_code, specialty, summary, sections, transcript, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (record_id, patient_name, diagnosis_code, specialty, summary, sections, transcript, now),
    )
    conn.commit()
    conn.close()
    return {"id": record_id, "created_at": now}


@app.get("/records")
async def list_records():
    """Список всех записей (краткая информация)."""
    conn = get_db()
    rows = conn.execute(
        "SELECT id, patient_name, diagnosis_code, specialty, summary, created_at FROM records ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/records/{record_id}")
async def get_record(record_id: str):
    """Получить полную запись по ID."""
    conn = get_db()
    row = conn.execute("SELECT * FROM records WHERE id = ?", (record_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    record = dict(row)
    record["sections"] = json.loads(record["sections"])
    return record


@app.delete("/records/{record_id}")
async def delete_record(record_id: str):
    """Удалить запись."""
    conn = get_db()
    conn.execute("DELETE FROM records WHERE id = ?", (record_id,))
    conn.commit()
    conn.close()
    return {"deleted": record_id}


# ─── Serve React frontend in production ───

@app.on_event("startup")
async def mount_static():
    if STATIC_DIR.exists():
        app.mount("/static", StaticFiles(directory=str(STATIC_DIR / "static")), name="static-assets")


@app.get("/{full_path:path}")
async def serve_react(full_path: str):
    """Serve React app for all non-API routes."""
    if STATIC_DIR.exists():
        # Try to serve the exact file
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        # Fallback to index.html for React routing
        index = STATIC_DIR / "index.html"
        if index.exists():
            return FileResponse(str(index))
    return {"detail": "Frontend not built. Run: cd frontend && npm run build"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
