"""Module 6: гарантии, рекламации, возвраты."""
from datetime import date, timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.models import (
    Customer, Invoice, Product, SaleItem,
    WarrantyClaim, WarrantyPlan, WarrantyReturn, db,
)

bp = Blueprint('warranty', __name__)


VALID_CLAIM_TYPES = {'defect', 'damage', 'wrong_item', 'other'}
VALID_CLAIM_STATUSES = {'open', 'in_review', 'resolved', 'rejected'}
VALID_RETURN_STATUSES = {'pending', 'approved', 'refunded', 'rejected'}
VALID_REFUND_METHODS = {'cash', 'bank', 'exchange', 'credit'}


def _parse_date(s):
    if not s:
        return None
    if isinstance(s, date):
        return s
    return date.fromisoformat(s)


# ---------- WARRANTY PLANS ----------

@bp.get('/api/warranties/')
def list_plans():
    """Список гарантийных планов с фильтрами.

    Query: active (true|false), product_id
    """
    q = WarrantyPlan.query
    active = request.args.get('active')
    if active in ('true', 'false'):
        q = q.filter(WarrantyPlan.is_active == (active == 'true'))
    product_id = request.args.get('product_id', type=int)
    if product_id:
        q = q.filter(WarrantyPlan.product_id == product_id)
    rows = q.order_by(WarrantyPlan.is_active.desc(), WarrantyPlan.id.asc()).all()
    return jsonify([p.to_dict() for p in rows])


@bp.post('/api/warranties/')
def create_plan():
    data = request.get_json(silent=True) or {}
    if not data.get('product_id') or not data.get('name') or not data.get('months'):
        return jsonify({'error': 'product_id, name, months required'}), 400
    Product.query.get_or_404(int(data['product_id']))

    p = WarrantyPlan(
        product_id=int(data['product_id']),
        name=data['name'].strip(),
        months=int(data['months']),
        coverage_percent=float(data.get('coverage_percent', 100)),
        price_kzt=float(data.get('price_kzt', 0)),
        description=data.get('description'),
        is_active=bool(data.get('is_active', True)),
    )
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201


@bp.put('/api/warranties/<int:plan_id>')
def update_plan(plan_id):
    p = WarrantyPlan.query.get_or_404(plan_id)
    data = request.get_json(silent=True) or {}
    for f in ('name', 'description'):
        if f in data:
            setattr(p, f, data[f])
    if 'months' in data:
        p.months = int(data['months'])
    if 'coverage_percent' in data:
        p.coverage_percent = float(data['coverage_percent'])
    if 'price_kzt' in data:
        p.price_kzt = float(data['price_kzt'])
    if 'is_active' in data:
        p.is_active = bool(data['is_active'])
    db.session.commit()
    return jsonify(p.to_dict())


@bp.delete('/api/warranties/<int:plan_id>')
def delete_plan(plan_id):
    p = WarrantyPlan.query.get_or_404(plan_id)
    db.session.delete(p)
    db.session.commit()
    return jsonify({'deleted': True, 'id': plan_id})


# ---------- CLAIMS ----------

@bp.get('/api/claims/')
def list_claims():
    """Список рекламаций с фильтрами.

    Query: status, claim_type, product_id, customer_id, date_from, date_to, search
    """
    q = WarrantyClaim.query

    status = request.args.get('status')
    if status:
        q = q.filter(WarrantyClaim.status == status)
    ctype = request.args.get('claim_type')
    if ctype:
        q = q.filter(WarrantyClaim.claim_type == ctype)
    product_id = request.args.get('product_id', type=int)
    if product_id:
        q = q.filter(WarrantyClaim.product_id == product_id)
    customer_id = request.args.get('customer_id', type=int)
    if customer_id:
        q = q.filter(WarrantyClaim.customer_id == customer_id)
    date_from = request.args.get('date_from')
    if date_from:
        q = q.filter(WarrantyClaim.claim_date >= date_from)
    date_to = request.args.get('date_to')
    if date_to:
        q = q.filter(WarrantyClaim.claim_date <= date_to)

    rows = q.order_by(WarrantyClaim.claim_date.desc(), WarrantyClaim.id.desc()).all()
    items = [c.to_dict() for c in rows]

    search = request.args.get('search', '').strip().lower()
    if search:
        items = [d for d in items
                 if search in (d['claim_number'] or '').lower()
                 or search in (d['customer_name'] or '').lower()
                 or search in (d['product_name'] or '').lower()]
    return jsonify(items)


@bp.get('/api/claims/<int:claim_id>')
def get_claim(claim_id):
    c = WarrantyClaim.query.get_or_404(claim_id)
    d = c.to_dict()
    d['returns'] = [r.to_dict() for r in c.returns]
    return jsonify(d)


