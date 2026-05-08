"""Module 5: финансовые инструменты — курсы валют, премии, комиссии, конвертор."""
from datetime import date, timedelta

from flask import Blueprint, jsonify, request

from app.models import Commission, ExchangeRate, Premium, db

# Один blueprint с разными префиксами для каждой группы
bp = Blueprint('finance_tools', __name__)


# ---------- EXCHANGE RATES ----------

VALID_CURRENCIES = {'USD', 'EUR', 'CNY', 'RUB', 'KZT'}
VALID_RATE_SOURCES = {'manual', 'nbk', 'xe', 'api'}


@bp.get('/api/rates/')
def list_rates():
    """Текущие курсы (последний по дате для каждой пары).

    Query: target (default KZT), source
    """
    target = (request.args.get('target') or 'KZT').upper()
    source = request.args.get('source')

    q = ExchangeRate.query.filter(ExchangeRate.target_currency == target)
    if source:
        q = q.filter(ExchangeRate.source == source)

    # Группируем по base_currency и берём последний rate_date
    rates = q.order_by(ExchangeRate.base_currency,
                       ExchangeRate.rate_date.desc(),
                       ExchangeRate.id.desc()).all()
    seen = set()
    latest = []
    for r in rates:
        if r.base_currency not in seen:
            seen.add(r.base_currency)
            latest.append(r)

    # Добавим тренд: разницу с курсом 7 дней назад
    week_ago = date.today() - timedelta(days=7)
    result = []
    for r in latest:
        prev = (ExchangeRate.query
                .filter(ExchangeRate.base_currency == r.base_currency,
                        ExchangeRate.target_currency == r.target_currency,
                        ExchangeRate.rate_date <= week_ago)
                .order_by(ExchangeRate.rate_date.desc())
                .first())
        d = r.to_dict()
        if prev:
            diff = r.rate - prev.rate
            d['week_change'] = round(diff, 4)
            d['week_change_percent'] = round(diff / prev.rate * 100, 2) if prev.rate else 0
        else:
            d['week_change'] = None
            d['week_change_percent'] = None
        result.append(d)
    return jsonify(result)


@bp.get('/api/rates/history')
def rate_history():
    """История курсов с фильтрами.

    Query: base, target (default KZT), date_from, date_to, limit (default 100)
    """
    base = request.args.get('base')
    target = (request.args.get('target') or 'KZT').upper()
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    limit = min(int(request.args.get('limit', 100)), 500)

    q = ExchangeRate.query.filter(ExchangeRate.target_currency == target)
    if base:
        q = q.filter(ExchangeRate.base_currency == base.upper())
    if date_from:
        q = q.filter(ExchangeRate.rate_date >= date_from)
    if date_to:
        q = q.filter(ExchangeRate.rate_date <= date_to)
    items = q.order_by(ExchangeRate.rate_date.desc(), ExchangeRate.id.desc()).limit(limit).all()
    return jsonify([r.to_dict() for r in items])


@bp.post('/api/rates/')
def create_rate():
    """Добавить курс."""
    data = request.get_json(silent=True) or {}
    required = ('base_currency', 'target_currency', 'rate')
    if not all(data.get(k) for k in required):
        return jsonify({'error': f'fields required: {", ".join(required)}'}), 400

    base = data['base_currency'].upper()
    target = data['target_currency'].upper()
    if base not in VALID_CURRENCIES or target not in VALID_CURRENCIES:
        return jsonify({'error': f'currency must be one of {sorted(VALID_CURRENCIES)}'}), 400
    if base == target:
        return jsonify({'error': 'base and target must differ'}), 400

    rate = float(data['rate'])
    if rate <= 0:
        return jsonify({'error': 'rate must be > 0'}), 400

    source = data.get('source', 'manual')
    if source not in VALID_RATE_SOURCES:
        return jsonify({'error': f'source must be one of {sorted(VALID_RATE_SOURCES)}'}), 400

    rate_date = data.get('rate_date')
    if isinstance(rate_date, str):
        rate_date = date.fromisoformat(rate_date)
    if not rate_date:
        rate_date = date.today()

    # Уникальность пара+дата
    existing = ExchangeRate.query.filter_by(
        base_currency=base, target_currency=target, rate_date=rate_date,
    ).first()
    if existing:
        existing.rate = rate
        existing.source = source
        existing.note = data.get('note')
        db.session.commit()
        return jsonify(existing.to_dict()), 200

    r = ExchangeRate(
        base_currency=base, target_currency=target, rate=rate,
        rate_date=rate_date, source=source, note=data.get('note'),
    )
    db.session.add(r)
    db.session.commit()
    return jsonify(r.to_dict()), 201


