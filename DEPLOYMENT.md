# Tushun Dashboard — Deployment Guide

Проект готов для развёртывания на **Railway** (backend) и **Vercel** (frontend).

## Архитектура

```
┌─────────────────────────┐
│  Vercel (Frontend)      │
│  React + Vite           │
│  VITE_API_URL →         │
└────────────┬────────────┘
             │ API calls
             ↓
┌─────────────────────────┐
│  Railway (Backend)      │
│  Flask + Gunicorn       │
│  PostgreSQL (Supabase)  │
└─────────────────────────┘
```

## Prerequisites

- **Supabase PostgreSQL** (создан, schema загружена)
- **Railway** аккаунт + GitHub подключен
- **Vercel** аккаунт + GitHub подключен

## Backend (Railway)

### Переменные окружения в Railway:

```env
FLASK_ENV=production
DATABASE_URL=postgresql://postgres:...@db.xxxxx.supabase.co:5432/postgres
JWT_SECRET=5ea2625ffa1a77f3fdb4e6c39faed4f2d22d5e46e90297edf382d52c02b9907e
FRONTEND_URLS=https://tushun.vercel.app  # добавить после Vercel deployment
```

### Build & Deploy:

1. Создать новый проект в Railway
2. Подключить GitHub репо: `amrekabilash-jpg/tushun-dashboard`
3. Railway автоматически обнаружит `Dockerfile`
4. Добавить переменные окружения (Settings → Variables)
5. Deploy автоматически начнется

### Health Check:

```bash
curl https://YOUR_RAILWAY_URL/api/health
# {"status":"ok","service":"tushun-backend","env":"production"}
```

## Frontend (Vercel)

### Переменные окружения в Vercel:

```env
VITE_API_URL=https://tushun-api.up.railway.app  # реальный Railway URL
```

### Build & Deploy:

1. Создать новый проект в Vercel
2. Подключить GitHub репо: `amrekabilash-jpg/tushun-dashboard`
3. Framework: **Vite** (автодетект)
4. Добавить переменные окружения (Settings → Environment Variables)
5. Deploy автоматически начнется

## Local Development

### Backend:

```bash
cd backend
python -m venv venv
source venv/bin/activate  # или venv\Scripts\activate (Windows)
pip install -r requirements.txt
python run.py
# http://127.0.0.1:5000
```

### Frontend:

```bash
npm install
npm run dev
# http://localhost:5173
```

Убедись что в `.env.local`:
```env
VITE_API_URL=http://127.0.0.1:5000
```

## Files Overview

| File | Purpose |
|------|---------|
| `Dockerfile` | Railway build configuration (Flask + Gunicorn) |
| `railway.json` | Railway-specific deploy settings |
| `vercel.json` | Vercel-specific build settings |
| `backend/config.py` | Flask config with env var support |
| `backend/run.py` | Entry point (development + production) |
| `backend/requirements.txt` | Python dependencies |
| `.env.example` | Template for local frontend config |
| `.env.local` | Local development (git-ignored) |
| `.env.production` | Production frontend build (committed) |
| `backend/.env.example` | Template for backend config |

## Database Migration

После Supabase setup, миграция SQLite → PostgreSQL:

```bash
cd backend
python migrate_sqlite_to_postgres.py
```

Это переносит локальные данные в Supabase.

## Troubleshooting

### Railway Build Failed
- Проверь `requirements.txt` (все зависимости установлены)
- Проверь `Dockerfile` (правильный WORKDIR)
- Просмотри логи в Railway dashboard

### Vercel Build Failed
- Проверь что `vite.config.ts` правильный
- Убедись что `package.json` содержит все нужные скрипты
- Проверь что переменные окружения установлены

### API Connection Issues
- Убедись что `VITE_API_URL` содержит правильный Railway URL
- Проверь CORS в `backend/config.py` → `FRONTEND_URLS`
- Проверь что backend запущен: `curl /api/health`

## Next Steps

1. ✅ Supabase: Database создана, schema загружена
2. ⏳ Railway: Создать проект и добавить env vars
3. ⏳ Vercel: Создать проект и добавить env vars
4. ⏳ Test: Проверить `/api/health`, API endpoints, frontend

---

**Created**: 2026-05-07  
**Status**: Ready for Cloud Deployment
