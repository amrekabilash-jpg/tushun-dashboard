from typing import Optional

from flask import Flask, jsonify
from flask_cors import CORS

from config import get_config
from app.models import db
from app.models.database import seed_initial_data


def create_app(env: Optional[str] = None, config_overrides: Optional[dict] = None) -> Flask:
    """Application factory.

    env: 'development' | 'production' | 'testing'.
    Если None — берётся из переменной FLASK_ENV (см. config.py).
    """
    app = Flask(__name__)
    app.config.from_object(get_config(env))
    if config_overrides:
        app.config.update(config_overrides)

    db.init_app(app)
    CORS(
        app,
        resources={r"/api/*": {"origins": get_config(env).cors_origins()}},
        supports_credentials=True,
    )

    from app.routes import (
        auth, products, tax_settings, imports, finance, sales,
        cash_transactions, receivables, budget,
    )

    app.register_blueprint(auth.bp)
    app.register_blueprint(products.bp)
    app.register_blueprint(tax_settings.bp)
    app.register_blueprint(imports.bp)
    app.register_blueprint(finance.bp)
    app.register_blueprint(sales.bp)
    app.register_blueprint(cash_transactions.bp)
    app.register_blueprint(receivables.bp)
    app.register_blueprint(budget.bp)

    @app.get('/api/health')
    def health():
        return jsonify({
            'status': 'ok',
            'service': 'tushun-backend',
            'env': env or app.config.get('ENV', 'development'),
        })

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({'error': 'internal_server_error', 'detail': str(e)}), 500

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'not_found', 'path': str(e)}), 404

    with app.app_context():
        db.create_all()
        seed_initial_data()

    return app