@bp.post('/api/claims/')
def create_claim():
    data = request.get_json(silent=True) or {}
    required = ('product_id',)
    if not all(data.get(k) for k in required):
        return jsonify({'error': f'fields required: {", ".join(required)}'}), 400

    Product.query.get_or_404(int(data['product_id']))

    if data.get('invoice_id'):
        Invoice.query.get_or_404(int(data['invoice_id']))
    if data.get('customer_id'):
        Customer.query.get_or_404(int(data['customer_id']))

    ctype = data.get('claim_type', 'defect')
    if ctype not in VALID_CLAIM_TYPES:
        return jsonify({'error': f'claim_type must be one of {sorted(VALID_CLAIM_TYPES)}'}), 400

    status = data.get('status', 'open')
    if status not in VALID_CLAIM_STATUSES:
        return jsonify({'error': f'status must be one of {sorted(VALID_CLAIM_STATUSES)}'}), 400

    # Auto-generate claim_number
    claim_no = data.get('claim_number')
    if not claim_no:
        last = WarrantyClaim.query.order_by(WarrantyClaim.id.desc()).first()
        next_seq = (last.id + 1) if last else 1
        claim_no = f'РК-{date.today().year}-{100 + next_seq:03d}'

    if WarrantyClaim.query.filter_by(claim_number=claim_no).first():
        return jsonify({'error': 'claim_number_exists'}), 409

    customer_name = data.get('customer_name')
    if data.get('customer_id') and not customer_name:
        cust = Customer.query.get(int(data['customer_id']))
        if cust:
            customer_name = cust.name

    c = WarrantyClaim(
        claim_number=claim_no,
        invoice_id=int(data['invoice_id']) if data.get('invoice_id') else None,
        product_id=int(data['product_id']),
        customer_id=int(data['customer_id']) if data.get('customer_id') else None,
        customer_name=customer_name,
        quantity=int(data.get('quantity', 1)),
        claim_type=ctype,
        description=data.get('description'),
        status=status,
        claim_date=_parse_date(data.get('claim_date')) or date.today(),
    )
    db.session.add(c)
    db.session.commit()
    return jsonify(c.to_dict()), 201


@bp.put('/api/claims/<int:claim_id>/status')
def update_claim_status(claim_id):
    """Смена статуса рекламации.

    Body:
        status (req): open|in_review|resolved|rejected
        resolution: текст решения
        resolved_date: при переходе в resolved/rejected (default today)
    """
    c = WarrantyClaim.query.get_or_404(claim_id)
    data = request.get_json(silent=True) or {}
    new_status = data.get('status')
    if new_status not in VALID_CLAIM_STATUSES:
        return jsonify({'error': f'status must be one of {sorted(VALID_CLAIM_STATUSES)}'}), 400

    c.status = new_status
    if 'resolution' in data:
        c.resolution = data['resolution']
    if new_status in ('resolved', 'rejected'):
        c.resolved_date = _parse_date(data.get('resolved_date')) or date.today()
    elif new_status in ('open', 'in_review'):
        # Сброс resolved_date при возврате в работу
        c.resolved_date = None

    db.session.commit()
    return jsonify(c.to_dict())


@bp.put('/api/claims/<int:claim_id>')
def update_claim(claim_id):
    c = WarrantyClaim.query.get_or_404(claim_id)
    data = request.get_json(silent=True) or {}
    for f in ('description', 'resolution', 'customer_name'):
        if f in data:
            setattr(c, f, data[f])
    if 'claim_type' in data:
        if data['claim_type'] not in VALID_CLAIM_TYPES:
            return jsonify({'error': 'invalid claim_type'}), 400
        c.claim_type = data['claim_type']
    if 'quantity' in data:
        c.quantity = int(data['quantity'])
    if 'claim_date' in data:
        c.claim_date = _parse_date(data['claim_date']) or c.claim_date
    db.session.commit()
    return jsonify(c.to_dict())


