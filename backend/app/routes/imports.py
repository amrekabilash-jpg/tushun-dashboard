"""API для партий импорта.

Расчёт себестоимости использует tax-настройки из БД на момент создания партии
(сохраняем в строках batch_items, чтобы исторические партии не пересчитывались
после смены ставок)."""
from datetime import date

from flask import Blueprint, jsonify, request

from app.formulas.calculations import distribute_batch_costs
from app.models import AppSetting, ImportBatch, ImportBatchItem, Product, db

bp = Blueprint('imports', __name__, url_prefix='/api/imports')


def _get_default_rate() -> float:
    setting = AppSetting.query.get('exchange_rate_usd_kzt')
    return float(setting.value) if setting else 450.0


@bp.get('/')
def list_batches():
    rows = ImportBatch.query.order_by(ImportBatch.created_at.desc()).all()
    return jsonify([{
        'id': b.id,
        'batch_number': b.batch_number,
        'invoice_number': b.invoice_number,
        'supplier_name': b.supplier_name,
        'total_fob_usd': b.total_fob_usd,
        'total_cost_usd': b.total_cost_usd,
        'total_cost_kzt': b.total_cost_kzt,
        'exchange_rate': b.exchange_rate,
        'status': b.status,
        'import_date': b.import_date.isoformat() if b.import_date else None,
        'items_count': len(b.items),
    } for b in rows])


@bp.post('/')
def create_batch():
    data = request.get_json(silent=True) or {}
    items_in = data.get('items') or []
    if not data.get('batch_number'):
        return jsonify({'error': 'batch_number required'}), 400
    if not items_in:
        return jsonify({'error': 'items required'}), 400
    if ImportBatch.query.filter_by(batch_number=data['batch_number']).first():
        return jsonify({'error': 'batch_number_exists'}), 409

    rate = float(data.get('exchange_rate') or _get_default_rate())
    shipping = float(data.get('shipping_cost_usd', 0))
    extra_kzt = float(data.get('additional_costs_kzt', 0))

    enriched = []
    for it in items_in:
        product = Product.query.get(it.get('product_id'))
        if not product:
            return jsonify({'error': f'product {it.get("product_id")} not found'}), 400
        enriched.append({
            'product_id': product.id,
            'quantity': int(it['quantity']),
            'price_per_unit_usd': float(it['price_per_unit_usd']),
            'customs_duty_percent': product.customs_duty_percent,
            'vat_import_percent': product.vat_import_percent,
        })

    calced = distribute_batch_costs(enriched, shipping, extra_kzt, rate)

    batch = ImportBatch(
        batch_number=data['batch_number'],
        invoice_number=data.get('invoice_number'),
        supplier_name=data.get('supplier_name'),
        shipping_cost_usd=shipping,
        additional_costs_kzt=extra_kzt,
        exchange_rate=rate,
        status=data.get('status', 'draft'),
        import_date=date.today(),
    )
    db.session.add(batch)
    db.session.flush()

    total_fob = total_customs = total_vat = total_cost_usd = total_cost_kzt = 0.0
    for src, calc in zip(enriched, calced):
        item = ImportBatchItem(
            batch_id=batch.id,
            product_id=src['product_id'],
            quantity=src['quantity'],
            price_per_unit_usd=src['price_per_unit_usd'],
            customs_duty_percent=src['customs_duty_percent'],
            vat_import_percent=src['vat_import_percent'],
            fob_usd=calc['fob_usd'],
            customs_duty_usd=calc['customs_duty_usd'],
            vat_import_usd=calc['vat_import_usd'],
            unit_cost_usd=calc['unit_cost_usd'],
            unit_cost_kzt=calc['unit_cost_kzt'],
        )
        db.session.add(item)
        total_fob += calc['fob_usd']
        total_customs += calc['customs_duty_usd']
        total_vat += calc['vat_import_usd']
        total_cost_usd += calc['total_cost_usd']
        total_cost_kzt += calc['total_cost_kzt']

    batch.total_fob_usd = round(total_fob, 2)
    batch.total_customs_duty_usd = round(total_customs, 2)
    batch.total_vat_import_usd = round(total_vat, 2)
    batch.total_cost_usd = round(total_cost_usd, 2)
    batch.total_cost_kzt = round(total_cost_kzt, 2)

    db.session.commit()
    return jsonify({
        'id': batch.id,
        'batch_number': batch.batch_number,
        'total_fob_usd': batch.total_fob_usd,
        'total_cost_usd': batch.total_cost_usd,
        'total_cost_kzt': batch.total_cost_kzt,
        'items': [{
            'product_id': i.product_id,
            'quantity': i.quantity,
            'unit_cost_kzt': i.unit_cost_kzt,
        } for i in batch.items],
    }), 201


