"""Module 3: Invoices — список / детали / смена статуса.

Создание счёта = создание Invoice + связанных SaleItem (линий).
"""
from datetime import date, timedelta

from flask import Blueprint, jsonify, request

from app.models import Customer, Invoice, Payment, Product, SaleItem, db

bp = Blueprint('invoices', __name__, url_prefix='/api/invoices')

VALID_STATUSES = {'draft', 'issued', 'paid', 'partially_paid', 'overdue', 'cancelled'}


def _recalc_invoice(inv: Invoice) -> None:
    """Пересчёт total_kzt + paid_kzt + статус на основе линий и платежей."""
    inv.total_kzt = sum(i.total_revenue_kzt or 0 for i in inv.items)
    inv.paid_kzt = sum(p.amount_kzt or 0 for p in inv.payments)
    if inv.status == 'cancelled':
        return
    if inv.paid_kzt >= inv.total_kzt and inv.total_kzt > 0:
        inv.status = 'paid'
    elif inv.paid_kzt > 0:
        inv.status = 'partially_paid'
    elif inv.due_date and inv.due_date < date.today():
        inv.status = 'overdue'
    elif inv.status in ('paid', 'partially_paid'):
        inv.status = 'issued'


@bp.get('/')
def list_invoices():
    """Список счетов с фильтрами.

    Query: status, customer_id, date_from, date_to, search
    """
    q = Invoice.query

    status = request.args.get('status')
    customer_id = request.args.get('customer_id', type=int)
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    search = request.args.get('search', '').strip().lower()

    if status:
        q = q.filter(Invoice.status == status)
    if customer_id:
        q = q.filter(Invoice.customer_id == customer_id)
    if date_from:
        q = q.filter(Invoice.issue_date >= date_from)
    if date_to:
        q = q.filter(Invoice.issue_date <= date_to)

    invoices = q.order_by(Invoice.issue_date.desc(), Invoice.id.desc()).all()
    items = [inv.to_dict() for inv in invoices]
    if search:
        items = [d for d in items
                 if search in (d['invoice_number'] or '').lower()
                 or search in (d['customer_name'] or '').lower()]
    return jsonify(items)


@bp.get('/<int:invoice_id>')
def get_invoice(invoice_id):
    inv = Invoice.query.get_or_404(invoice_id)
    return jsonify(inv.to_dict(with_items=True))


@bp.get('/<int:invoice_id>/items')
def get_invoice_items(invoice_id):
    inv = Invoice.query.get_or_404(invoice_id)
    return jsonify([i.to_dict() for i in inv.items])


@bp.post('/')
def create_invoice():
    """Создать счёт-фактуру с линиями.

    Body:
        customer_id (req), invoice_number (опц — auto если нет),
        issue_date, due_date, notes,
        items: [{product_id, quantity, unit_price_kzt, unit_cost_kzt? }, ...]
    """
    data = request.get_json(silent=True) or {}
    if not data.get('customer_id') or not data.get('items'):
        return jsonify({'error': 'customer_id and items required'}), 400

    customer = Customer.query.get_or_404(int(data['customer_id']))

    # Auto-generate invoice number
    invoice_number = data.get('invoice_number')
    if not invoice_number:
        last = Invoice.query.order_by(Invoice.id.desc()).first()
        next_seq = (last.id + 1) if last else 1
        invoice_number = f'СФ-{date.today().year}-{100 + next_seq:03d}'

    # Validate uniqueness
    if Invoice.query.filter_by(invoice_number=invoice_number).first():
        return jsonify({'error': 'invoice_number already exists'}), 409

    issue_date = data.get('issue_date') or date.today()
    if isinstance(issue_date, str):
        issue_date = date.fromisoformat(issue_date)
    due_date = data.get('due_date')
    if not due_date:
        due_date = issue_date + timedelta(days=30)
    elif isinstance(due_date, str):
        due_date = date.fromisoformat(due_date)

    inv = Invoice(
        invoice_number=invoice_number,
        customer_id=customer.id,
        issue_date=issue_date,
        due_date=due_date,
        status=data.get('status', 'issued'),
        notes=data.get('notes'),
    )
    db.session.add(inv)
    db.session.flush()

    total = 0.0
    for line in data['items']:
        product = Product.query.get_or_404(int(line['product_id']))
        qty = int(line['quantity'])
        unit_price = float(line['unit_price_kzt'])
        unit_cost = float(line.get('unit_cost_kzt', 0))

        revenue = qty * unit_price
        cost = qty * unit_cost
        vat_out = revenue * (product.vat_sale_percent or 0.16)
        vat_in = cost * (product.vat_import_percent or 0.12)
        vat_pay = max(0, vat_out - vat_in)
        gm = revenue - cost
        gm_pct = (gm / revenue * 100) if revenue > 0 else 0
        kpn = max(0, gm - vat_pay) * (product.kpn_percent or 0.10)
        net = gm - vat_pay - kpn

        db.session.add(SaleItem(
            invoice_id=inv.id,
            customer_id=customer.id,
            invoice_number=inv.invoice_number,
            product_id=product.id,
            customer_name=customer.name,
            quantity=qty,
            unit_price_kzt=unit_price,
            unit_cost_kzt=unit_cost,
            total_revenue_kzt=revenue,
            total_cost_kzt=cost,
            vat_output_kzt=vat_out,
            vat_input_kzt=vat_in,
            vat_to_pay_kzt=vat_pay,
            gross_margin_kzt=gm,
            gross_margin_percent=gm_pct,
            kpn_tax_kzt=kpn,
            net_profit_kzt=net,
            sale_date=issue_date,
            due_date=due_date,
            payment_status='pending',
            paid_kzt=0,
            status='sold',
        ))
        total += revenue

    inv.total_kzt = total
    db.session.commit()
    return jsonify(inv.to_dict(with_items=True)), 201


@bp.put('/<int:invoice_id>/status')
def update_status(invoice_id):
    inv = Invoice.query.get_or_404(invoice_id)
    data = request.get_json(silent=True) or {}
    new_status = data.get('status')
    if new_status not in VALID_STATUSES:
        return jsonify({'error': f'status must be one of {sorted(VALID_STATUSES)}'}), 400
    inv.status = new_status
    db.session.commit()
    return jsonify(inv.to_dict())


@bp.put('/<int:invoice_id>')
def update_invoice(invoice_id):
    inv = Invoice.query.get_or_404(invoice_id)
    data = request.get_json(silent=True) or {}
    for f in ('notes',):
        if f in data:
            setattr(inv, f, data[f])
    if 'due_date' in data:
        inv.due_date = date.fromisoformat(data['due_date']) if data['due_date'] else None
    if 'status' in data and data['status'] in VALID_STATUSES:
        inv.status = data['status']
    db.session.commit()
    return jsonify(inv.to_dict())


@bp.delete('/<int:invoice_id>')
def cancel_invoice(invoice_id):
    """Отмена счёта. Платежи не удаляются, но статус становится cancelled."""
    inv = Invoice.query.get_or_404(invoice_id)
    inv.status = 'cancelled'
    db.session.commit()
    return jsonify(inv.to_dict())
