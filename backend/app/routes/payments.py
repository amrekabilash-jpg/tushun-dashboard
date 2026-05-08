"""Module 3: Платежи + дебиторка (AR aging)."""
from datetime import date

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.models import Customer, Invoice, Payment, db

bp = Blueprint('payments', __name__, url_prefix='/api')

VALID_METHODS = {'bank', 'cash', 'kaspi', 'card', 'other'}


def _recalc_invoice_status(inv: Invoice) -> None:
    inv.paid_kzt = sum(p.amount_kzt or 0 for p in inv.payments)
    if inv.status == 'cancelled':
        return
    if inv.paid_kzt >= inv.total_kzt and inv.total_kzt > 0:
        inv.status = 'paid'
    elif inv.paid_kzt > 0:
        inv.status = 'partially_paid'
    elif inv.due_date and inv.due_date < date.today():
        inv.status = 'overdue'


# ---------- PAYMENTS ----------

@bp.get('/payments/')
def list_payments():
    """История платежей.

    Query: invoice_id, customer_id, method, date_from, date_to, limit (default 100)
    """
    q = Payment.query

    invoice_id = request.args.get('invoice_id', type=int)
    customer_id = request.args.get('customer_id', type=int)
    method = request.args.get('method')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    limit = int(request.args.get('limit', 100))

    if invoice_id:
        q = q.filter(Payment.invoice_id == invoice_id)
    if method:
        q = q.filter(Payment.method == method)
    if customer_id:
        q = q.join(Invoice, Invoice.id == Payment.invoice_id).filter(Invoice.customer_id == customer_id)
    if date_from:
        q = q.filter(Payment.payment_date >= date_from)
    if date_to:
        q = q.filter(Payment.payment_date <= date_to)

    items = q.order_by(Payment.payment_date.desc(), Payment.id.desc()).limit(limit).all()
    return jsonify([p.to_dict() for p in items])


@bp.post('/payments/')
def create_payment():
    """Зарегистрировать платёж + автоматически пересчитать статус invoice."""
    data = request.get_json(silent=True) or {}
    required = ('invoice_id', 'amount_kzt')
    if not all(data.get(k) is not None for k in required):
        return jsonify({'error': 'invoice_id and amount_kzt required'}), 400

    inv = Invoice.query.get_or_404(int(data['invoice_id']))
    amount = float(data['amount_kzt'])
    if amount <= 0:
        return jsonify({'error': 'amount_kzt must be > 0'}), 400

    method = data.get('method', 'bank')
    if method not in VALID_METHODS:
        return jsonify({'error': f'method must be one of {sorted(VALID_METHODS)}'}), 400

    pay_date = data.get('payment_date')
    if isinstance(pay_date, str):
        pay_date = date.fromisoformat(pay_date)

    p = Payment(
        invoice_id=inv.id,
        amount_kzt=amount,
        payment_date=pay_date or date.today(),
        method=method,
        reference=data.get('reference'),
        notes=data.get('notes'),
    )
    db.session.add(p)
    db.session.flush()

    _recalc_invoice_status(inv)
    db.session.commit()

    return jsonify({
        'payment': p.to_dict(),
        'invoice': inv.to_dict(),
    }), 201


@bp.delete('/payments/<int:payment_id>')
def delete_payment(payment_id):
    p = Payment.query.get_or_404(payment_id)
    inv = p.invoice
    db.session.delete(p)
    db.session.flush()
    _recalc_invoice_status(inv)
    db.session.commit()
    return jsonify({'deleted': True, 'invoice': inv.to_dict()})


# ---------- AR (Accounts Receivable) ----------

def _aging_bucket(days_overdue: int) -> str:
    if days_overdue <= 0:
        return 'current'
    if days_overdue <= 30:
        return '0-30'
    if days_overdue <= 60:
        return '31-60'
    if days_overdue <= 90:
        return '61-90'
    return '90+'


