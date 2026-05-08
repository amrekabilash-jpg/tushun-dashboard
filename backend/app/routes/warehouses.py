from flask import Blueprint, jsonify, request

from app.models import Warehouse, db

bp = Blueprint('warehouses', __name__, url_prefix='/api/warehouses')


@bp.get('/')
def list_warehouses():
    only_active = request.args.get('active', 'true').lower() == 'true'
    q = Warehouse.query
    if only_active:
        q = q.filter_by(is_active=True)
    return jsonify([w.to_dict() for w in q.order_by(Warehouse.id).all()])


@bp.get('/<int:warehouse_id>')
def get_warehouse(warehouse_id):
    w = Warehouse.query.get_or_404(warehouse_id)
    return jsonify(w.to_dict())


@bp.post('/')
def create_warehouse():
    data = request.get_json(silent=True) or {}
    if not data.get('code') or not data.get('name') or not data.get('city'):
        return jsonify({'error': 'code, name, city required'}), 400
    if Warehouse.query.filter_by(code=data['code']).first():
        return jsonify({'error': 'warehouse code already exists'}), 409
    w = Warehouse(
        code=data['code'],
        name=data['name'],
        city=data['city'],
        address=data.get('address'),
        is_active=bool(data.get('is_active', True)),
    )
    db.session.add(w)
    db.session.commit()
    return jsonify(w.to_dict()), 201


@bp.put('/<int:warehouse_id>')
def update_warehouse(warehouse_id):
    w = Warehouse.query.get_or_404(warehouse_id)
    data = request.get_json(silent=True) or {}
    for field in ('name', 'city', 'address'):
        if field in data:
            setattr(w, field, data[field])
    if 'is_active' in data:
        w.is_active = bool(data['is_active'])
    db.session.commit()
    return jsonify(w.to_dict())
