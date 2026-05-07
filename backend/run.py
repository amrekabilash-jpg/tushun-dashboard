"""Точка запуска dev-сервера. Production запускается через gunicorn/waitress."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app  # noqa: E402

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000, use_reloader=False)