@bp.get('/ar/aging')
def ar_aging():
    """Дебиторка по срокам.

    Возвращает invoices с непогашенным балансом, сгруппированные по
    срокам просрочки + сводка.
    """
    today = date.today()
    invoices = (Invoice.query
                .filter(Invoice.status.in_(['issued', 'partially_paid', 'overdue']))
                .all())

    rows = []
    buckets = {'current': 0.0, '0-30': 0.0, '31-60': 0.0, '61-90': 0.0, '90+': 0.0}
    bucket_counts = {k: 0 for k in buckets}

    for inv in invoices:
        outstanding = (inv.total_kzt or 0) - (inv.paid_kzt or 0)
        if outstanding <= 0:
            continue
        days_overdue = (today - inv.due_date).days if inv.due_date else 0
        bucket = _aging_bucket(days_overdue)
        buckets[bucket] += outstanding
        bucket_counts[bucket] += 1

        rows.append({
            'invoice_id': inv.id,
            'invoice_number': inv.invoice_number,
            'customer_id': inv.customer_id,
            'customer_name': inv.customer.name if inv.customer else None,
            'issue_date': inv.issue_date.isoformat() if inv.issue_date else None,
            'due_date': inv.due_date.isoformat() if inv.due_date else None,
            'days_overdue': days_overdue,
            'days_until_due': -days_overdue if days_overdue < 0 else 0,
            'total_kzt': inv.total_kzt or 0,
            'paid_kzt': inv.paid_kzt or 0,
            'outstanding_kzt': outstanding,
            'bucket': bucket,
            'status': inv.status,
        })

    rows.sort(key=lambda r: r['days_overdue'], reverse=True)

    aging_chart = [
        {'bucket': b, 'amount_kzt': buckets[b], 'count': bucket_counts[b]}
        for b in ('current', '0-30', '31-60', '61-90', '90+')
    ]

    return jsonify({
        'rows': rows,
        'aging': aging_chart,
        'total_outstanding_kzt': sum(buckets.values()),
        'total_overdue_kzt': sum(buckets[k] for k in ('0-30', '31-60', '61-90', '90+')),
        'overdue_count': sum(bucket_counts[k] for k in ('0-30', '31-60', '61-90', '90+')),
    })


@bp.get('/ar/summary')
def ar_summary():
    """Сводка дебиторки по клиентам — кто и сколько должен."""
    today = date.today()

    # Outstanding по клиентам
    rows = (db.session.query(
                Customer.id, Customer.name, Customer.status,
                func.count(Invoice.id).label('invoice_count'),
                func.coalesce(func.sum(Invoice.total_kzt), 0).label('total_kzt'),
                func.coalesce(func.sum(Invoice.paid_kzt), 0).label('paid_kzt'),
            )
            .select_from(Customer)
            .outerjoin(Invoice, (Invoice.customer_id == Customer.id) &
                                (Invoice.status.in_(['issued', 'partially_paid', 'overdue'])))
            .group_by(Customer.id)
            .all())

    customer_rows = []
    for r in rows:
        outstanding = float(r.total_kzt) - float(r.paid_kzt)
        if outstanding <= 0 and r.invoice_count == 0:
            continue
        # Овердью per customer
        overdue_invs = (Invoice.query
                        .filter(Invoice.customer_id == r.id,
                                Invoice.status.in_(['overdue', 'partially_paid', 'issued']),
                                Invoice.due_date < today)
                        .all())
        overdue_amt = sum((i.total_kzt or 0) - (i.paid_kzt or 0)
                          for i in overdue_invs
                          if (i.total_kzt or 0) - (i.paid_kzt or 0) > 0)
        customer_rows.append({
            'customer_id': r.id,
            'customer_name': r.name,
            'customer_status': r.status,
            'open_invoices': int(r.invoice_count),
            'total_kzt': float(r.total_kzt),
            'paid_kzt': float(r.paid_kzt),
            'outstanding_kzt': outstanding,
            'overdue_kzt': overdue_amt,
        })

    customer_rows.sort(key=lambda x: x['outstanding_kzt'], reverse=True)

    return jsonify({
        'customers': customer_rows,
        'total_outstanding_kzt': sum(c['outstanding_kzt'] for c in customer_rows),
        'total_overdue_kzt': sum(c['overdue_kzt'] for c in customer_rows),
    })
