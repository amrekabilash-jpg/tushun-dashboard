###
# Dockerfile для Railway (backend Flask).
# Build context = корень репы (tushun-app/).
###
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FLASK_ENV=production

WORKDIR /app

# Системные зависимости для psycopg2-binary не нужны (binary wheel),
# но иногда полезны build-essential — оставляем минимальный образ.

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/ /app/backend/

EXPOSE 5000

# gunicorn — production WSGI запускается из /app
# PYTHONPATH=/app/backend позволяет импортировать как "from config import ..."
# Но для gunicorn правильно вызывать как backend.run:app из /app
ENV PYTHONPATH=/app:$PYTHONPATH

CMD gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 2 --timeout 90 backend.run:app