@bp.get('/<int:batch_id>')
def get_batch(batch_id):
    batch = ImportBatch.query.get_or_404(batch_id)
    return jsonify({
        'id': batch.id,
        'batch_number': batch.batch_number,
        'invoice_number': batch.invoice_number,
        'supplier_name': batch.supplier_name,
        'shipping_cost_usd': batch.shipping_cost_usd,
        'additional_costs_kzt': batch.additional_costs_kzt,
        'exchange_rate': batch.exchange_rate,
        'total_fob_usd': batch.total_fob_usd,
        'total_customs_duty_usd': batch.total_customs_duty_usd,
        'total_vat_import_usd': batch.total_vat_import_usd,
        'total_cost_usd': batch.total_cost_usd,
        'total_cost_kzt': batch.total_cost_kzt,
        'status': batch.status,
        'import_date': batch.import_date.isoformat() if batch.import_date else None,
        'items': [{
            'id': i.id,
            'product_id': i.product_id,
            'product_name': i.product.name,
            'quantity': i.quantity,
            'price_per_unit_usd': i.price_per_unit_usd,
            'customs_duty_percent': i.customs_duty_percent,
            'vat_import_percent': i.vat_import_percent,
            'fob_usd': i.fob_usd,
            'customs_duty_usd': i.customs_duty_usd,
            'vat_import_usd': i.vat_import_usd,
            'unit_cost_usd': i.unit_cost_usd,
            'unit_cost_kzt': i.unit_cost_kzt,
        } for i in batch.items],
    })


@bp.post('/preview')
def preview_batch():
    """Превью расчёта без сохранения — для UI-формы."""
    data = request.get_json(silent=True) or {}
    items_in = data.get('items') or []
    rate = float(data.get('exchange_rate') or _get_default_rate())
    shipping = float(data.get('shipping_cost_usd', 0))
    extra_kzt = float(data.get('additional_costs_kzt', 0))

    enriched = []
    for it in items_in:
        product = Product.query.get(it.get('product_id'))
        if not product:
            continue
        enriched.append({
            'product_id': product.id,
            'product_name': product.name,
            'quantity': int(it['quantity']),
            'price_per_unit_usd': float(it['price_per_unit_usd']),
            'customs_duty_percent': product.customs_duty_percent,
            'vat_import_percent': product.vat_import_percent,
        })
    if not enriched:
        return jsonify({'items': [], 'totals': {}})

    calced = distribute_batch_costs(enriched, shipping, extra_kzt, rate)
    items_out = []
    totals = {'fob_usd': 0, 'customs_usd': 0, 'vat_usd': 0, 'cost_usd': 0, 'cost_kzt': 0}
    for src, calc in zip(enriched, calced):
        items_out.append({**src, **calc})
        totals['fob_usd'] += calc['fob_usd']
        totals['customs_usd'] += calc['customs_duty_usd']
        totals['vat_usd'] += calc['vat_import_usd']
        totals['cost_usd'] += calc['total_cost_usd']
        totals['cost_kzt'] += calc['total_cost_kzt']
    totals = {k: round(v, 2) for k, v in totals.items()}
    return jsonify({'items': items_out, 'totals': totals, 'exchange_rate': rate})