@bp.get('/api/claims/summary')
def claims_summary():
    """KPI для дашборда Module 6."""
    today = date.today()
    total = WarrantyClaim.query.count()

    by_status = (db.session.query(WarrantyClaim.status, func.count(WarrantyClaim.id))
                 .group_by(WarrantyClaim.status).all())
    status_map = {s: int(c) for s, c in by_status}

    by_type = (db.session.query(WarrantyClaim.claim_type, func.count(WarrantyClaim.id))
               .group_by(WarrantyClaim.claim_type).all())
    type_map = {t: int(c) for t, c in by_type}

    # Среднее время разрешения
    resolved = WarrantyClaim.query.filter(
        WarrantyClaim.status.in_(['resolved', 'rejected']),
        WarrantyClaim.resolved_date.isnot(None),
    ).all()
    avg_resolution_days = None
    if resolved:
        total_days = sum((c.resolved_date - c.claim_date).days for c in resolved)
        avg_resolution_days = round(total_days / len(resolved), 1)

    # Возвраты
    returns_count = WarrantyReturn.query.count()
    refund_total = db.session.query(func.coalesce(func.sum(WarrantyReturn.refund_amount_kzt), 0)).scalar() or 0

    # Открытые > 14 дней (overdue)
    cutoff = today - timedelta(days=14)
    overdue_open = WarrantyClaim.query.filter(
        WarrantyClaim.status.in_(['open', 'in_review']),
        WarrantyClaim.claim_date <= cutoff,
    ).count()

    # Процент возвратов от общего числа продаж (грубо: returns_qty / sales_qty)
    total_sales_qty = db.session.query(func.coalesce(func.sum(SaleItem.quantity), 0)).scalar() or 0
    total_claim_qty = db.session.query(func.coalesce(func.sum(WarrantyClaim.quantity), 0)).scalar() or 0
    return_rate_percent = (
        round(total_claim_qty / total_sales_qty * 100, 2) if total_sales_qty > 0 else 0
    )

    return jsonify({
        'total_claims': total,
        'by_status': {
            'open': status_map.get('open', 0),
            'in_review': status_map.get('in_review', 0),
            'resolved': status_map.get('resolved', 0),
            'rejected': status_map.get('rejected', 0),
        },
        'by_type': {
            'defect': type_map.get('defect', 0),
            'damage': type_map.get('damage', 0),
            'wrong_item': type_map.get('wrong_item', 0),
            'other': type_map.get('other', 0),
        },
        'avg_resolution_days': avg_resolution_days,
        'returns_count': returns_count,
        'refund_total_kzt': float(refund_total),
        'overdue_open_count': overdue_open,
        'return_rate_percent': return_rate_percent,
    })


# ---------- RETURNS ----------

@bp.get('/api/returns/')
def list_returns():
    """История возвратов.

    Query: claim_id, status, refund_method, date_from, date_to, limit
    """
    q = WarrantyReturn.query
    claim_id = request.args.get('claim_id', type=int)
    if claim_id:
        q = q.filter(WarrantyReturn.claim_id == claim_id)
    status = request.args.get('status')
    if status:
        q = q.filter(WarrantyReturn.status == status)
    method = request.args.get('refund_method')
    if method:
        q = q.filter(WarrantyReturn.refund_method == method)
    date_from = request.args.get('date_from')
    if date_from:
        q = q.filter(WarrantyReturn.return_date >= date_from)
    date_to = request.args.get('date_to')
    if date_to:
        q = q.filter(WarrantyReturn.return_date <= date_to)
    limit = int(request.args.get('limit', 100))
    items = q.order_by(WarrantyReturn.return_date.desc(), WarrantyReturn.id.desc()).limit(limit).all()
    return jsonify([r.to_dict() for r in items])


@bp.post('/api/returns/')
def create_return():
    data = request.get_json(silent=True) or {}
    if not data.get('claim_id'):
        return jsonify({'error': 'claim_id required'}), 400
    claim = WarrantyClaim.query.get_or_404(int(data['claim_id']))

    method = data.get('refund_method', 'cash')
    if method not in VALID_REFUND_METHODS:
        return jsonify({'error': f'refund_method must be one of {sorted(VALID_REFUND_METHODS)}'}), 400

    status = data.get('status', 'pending')
    if status not in VALID_RETURN_STATUSES:
        return jsonify({'error': f'status must be one of {sorted(VALID_RETURN_STATUSES)}'}), 400

    r = WarrantyReturn(
        claim_id=claim.id,
        quantity=int(data.get('quantity', 1)),
        reason=data.get('reason'),
        refund_amount_kzt=float(data.get('refund_amount_kzt', 0)),
        refund_method=method,
        return_date=_parse_date(data.get('return_date')) or date.today(),
        status=status,
        note=data.get('note'),
    )
    db.session.add(r)
    db.session.commit()
    return jsonify(r.to_dict()), 201