@bp.delete('/api/rates/<int:rate_id>')
def delete_rate(rate_id):
    r = ExchangeRate.query.get_or_404(rate_id)
    db.session.delete(r)
    db.session.commit()
    return jsonify({'deleted': True, 'id': rate_id})


# ---------- CONVERTER ----------

@bp.get('/api/convert')
def convert():
    """Конвертация суммы между валютами.

    Использует последний курс для пары (from, to) или цепочку через KZT.

    Query: amount (req), from (req), to (req), date (опц — на конкретную дату)
    """
    try:
        amount = float(request.args.get('amount', 0))
    except ValueError:
        return jsonify({'error': 'amount must be a number'}), 400
    src = (request.args.get('from') or '').upper()
    dst = (request.args.get('to') or '').upper()
    if not src or not dst or src not in VALID_CURRENCIES or dst not in VALID_CURRENCIES:
        return jsonify({'error': f'from/to must be one of {sorted(VALID_CURRENCIES)}'}), 400

    target_date = request.args.get('date')
    if isinstance(target_date, str):
        target_date = date.fromisoformat(target_date)

    if src == dst:
        return jsonify({
            'amount': amount, 'from': src, 'to': dst,
            'rate': 1.0, 'result': amount,
            'path': [src],
        })

    def latest_rate(b, t):
        q = ExchangeRate.query.filter_by(base_currency=b, target_currency=t)
        if target_date:
            q = q.filter(ExchangeRate.rate_date <= target_date)
        return q.order_by(ExchangeRate.rate_date.desc(), ExchangeRate.id.desc()).first()

    # Прямой курс
    direct = latest_rate(src, dst)
    if direct:
        result = amount * direct.rate
        return jsonify({
            'amount': amount, 'from': src, 'to': dst,
            'rate': direct.rate, 'result': round(result, 2),
            'rate_date': direct.rate_date.isoformat(),
            'path': [src, dst],
        })

    # Обратный курс
    reverse = latest_rate(dst, src)
    if reverse and reverse.rate > 0:
        rate = 1 / reverse.rate
        result = amount * rate
        return jsonify({
            'amount': amount, 'from': src, 'to': dst,
            'rate': round(rate, 6), 'result': round(result, 2),
            'rate_date': reverse.rate_date.isoformat(),
            'path': [src, dst],
            'inverted_from': {'base': dst, 'target': src, 'rate': reverse.rate},
        })

    # Цепочка через KZT (src → KZT → dst)
    leg1 = latest_rate(src, 'KZT')
    leg2 = latest_rate(dst, 'KZT')  # invert leg2: dst→KZT, чтобы получить KZT→dst
    if leg1 and leg2 and leg2.rate > 0:
        rate = leg1.rate / leg2.rate
        result = amount * rate
        return jsonify({
            'amount': amount, 'from': src, 'to': dst,
            'rate': round(rate, 6), 'result': round(result, 2),
            'path': [src, 'KZT', dst],
            'leg_1': {'pair': f'{src}/KZT', 'rate': leg1.rate, 'date': leg1.rate_date.isoformat()},
            'leg_2': {'pair': f'KZT/{dst}', 'rate': round(1 / leg2.rate, 6), 'date': leg2.rate_date.isoformat()},
        })

    return jsonify({'error': f'no rate available for {src} → {dst}'}), 404


# ---------- PREMIUMS ----------

VALID_PREMIUM_TYPES = {'fixed', 'percent'}


@bp.get('/api/premiums/')
def list_premiums():
    """Список премий.

    Query: active (true|false), period, target_role
    """
    q = Premium.query
    active = request.args.get('active')
    if active in ('true', 'false'):
        q = q.filter(Premium.is_active == (active == 'true'))
    period = request.args.get('period')
    if period:
        q = q.filter(Premium.period == period)
    role = request.args.get('target_role')
    if role:
        q = q.filter(Premium.target_role == role)
    rows = q.order_by(Premium.is_active.desc(), Premium.id.asc()).all()
    return jsonify([p.to_dict() for p in rows])


