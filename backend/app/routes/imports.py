"""API для партий импорта (Module 4 + используется Module 1).

Расчёт себестоимости использует tax-настройки из БД на момент создания партии
(сохраняем в строках batch_items, чтобы исторические партии не пересчитывались
после смены ставок).

Module 4 расширения:
- Tracking номера, ETA, дата прибытия, целевой склад
- PUT /<id>/status с автоматическим stock-in при arrived
- Сводка /summary и аналитика /by-product
"""
from datetime import date

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.formulas.calculations import distribute_batch_costs
from app.models import (
    AppSetting, ImportBatch, ImportBatchItem, Product,
    StockMovement, Warehouse, db,
)

bp = Blueprint('imports', __name__, url_prefix='/api/imports')

VALID_STATUSES = {'draft', 'in_transit', 'arrived', 'completed', 'cancelled'}


def _get_default_rate() -> float:
    setting = AppSetting.query.get('exchange_rate_usd_kzt')
    return float(setting.value) if setting else 450.0


def _parse_date(s):
    if not s:
        return None
    if isinstance(s, date):
        return s
    return date.fromisoformat(s)


# ---------- LIST + DETAIL + CREATE ----------

@bp.get('/')
def list_batches():
    """Список партий с фильтрами.

    Query: status, supplier, date_from, date_to, search
    """
    q = ImportBatch.query

    status = request.args.get('status')
    supplier = request.args.get('supplier')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    search = request.args.get('search', '').strip().lower()

    if status:
        q = q.filter(ImportBatch.status == status)
    if supplier:
        q = q.filter(ImportBatch.supplier_name == supplier)
    if date_from:
        q = q.filter(ImportBatch.import_date >= date_from)
    if date_to:
        q = q.filter(ImportBatch.import_date <= date_to)

    rows = q.order_by(ImportBatch.created_at.desc()).all()
    items = [b.to_dict() for b in rows]

    if search:
        items = [d for d in items
                 if search in (d['batch_number'] or '').lower()
                 or search in (d['invoice_number'] or '').lower()
                 or search in (d['supplier_name'] or '').lower()
                 or search in (d['tracking_number'] or '').lower()]
    return jsonify(items)


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

    # Module 4: проверка целевого склада
    dest_wh_id = data.get('destination_warehouse_id')
    if dest_wh_id:
        if not Warehouse.query.get(int(dest_wh_id)):
            return jsonify({'error': f'warehouse {dest_wh_id} not found'}), 400
        dest_wh_id = int(dest_wh_id)

    batch = ImportBatch(
        batch_number=data['batch_number'],
        invoice_number=data.get('invoice_number'),
        supplier_name=data.get('supplier_name'),
        shipping_cost_usd=shipping,
        additional_costs_kzt=extra_kzt,
        exchange_rate=rate,
        status=data.get('status', 'draft'),
        import_date=_parse_date(data.get('import_date')) or date.today(),
        tracking_number=data.get('tracking_number'),
        eta_date=_parse_date(data.get('eta_date')),
        arrival_date=_parse_date(data.get('arrival_date')),
        destination_warehouse_id=dest_wh_id,
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
    d = batch.to_dict()
    d['items'] = [{
        'id': i.id,
        'product_id': i.product_id,
        'product_name': i.product.name,
        'category': i.product.category,
        'quantity': i.quantity,
        'price_per_unit_usd': i.price_per_unit_usd,
        'customs_duty_percent': i.customs_duty_percent,
        'vat_import_percent': i.vat_import_percent,
        'fob_usd': i.fob_usd,
        'customs_duty_usd': i.customs_duty_usd,
        'vat_import_usd': i.vat_import_usd,
        'unit_cost_usd': i.unit_cost_usd,
        'unit_cost_kzt': i.unit_cost_kzt,
        'total_cost_kzt': i.unit_cost_kzt * i.quantity,
    } for i in batch.items]
    return jsonify(d)


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


# ---------- MODULE 4: STATUS + TRACKING + AUTO STOCK-IN ----------

@bp.put('/<int:batch_id>/status')
def update_status(batch_id):
    """Смена статуса. При status='arrived' автоматически создаются StockMovement
    (тип 'in') для каждой позиции партии — это завозит товар на склад.

    Body:
        status (req): draft|in_transit|arrived|completed|cancelled
        arrival_date: при arrived — дата фактического прибытия (default today)
        destination_warehouse_id: куда зачислять (если не указан, используем уже сохранённый)
    """
    batch = ImportBatch.query.get_or_404(batch_id)
    data = request.get_json(silent=True) or {}
    new_status = data.get('status')
    if new_status not in VALID_STATUSES:
        return jsonify({'error': f'status must be one of {sorted(VALID_STATUSES)}'}), 400

    # Опциональные поля
    if 'arrival_date' in data:
        batch.arrival_date = _parse_date(data['arrival_date'])
    if 'eta_date' in data:
        batch.eta_date = _parse_date(data['eta_date'])
    if 'tracking_number' in data:
        batch.tracking_number = data['tracking_number']
    if 'destination_warehouse_id' in data:
        wh_id = data['destination_warehouse_id']
        if wh_id:
            if not Warehouse.query.get(int(wh_id)):
                return jsonify({'error': 'warehouse not found'}), 400
            batch.destination_warehouse_id = int(wh_id)

    old_status = batch.status
    batch.status = new_status

    # AUTO STOCK-IN при переходе в arrived
    stock_movements_created = 0
    if new_status == 'arrived' and not batch.stock_in_created:
        wh_id = batch.destination_warehouse_id
        if not wh_id:
            # fallback: первый активный склад
            first_wh = Warehouse.query.filter_by(is_active=True).order_by(Warehouse.id).first()
            if not first_wh:
                return jsonify({'error': 'no active warehouse to receive stock'}), 400
            wh_id = first_wh.id
            batch.destination_warehouse_id = wh_id

        if not batch.arrival_date:
            batch.arrival_date = date.today()

        for it in batch.items:
            db.session.add(StockMovement(
                product_id=it.product_id,
                warehouse_id=wh_id,
                movement_type='in',
                quantity=it.quantity,
                document_ref=batch.batch_number,
                counterparty=batch.supplier_name,
                note=f'Авто-приход партии #{batch.id} (Module 4)',
                movement_date=batch.arrival_date,
            ))
            stock_movements_created += 1

        batch.stock_in_created = True

    db.session.commit()

    return jsonify({
        'batch': batch.to_dict(),
        'previous_status': old_status,
        'stock_movements_created': stock_movements_created,
    })


@bp.put('/<int:batch_id>')
def update_batch(batch_id):
    """Редактирование tracking-полей (не пересчитывает себестоимость)."""
    batch = ImportBatch.query.get_or_404(batch_id)
    data = request.get_json(silent=True) or {}
    for f in ('tracking_number', 'invoice_number', 'supplier_name'):
        if f in data:
            setattr(batch, f, data[f])
    if 'eta_date' in data:
        batch.eta_date = _parse_date(data['eta_date'])
    if 'arrival_date' in data:
        batch.arrival_date = _parse_date(data['arrival_date'])
    if 'destination_warehouse_id' in data:
        wh_id = data['destination_warehouse_id']
        if wh_id and not Warehouse.query.get(int(wh_id)):
            return jsonify({'error': 'warehouse not found'}), 400
        batch.destination_warehouse_id = int(wh_id) if wh_id else None
    db.session.commit()
    return jsonify(batch.to_dict())


# ---------- ANALYTICS ----------

@bp.get('/summary')
def summary():
    """Сводка по партиям для Overview Module 4."""
    total_batches = ImportBatch.query.count()

    # По статусам
    by_status = (db.session.query(
                    ImportBatch.status,
                    func.count(ImportBatch.id).label('count'),
                    func.coalesce(func.sum(ImportBatch.total_cost_kzt), 0).label('cost_kzt'),
                    func.coalesce(func.sum(ImportBatch.total_cost_usd), 0).label('cost_usd'),
                 )
                 .group_by(ImportBatch.status)
                 .all())
    statuses = [{
        'status': r.status,
        'count': int(r.count),
        'total_cost_kzt': float(r.cost_kzt),
        'total_cost_usd': float(r.cost_usd),
    } for r in by_status]

    # По поставщикам (топ-5)
    by_supplier = (db.session.query(
                       ImportBatch.supplier_name,
                       func.count(ImportBatch.id).label('count'),
                       func.coalesce(func.sum(ImportBatch.total_cost_kzt), 0).label('cost_kzt'),
                   )
                   .filter(ImportBatch.supplier_name.isnot(None))
                   .group_by(ImportBatch.supplier_name)
                   .order_by(func.sum(ImportBatch.total_cost_kzt).desc())
                   .limit(5)
                   .all())
    suppliers = [{
        'supplier': r.supplier_name,
        'count': int(r.count),
        'total_cost_kzt': float(r.cost_kzt),
    } for r in by_supplier]

    # Общие totals
    totals = db.session.query(
        func.coalesce(func.sum(ImportBatch.total_fob_usd), 0).label('fob_usd'),
        func.coalesce(func.sum(ImportBatch.total_customs_duty_usd), 0).label('customs_usd'),
        func.coalesce(func.sum(ImportBatch.total_vat_import_usd), 0).label('vat_usd'),
        func.coalesce(func.sum(ImportBatch.total_cost_usd), 0).label('cost_usd'),
        func.coalesce(func.sum(ImportBatch.total_cost_kzt), 0).label('cost_kzt'),
        func.avg(ImportBatch.exchange_rate).label('avg_rate'),
    ).filter(ImportBatch.status.in_(['arrived', 'completed'])).first()

    # In-transit ETA — что сейчас в пути
    in_transit = (ImportBatch.query
                  .filter(ImportBatch.status == 'in_transit')
                  .order_by(ImportBatch.eta_date.asc().nullslast())
                  .all())
    eta_rows = [b.to_dict() for b in in_transit]

    return jsonify({
        'total_batches': total_batches,
        'by_status': statuses,
        'top_suppliers': suppliers,
        'totals_completed': {
            'fob_usd': float(totals.fob_usd or 0),
            'customs_duty_usd': float(totals.customs_usd or 0),
            'vat_import_usd': float(totals.vat_usd or 0),
            'total_cost_usd': float(totals.cost_usd or 0),
            'total_cost_kzt': float(totals.cost_kzt or 0),
            'avg_exchange_rate': round(float(totals.avg_rate or 0), 2),
        },
        'in_transit': eta_rows,
    })


@bp.get('/by-product')
def by_product():
    """Себестоимость по товарам — агрегаты + история по партиям.

    Возвращает per product:
        - средневзвешенная unit_cost_kzt
        - последняя unit_cost_kzt
        - всего ввезено qty
        - количество партий
        - история (последние 10 партий с unit_cost)
    """
    products = Product.query.order_by(Product.id).all()
    result = []

    for p in products:
        items = (ImportBatchItem.query
                 .filter(ImportBatchItem.product_id == p.id)
                 .join(ImportBatch, ImportBatch.id == ImportBatchItem.batch_id)
                 .order_by(ImportBatch.import_date.desc(), ImportBatch.id.desc())
                 .all())

        if not items:
            result.append({
                'product_id': p.id,
                'product_name': p.name,
                'category': p.category,
                'unit': p.unit,
                'batches_count': 0,
                'total_quantity': 0,
                'avg_unit_cost_kzt': 0,
                'last_unit_cost_kzt': None,
                'total_cost_kzt': 0,
                'total_fob_usd': 0,
                'total_customs_usd': 0,
                'total_vat_usd': 0,
                'history': [],
            })
            continue

        total_qty = sum(i.quantity for i in items)
        total_cost_kzt = sum(i.unit_cost_kzt * i.quantity for i in items)
        total_fob = sum(i.fob_usd for i in items)
        total_customs = sum(i.customs_duty_usd for i in items)
        total_vat = sum(i.vat_import_usd for i in items)
        avg_unit = (total_cost_kzt / total_qty) if total_qty > 0 else 0

        history = [{
            'batch_id': i.batch_id,
            'batch_number': i.batch.batch_number,
            'import_date': i.batch.import_date.isoformat() if i.batch.import_date else None,
            'status': i.batch.status,
            'quantity': i.quantity,
            'unit_cost_kzt': round(i.unit_cost_kzt, 2),
            'unit_cost_usd': round(i.unit_cost_usd, 2),
            'fob_usd': round(i.fob_usd, 2),
            'customs_duty_usd': round(i.customs_duty_usd, 2),
            'vat_import_usd': round(i.vat_import_usd, 2),
        } for i in items[:10]]

        result.append({
            'product_id': p.id,
            'product_name': p.name,
            'category': p.category,
            'unit': p.unit,
            'batches_count': len(items),
            'total_quantity': total_qty,
            'avg_unit_cost_kzt': round(avg_unit, 2),
            'last_unit_cost_kzt': round(items[0].unit_cost_kzt, 2),
            'total_cost_kzt': round(total_cost_kzt, 2),
            'total_fob_usd': round(total_fob, 2),
            'total_customs_usd': round(total_customs, 2),
            'total_vat_usd': round(total_vat, 2),
            'history': history,
        })

    return jsonify(result)
