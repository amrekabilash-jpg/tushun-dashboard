"""Дебиторская задолженность: непогашенные продажи + aging-анализ."""
from datetime import date

from flask import Blueprint, jsonify, request

from app.models import SaleItem, db

bp = Blueprint('receivables', __name__, url_prefix='/api/finance/receivables')


def _aging_bucket(due_date, today, status):
    """Возвращает бакет aging.

    На входе due_date (плановая дата), today, статус оплаты.
    Возвращает один из: 'current' / '0-30' / '31-60' / '61-90' / '90+'.
    'current' — срок ещё не наступил.
    """
    if status == 'paid' or due_date is None:
        return None
    delta = (today - due_date).days
    if delta < 0:
        return 'current'
    if delta <= 30:
        return '0-30'
    if delta <= 60:
        return '31-60'
    if delta <= 90:
        return '61-90'
    return '90+'


@bp.get('/')
def list_receivables():
    """Список всех непогашенных продаж с aging."""
    today = date.today()
    rows = (SaleItem.query
            .filter(SaleItem.payment_status.in_(['pending', 'overdue', 'partial']))
            .order_by(SaleItem.due_date.asc().nulls_last())
            .all())
    out = []
    for s in rows:
        outstanding = (s.total_revenue_kzt or 0) - (s.paid_kzt or 0)
        days_overdue = (today - s.due_date).days if s.due_date else 0
        out.append({
            'id': s.id,
            'invoice_number': s.invoice_number,
            'customer_name': s.customer_name,
            'product_name': s.product.name if s.product else None,
            'sale_date': s.sale_date.isoformat() if s.sale_date else None,
            'due_date': s.due_date.isoformat() if s.due_date else None,
            'days_overdue': days_overdue if days_overdue > 0 else 0,
            'days_until_due': -days_overdue if days_overdue < 0 else 0,
            'total_kzt': s.total_revenue_kzt,
            'paid_kzt': s.paid_kzt or 0,
            'outstanding_kzt': round(outstanding, 2),
            'payment_status': s.payment_status,
            'aging_bucket': _aging_bucket(s.due_date, today, s.payment_status),
        })
    return jsonify(out)


@bp.get('/summary')
def summary():
    """Aging summary + общие KPI."""
    today = date.today()
    rows = (SaleItem.query
            .filter(SaleItem.payment_status.in_(['pending', 'overdue', 'partial']))
            .all())

    buckets = {'current': 0, '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0}
    bucket_count = {k: 0 for k in buckets}
    total_outstanding = 0
    total_overdue = 0
    overdue_count = 0
    for s in rows:
        outstanding = (s.total_revenue_kzt or 0) - (s.paid_kzt or 0)
        bucket = _aging_bucket(s.due_date, today, s.payment_status)
        if bucket:
            buckets[bucket] += outstanding
            bucket_count[bucket] += 1
        total_outstanding += outstanding
        if s.payment_status == 'overdue':
            total_overdue += outstanding
            overdue_count += 1

    return jsonify({
        'total_outstanding_kzt': round(total_outstanding, 2),
        'total_overdue_kzt': round(total_overdue, 2),
        'overdue_count': overdue_count,
        'pending_count': sum(1 for s in rows if s.payment_status == 'pending'),
        'aging': [{
            'bucket': k,
            'amount_kzt': round(v, 2),
            'count': bucket_count[k],
        } for k, v in buckets.items()],
    })


@bp.post('/<int:sale_id>/pay')
def mark_paid(sale_id):
    """Регистрирует оплату (полную или частичную)."""
    sale = SaleItem.query.get_or_404(sale_id)
    data = request.get_json(silent=True) or {}
    amount = float(data.get('amount_kzt', sale.total_revenue_kzt - (sale.paid_kzt or 0)))
    if amount <= 0:
        return jsonify({'error': 'amount must be > 0'}), 400

    sale.paid_kzt = (sale.paid_kzt or 0) + amount
    if sale.paid_kzt >= sale.total_revenue_kzt - 0.01:
        sale.payment_status = 'paid'
        sale.paid_kzt = sale.total_revenue_kzt
    else:
        sale.payment_status = 'partial'
    db.session.commit()
    return jsonify({
        'id': sale.id,
        'payment_status': sale.payment_status,
        'paid_kzt': sale.paid_kzt,
        'outstanding_kzt': sale.total_revenue_kzt - sale.paid_kzt,
    })