@bp.post('/api/premiums/')
def create_premium():
    data = request.get_json(silent=True) or {}
    if not data.get('name') or 'amount' not in data:
        return jsonify({'error': 'name and amount required'}), 400
    ptype = data.get('premium_type', 'fixed')
    if ptype not in VALID_PREMIUM_TYPES:
        return jsonify({'error': f'premium_type must be one of {sorted(VALID_PREMIUM_TYPES)}'}), 400

    p = Premium(
        name=data['name'].strip(),
        premium_type=ptype,
        amount=float(data['amount']),
        description=data.get('description'),
        period=data.get('period'),
        target_role=data.get('target_role'),
        is_active=bool(data.get('is_active', True)),
    )
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201


@bp.put('/api/premiums/<int:premium_id>')
def update_premium(premium_id):
    p = Premium.query.get_or_404(premium_id)
    data = request.get_json(silent=True) or {}
    for f in ('name', 'description', 'period', 'target_role'):
        if f in data:
            setattr(p, f, data[f])
    if 'premium_type' in data:
        if data['premium_type'] not in VALID_PREMIUM_TYPES:
            return jsonify({'error': 'invalid premium_type'}), 400
        p.premium_type = data['premium_type']
    if 'amount' in data:
        p.amount = float(data['amount'])
    if 'is_active' in data:
        p.is_active = bool(data['is_active'])
    db.session.commit()
    return jsonify(p.to_dict())


@bp.delete('/api/premiums/<int:premium_id>')
def delete_premium(premium_id):
    p = Premium.query.get_or_404(premium_id)
    db.session.delete(p)
    db.session.commit()
    return jsonify({'deleted': True, 'id': premium_id})


# ---------- COMMISSIONS ----------

VALID_COMMISSION_TYPES = {'sales', 'service', 'returns', 'logistics'}


@bp.get('/api/commissions/')
def list_commissions():
    q = Commission.query
    active = request.args.get('active')
    if active in ('true', 'false'):
        q = q.filter(Commission.is_active == (active == 'true'))
    ctype = request.args.get('type')
    if ctype:
        q = q.filter(Commission.commission_type == ctype)
    rows = q.order_by(Commission.is_active.desc(), Commission.id.asc()).all()
    return jsonify([c.to_dict() for c in rows])


@bp.post('/api/commissions/')
def create_commission():
    data = request.get_json(silent=True) or {}
    if not data.get('name') or 'percent' not in data:
        return jsonify({'error': 'name and percent required'}), 400
    ctype = data.get('commission_type', 'sales')
    if ctype not in VALID_COMMISSION_TYPES:
        return jsonify({'error': f'commission_type must be one of {sorted(VALID_COMMISSION_TYPES)}'}), 400

    c = Commission(
        name=data['name'].strip(),
        commission_type=ctype,
        percent=float(data['percent']),
        min_amount_kzt=float(data.get('min_amount_kzt', 0)),
        max_amount_kzt=float(data['max_amount_kzt']) if data.get('max_amount_kzt') else None,
        description=data.get('description'),
        is_active=bool(data.get('is_active', True)),
    )
    db.session.add(c)
    db.session.commit()
    return jsonify(c.to_dict()), 201


@bp.put('/api/commissions/<int:commission_id>')
def update_commission(commission_id):
    c = Commission.query.get_or_404(commission_id)
    data = request.get_json(silent=True) or {}
    for f in ('name', 'description'):
        if f in data:
            setattr(c, f, data[f])
    if 'commission_type' in data:
        if data['commission_type'] not in VALID_COMMISSION_TYPES:
            return jsonify({'error': 'invalid commission_type'}), 400
        c.commission_type = data['commission_type']
    if 'percent' in data:
        c.percent = float(data['percent'])
    if 'min_amount_kzt' in data:
        c.min_amount_kzt = float(data['min_amount_kzt'])
    if 'max_amount_kzt' in data:
        c.max_amount_kzt = float(data['max_amount_kzt']) if data['max_amount_kzt'] else None
    if 'is_active' in data:
        c.is_active = bool(data['is_active'])
    db.session.commit()
    return jsonify(c.to_dict())


@bp.delete('/api/commissions/<int:commission_id>')
def delete_commission(commission_id):
    c = Commission.query.get_or_404(commission_id)
    db.session.delete(c)
    db.session.commit()
    return jsonify({'deleted': True, 'id': commission_id})