@bp.put('/api/returns/<int:return_id>')
def update_return(return_id):
    r = WarrantyReturn.query.get_or_404(return_id)
    data = request.get_json(silent=True) or {}
    for f in ('reason', 'note'):
        if f in data:
            setattr(r, f, data[f])
    if 'quantity' in data:
        r.quantity = int(data['quantity'])
    if 'refund_amount_kzt' in data:
        r.refund_amount_kzt = float(data['refund_amount_kzt'])
    if 'refund_method' in data:
        if data['refund_method'] not in VALID_REFUND_METHODS:
            return jsonify({'error': 'invalid refund_method'}), 400
        r.refund_method = data['refund_method']
    if 'status' in data:
        if data['status'] not in VALID_RETURN_STATUSES:
            return jsonify({'error': 'invalid status'}), 400
        r.status = data['status']
    if 'return_date' in data:
        r.return_date = _parse_date(data['return_date']) or r.return_date
    db.session.commit()
    return jsonify(r.to_dict())


# ---------- ANALYTICS ----------

@bp.get('/api/warranty/by-product')
def by_product():
    """Статистика рекламаций и возвратов по товарам.

    Возвращает per product:
        - claims_count, defect_rate (% дефектов от продаж), avg_resolution_days
        - returns_count, refund_total_kzt
    """
    products = Product.query.order_by(Product.id).all()
    result = []

    for p in products:
        claims = WarrantyClaim.query.filter_by(product_id=p.id).all()
        claims_count = len(claims)
        claim_qty = sum(c.quantity for c in claims)

        sold_qty = db.session.query(
            func.coalesce(func.sum(SaleItem.quantity), 0)
        ).filter(SaleItem.product_id == p.id).scalar() or 0

        defect_rate = round(claim_qty / sold_qty * 100, 2) if sold_qty > 0 else 0

        resolved = [c for c in claims if c.resolved_date and c.claim_date]
        avg_days = None
        if resolved:
            avg_days = round(
                sum((c.resolved_date - c.claim_date).days for c in resolved) / len(resolved), 1
            )

        # Возвраты по этому товару
        returns_for_product = (db.session.query(WarrantyReturn)
                               .join(WarrantyClaim, WarrantyClaim.id == WarrantyReturn.claim_id)
                               .filter(WarrantyClaim.product_id == p.id).all())
        returns_count = len(returns_for_product)
        refund_total = sum(r.refund_amount_kzt for r in returns_for_product)

        result.append({
            'product_id': p.id,
            'product_name': p.name,
            'category': p.category,
            'claims_count': claims_count,
            'claim_qty': claim_qty,
            'sold_qty': int(sold_qty),
            'defect_rate_percent': defect_rate,
            'avg_resolution_days': avg_days,
            'returns_count': returns_count,
            'refund_total_kzt': round(refund_total, 2),
            'open_claims': sum(1 for c in claims if c.status in ('open', 'in_review')),
        })

    # Сортировка по defect_rate desc
    result.sort(key=lambda x: (-x['defect_rate_percent'], -x['claims_count']))
    return jsonify(result)


@bp.get('/api/warranty/timeline')
def timeline():
    """Хронология гарантийных событий: открытие, разрешение, возврат.

    Объединяет claims + returns в единую timeline.
    Query: limit (default 50)
    """
    limit = min(int(request.args.get('limit', 50)), 500)
    events = []

    claims = WarrantyClaim.query.order_by(WarrantyClaim.claim_date.desc()).limit(limit).all()
    for c in claims:
        events.append({
            'event_type': 'claim_opened',
            'date': c.claim_date.isoformat() if c.claim_date else None,
            'claim_id': c.id,
            'claim_number': c.claim_number,
            'product_name': c.product.name if c.product else None,
            'customer_name': c.customer_name,
            'description': c.description or c.claim_type,
            'status': c.status,
        })
        if c.resolved_date:
            events.append({
                'event_type': f'claim_{c.status}',
                'date': c.resolved_date.isoformat(),
                'claim_id': c.id,
                'claim_number': c.claim_number,
                'product_name': c.product.name if c.product else None,
                'customer_name': c.customer_name,
                'description': c.resolution or '',
                'status': c.status,
            })

    returns = WarrantyReturn.query.order_by(WarrantyReturn.return_date.desc()).limit(limit).all()
    for r in returns:
        events.append({
            'event_type': 'return',
            'date': r.return_date.isoformat() if r.return_date else None,
            'claim_id': r.claim_id,
            'claim_number': r.claim.claim_number if r.claim else None,
            'product_name': r.claim.product.name if (r.claim and r.claim.product) else None,
            'customer_name': r.claim.customer_name if r.claim else None,
            'description': f"{r.refund_method}: ₸{r.refund_amount_kzt:,.0f}",
            'status': r.status,
            'amount_kzt': r.refund_amount_kzt,
        })

    # Сортировка по дате (новые сверху)
    events.sort(key=lambda e: e['date'] or '', reverse=True)
    return jsonify(events[:limit])
