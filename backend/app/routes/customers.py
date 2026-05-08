"""Module 3: Customers CRUD."""
from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.models import Customer, Invoice, db

bp = Blueprint('customers', __name__, url_prefix='/api/customers')


@bp.get('/')
def list_customers():
    """Список клиентов с агрегатами по дебиторке.

    Query: status (active|inactive|blocked), search, type (b2b|b2c)
    """
    q = Customer.query

    status = request.args.get('status')
    search = request.args.get('search', '').strip().lower()
    ctype = request.args.get('type')

    if status:
        q = q.filter(Customer.status == status)
    if ctype:
        q = q.filter(Customer.customer_type == ctype)
    customers = q.order_by(Customer.name).all()

    if search:
        customers = [c for c in customers
                     if search in c.name.lower()
                     or search in (c.phone or '').lower()
                     or search in (c.tax_id or '').lower()]

    # Агрегаты по invoices per customer
    aggs = (db.session.query(
                Invoice.customer_id,
                func.count(Invoice.id).label('invoice_count'),
                func.coalesce(func.sum(Invoice.total_kzt), 0).label('total_kzt'),
                func.coalesce(func.sum(Invoice.paid_kzt), 0).label('paid_kzt'),
            )
            .group_by(Invoice.customer_id)
            .all())
    agg_map = {a.customer_id: a for a in aggs}

    result = []
    for c in customers:
        agg = agg_map.get(c.id)
        d = c.to_dict()
        d['invoice_count'] = int(agg.invoice_count) if agg else 0
        d['total_revenue_kzt'] = float(agg.total_kzt) if agg else 0
        d['outstanding_kzt'] = (float(agg.total_kzt) - float(agg.paid_kzt)) if agg else 0
        result.append(d)
    return jsonify(result)


@bp.get('/<int:customer_id>')
def get_customer(customer_id):
    c = Customer.query.get_or_404(customer_id)
    return jsonify(c.to_dict())


@bp.post('/')
def create_customer():
    data = request.get_json(silent=True) or {}
    if not data.get('name'):
        return jsonify({'error': 'name required'}), 400
    c = Customer(
        name=data['name'].strip(),
        phone=data.get('phone'),
        email=data.get('email'),
        address=data.get('address'),
        tax_id=data.get('tax_id'),
        customer_type=data.get('customer_type', 'b2b'),
        status=data.get('status', 'active'),
        discount_percent=float(data.get('discount_percent', 0)),
        credit_limit_kzt=float(data.get('credit_limit_kzt', 0)),
        notes=data.get('notes'),
    )
    db.session.add(c)
    db.session.commit()
    return jsonify(c.to_dict()), 201


@bp.put('/<int:customer_id>')
def update_customer(customer_id):
    c = Customer.query.get_or_404(customer_id)
    data = request.get_json(silent=True) or {}
    for f in ('name', 'phone', 'email', 'address', 'tax_id',
              'customer_type', 'status', 'notes'):
        if f in data:
            setattr(c, f, data[f])
    if 'discount_percent' in data:
        c.discount_percent = float(data['discount_percent'])
    if 'credit_limit_kzt' in data:
        c.credit_limit_kzt = float(data['credit_limit_kzt'])
    db.session.commit()
    return jsonify(c.to_dict())
