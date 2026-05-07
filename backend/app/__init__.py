from typing import Optional

from flask import Flask, jsonify
from flask_cors import CORS
from app.models import db
from app.models.database import seed_initial_data


def create_app(config_overrides: Optional[dict] = None) -> Flask:
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///dashboard.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET'] = 'tushun-dev-secret-change-me'
    if config_overrides:
        app.config.update(config_overrides)

    db.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    from app.routes import auth, products, tax_settings, imports, finance, sales

    app.register_blueprint(auth.bp)
    app.register_blueprint(products.bp)
    app.register_blueprint(tax_settings.bp)
    app.register_blueprint(imports.bp)
    app.register_blueprint(finance.bp)
    app.register_blueprint(sales.bp)

    @app.get('/api/health')
    def health():
        return jsonify({'status': 'ok', 'service': 'tushun-backend'})

    with app.app_context():
        db.create_all()
        seed_initial_data()

    return app
