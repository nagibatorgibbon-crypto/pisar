# Деплой Писаря на Railway

## Пошаговая инструкция

### Шаг 1 — Загрузи код на GitHub

Открой PowerShell и выполни по одной команде:

```
cd C:\med-dictation
git init
git add .
git commit -m "Писарь v2"
```

Зайди на github.com → нажми "+" → "New repository" → назови "pisar" → Create.
НЕ ставь галочки на README и .gitignore.

Потом в PowerShell (замени ТВОЙ_ЛОГИН на свой GitHub логин):

```
git remote add origin https://github.com/ТВОЙ_ЛОГИН/pisar.git
git branch -M main
git push -u origin main
```

GitHub попросит логин и пароль (или токен).

### Шаг 2 — Зарегистрируйся на Railway

1. Зайди на railway.app
2. Нажми "Login" → "Login with GitHub"
3. Разреши доступ

### Шаг 3 — Создай проект

1. Нажми "New Project"
2. Выбери "Deploy from GitHub repo"
3. Найди свой репозиторий "pisar"
4. Railway начнёт сборку автоматически

### Шаг 4 — Добавь API-ключи

Сборка упадёт — это нормально, нужны ключи:

1. В Railway нажми на свой сервис
2. Перейди во вкладку "Variables"
3. Добавь две переменные:
   - `NEXARA_API_KEY` = твой ключ Nexara
   - `OPENROUTER_API_KEY` = твой ключ Anthropic
4. Railway автоматически пересоберёт проект

### Шаг 5 — Получи ссылку

1. Перейди во вкладку "Settings"
2. В разделе "Networking" нажми "Generate Domain"
3. Railway выдаст ссылку вида: `pisar-production-xxxx.up.railway.app`

Эту ссылку отправляй врачам — они откроют в браузере и смогут пользоваться.

### Готово!

Приложение работает 24/7. При каждом `git push` Railway автоматически обновляет сервер.

## Стоимость

- Railway даёт $5 бесплатных кредитов на старте
- После этого ~$5/мес за работающий сервис
- Плюс стоимость API (OpenAI + Anthropic) — ~$0.03 за приём

## Обновление приложения

Когда хочешь обновить код:

```
cd C:\med-dictation
git add .
git commit -m "описание изменений"
git push
```

Railway подхватит автоматически.
