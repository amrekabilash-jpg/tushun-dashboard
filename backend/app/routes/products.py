from flask import Blueprint, jsonify, request

from app.models import ImportBatch, ImportBatchItem, Product, db

bp = Blueprint('products', __name__, url_prefix='/api/products')


@bp.get('/')
def list_products():
    return jsonify([p.to_dict() for p in Product.query.order_by(Product.id).all()])


@bp.get('/<int:product_id>')
def get_product(product_id):
    p = Product.query.get_or_404(product_id)
    return jsonify(p.to_dict())


@bp.get('/<int:product_id>/last-cost')
def last_cost(product_id):
    """Себестоимость 1шт из последней партии этого товара (для формы продажи)."""
    Product.query.get_or_404(product_id)
    row = (db.session.query(ImportBatchItem, ImportBatch)
           .join(ImportBatch, ImportBatchItem.batch_id == ImportBatch.id)
           .filter(ImportBatchItem.product_id == product_id)
           .order_by(ImportBatch.import_date.desc(), ImportBatch.id.desc())
           .first())
    if not row:
        return jsonify({'unit_cost_kzt': None, 'source': None})
    item, batch = row
    return jsonify({
        'unit_cost_kzt': item.unit_cost_kzt,
        'source': {
            'batch_id': batch.id,
            'batch_number': batch.batch_number,
            'import_date': batch.import_date.isoformat() if batch.import_date else None,
        },
    })


@bp.post('/')
def create_product():
    data = request.get_json(silent=True) or {}
    if not data.get('name') or not data.get('category'):
        return jsonify({'error': 'name and category required'}), 400
    p = Product(
        name=data['name'],
        tn_ved_code=data.get('tn_ved_code'),
        category=data['category'],
        unit=data.get('unit', 'шт'),
        customs_duty_percent=float(data.get('customs_duty_percent', 0.12)),
        vat_import_percent=float(data.get('vat_import_percent', 0.12)),
        vat_sale_percent=float(data.get('vat_sale_percent', 0.16)),
        kpn_percent=float(data.get('kpn_percent', 0.10)),
    )
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201
