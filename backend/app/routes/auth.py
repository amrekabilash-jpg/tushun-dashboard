from datetime import datetime, timedelta

import jwt
from flask import Blueprint, current_app, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from app.models import User, db

bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@bp.post('/login')
def login():
    data = request.get_json(silent=True) or {}
    user = User.query.filter(
        (User.username == data.get('username')) | (User.email == data.get('username'))
    ).first()
    if not user or not check_password_hash(user.password_hash, data.get('password', '')):
        return jsonify({'error': 'invalid_credentials'}), 401

    token = jwt.encode(
        {
            'user_id': user.id,
            'username': user.username,
            'role': user.role,
            'exp': datetime.utcnow() + timedelta(days=7),
        },
        current_app.config['JWT_SECRET'],
        algorithm='HS256',
    )
    return jsonify({
        'token': token,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role,
        },
    })


@bp.post('/register')
def register():
    data = request.get_json(silent=True) or {}
    if not data.get('username') or not data.get('password') or not data.get('email'):
        return jsonify({'error': 'username, email, password required'}), 400
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'username_taken'}), 409
    user = User(
        username=data['username'],
        email=data['email'],
        password_hash=generate_password_hash(data['password'], method='pbkdf2:sha256'),
        role=data.get('role', 'analyst'),
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({'id': user.id, 'username': user.username}), 201


@bp.get('/me')
def me():
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return jsonify({'error': 'no_token'}), 401
    token = auth_header.split(' ', 1)[1]
    try:
        payload = jwt.decode(token, current_app.config['JWT_SECRET'], algorithms=['HS256'])
    except jwt.PyJWTError:
        return jsonify({'error': 'invalid_token'}), 401
    user = User.query.get(payload['user_id'])
    if not user:
        return jsonify({'error': 'user_not_found'}), 404
    return jsonify({'id': user.id, 'username': user.username, 'email': user.email, 'role': user.role})
