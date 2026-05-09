"""Конфиг приложения. Один источник правды для DB URL / JWT / CORS.

Локально: читает .env (см. .env.example). DATABASE_URL не задан → SQLite.
Production (Railway): DATABASE_URL и JWT_SECRET берутся из переменных окружения.
"""
import os
import re
from typing import List, Optional, Type

from dotenv import load_dotenv

load_dotenv()


def _normalize_db_url(url: Optional[str]) -> str:
    """Render/Heroku/Railway часто отдают postgres:// — SQLAlchemy 2 ждёт postgresql://."""
    if not url:
        return 'sqlite:///dashboard.db'
    if url.startswith('postgres://'):
        return 'postgresql://' + url[len('postgres://'):]
    return url


class Config:
    SQLALCHEMY_DATABASE_URI = _normalize_db_url(os.getenv('DATABASE_URL'))
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET = os.getenv('JWT_SECRET', 'tushun-dev-secret-change-me')

    # Список фронтенд-источников, которым разрешён CORS.
    # FRONTEND_URLS: запятая-разделённый список (например "https://tushun.vercel.app,http://localhost:1420")
    # По умолчанию разрешены: localhost, любой *.vercel.app поддомен, tauri scheme.
    @staticmethod
    def cors_origins() -> List:
        env_value = os.getenv('FRONTEND_URLS', '')
        defaults: List = [
            'http://localhost:1420',     # Vite dev (Tauri-конфиг)
            'http://127.0.0.1:1420',
            'http://localhost:5173',     # Vite default port
            'http://127.0.0.1:5173',
            'tauri://localhost',         # Tauri scheme
            # Production Vercel: основной домен + любые preview-домены
            'https://tushun-dashboard.vercel.app',
            re.compile(r'^https://tushun-dashboard.*\.vercel\.app$'),
        ]
        extra = [u.strip() for u in env_value.split(',') if u.strip()]
        # dedupe среди строк (regex объекты остаются как есть)
        seen = set()
        result: List = []
        for item in list(defaults) + extra:
            if isinstance(item, str):
                if item not in seen:
                    seen.add(item)
                    result.append(item)
            else:
                result.append(item)
        return result


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'


CONFIG_MAP = {
    'development': DevelopmentConfig,
    'production':  ProductionConfig,
    'testing':     TestingConfig,
}


def get_config(env: Optional[str] = None) -> Type[Config]:
    env = env or os.getenv('FLASK_ENV', 'development')
    return CONFIG_MAP.get(env, DevelopmentConfig)
