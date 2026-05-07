"""Точка запуска dev-сервера.

Локально: python run.py → 127.0.0.1:5000 с debug.
Railway/production: gunicorn запускает напрямую `app:create_app()`,
но fallback тут на 0.0.0.0:$PORT тоже работает.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app  # noqa: E402

env = os.getenv('FLASK_ENV', 'development')
app = create_app(env)


if __name__ == '__main__':
    if env == 'production':
        port = int(os.getenv('PORT', 5000))
        app.run(debug=False, host='0.0.0.0', port=port)
    else:
        app.run(debug=True, host='127.0.0.1', port=5000, use_reloader=False)
