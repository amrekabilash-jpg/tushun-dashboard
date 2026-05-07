"""Главный API для редактирования переменных налоговых ставок.

Любое изменение записывается в tax_settings_history — история аудита.
"""
from flask import Blueprint, jsonify, request

from app.models import Product, TaxSettingsHistory, db

bp = Blueprint('tax_settings', __name__, url_prefix='/api/tax-settings')

EDITABLE_FIELDS = (
    'customs_duty_percent',
    'vat_import_percent',
    'vat_sale_percent',
    'kpn_percent',
)


@bp.get('/')
def list_tax_settings():
    return jsonify([p.to_dict() for p in Product.query.order_by(Product.id).all()])


@bp.put('/<int:product_id>')
def update_tax_settings(product_id):
    product = Product.query.get_or_404(product_id)
    data = request.get_json(silent=True) or {}
    changed_by = data.get('changed_by') or request.headers.get('X-User', 'unknown')
    reason = data.get('reason', '')

    changes = []
    for field in EDITABLE_FIELDS:
        if field not in data:
            continue
        new_value = float(data[field])
        old_value = float(getattr(product, field))
        if abs(new_value - old_value) < 1e-9:
            continue
        db.session.add(TaxSettingsHistory(
            product_id=product.id,
            field_name=field,
            old_value=old_value,
            new_value=new_value,
            changed_by=changed_by,
            reason=reason,
        ))
        setattr(product, field, new_value)
        changes.append({'field': field, 'old': old_value, 'new': new_value})

    if not changes:
        return jsonify({'message': 'no_changes', 'product': product.to_dict()})

    db.session.commit()
    return jsonify({'message': 'updated', 'changes': changes, 'product': product.to_dict()})


@bp.get('/history/<int:product_id>')
def history(product_id):
    Product.query.get_or_404(product_id)
    rows = (TaxSettingsHistory.query
            .filter_by(product_id=product_id)
            .order_by(TaxSettingsHistory.changed_at.desc())
            .limit(200).all())
    return jsonify([{
        'id': r.id,
        'field': r.field_name,
        'old': r.old_value,
        'new': r.new_value,
        'changed_by': r.changed_by,
        'reason': r.reason,
        'changed_at': r.changed_at.isoformat(),
    } for r in rows])
