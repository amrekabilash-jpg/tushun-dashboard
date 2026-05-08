"""Stock movements + current stock aggregation.

Текущие остатки = SUM(stock_movements.quantity) per product per warehouse.
Партии импорта НЕ создают movements автоматически — приход регистрируется
отдельно через POST /api/stock/movements (тип in).
"""
from datetime import date, timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.models import Product, StockMovement, Warehouse, db

bp = Blueprint('stock', __name__, url_prefix='/api/stock')


# ---------- ОСТАТКИ ----------

@bp.get('/current')
def current_stock():
    """Текущие остатки по всем (product × warehouse).

    Query params:
        warehouse_id — фильтр по складу (опционально)
        product_id   — фильтр по товару (опционально)
        category     — фильтр по категории товара (опционально)
    Response:
        [{product_id, product_name, category, warehouse_id, warehouse_name, qty, status}]
        status: 'zero' (qty<=0) | 'low' (qty<low_threshold) | 'ok'
    """
    warehouse_id = request.args.get('warehouse_id', type=int)
    product_id = request.args.get('product_id', type=int)
    category = request.args.get('category')
    low_threshold = int(request.args.get('low_threshold', 10))

    q = (db.session.query(
            Product.id.label('product_id'),
            Product.name.label('product_name'),
            Product.category.label('category'),
            Product.unit.label('unit'),
            Warehouse.id.label('warehouse_id'),
            Warehouse.name.label('warehouse_name'),
            Warehouse.code.label('warehouse_code'),
            func.coalesce(func.sum(StockMovement.quantity), 0).label('qty'),
         )
         .select_from(Product)
         .join(Warehouse, Warehouse.is_active == True)  # noqa: E712 cross-join active warehouses
         .outerjoin(StockMovement,
                    (StockMovement.product_id == Product.id) &
                    (StockMovement.warehouse_id == Warehouse.id))
         .group_by(Product.id, Warehouse.id))

    if warehouse_id:
        q = q.filter(Warehouse.id == warehouse_id)
    if product_id:
        q = q.filter(Product.id == product_id)
    if category:
        q = q.filter(Product.category == category)

    rows = q.order_by(Product.name, Warehouse.id).all()

    result = []
    for r in rows:
        qty = int(r.qty or 0)
        if qty <= 0:
            status = 'zero'
        elif qty < low_threshold:
            status = 'low'
        else:
            status = 'ok'
        result.append({
            'product_id': r.product_id,
            'product_name': r.product_name,
            'category': r.category,
            'unit': r.unit,
            'warehouse_id': r.warehouse_id,
            'warehouse_name': r.warehouse_name,
            'warehouse_code': r.warehouse_code,
            'qty': qty,
            'status': status,
        })
    return jsonify(result)


@bp.get('/summary')
def stock_summary():
    """Сводка для Обзора Module 2.

    Returns:
        total_products, total_warehouses,
        stock_by_warehouse: [{warehouse_id, warehouse_name, total_qty, sku_count}],
        low_stock_count, zero_stock_count,
        recent_movements_count (за 7 дней)
    """
    total_products = Product.query.count()
    total_warehouses = Warehouse.query.filter_by(is_active=True).count()

    # Остатки по каждому складу
    by_warehouse = (db.session.query(
            Warehouse.id, Warehouse.name, Warehouse.code,
            func.coalesce(func.sum(StockMovement.quantity), 0).label('total_qty'),
            func.count(func.distinct(StockMovement.product_id)).label('sku_count'),
        )
        .select_from(Warehouse)
        .outerjoin(StockMovement, StockMovement.warehouse_id == Warehouse.id)
        .filter(Warehouse.is_active == True)  # noqa: E712
        .group_by(Warehouse.id)
        .all())

    stock_by_warehouse = [
        {
            'warehouse_id': r.id,
            'warehouse_name': r.name,
            'warehouse_code': r.code,
            'total_qty': int(r.total_qty or 0),
            'sku_count': int(r.sku_count or 0),
        }
        for r in by_warehouse
    ]

    # Низкие/нулевые остатки — считаем агрегацию вручную
    stock_rows = (db.session.query(
            Product.id, Warehouse.id,
            func.coalesce(func.sum(StockMovement.quantity), 0).label('qty'),
        )
        .select_from(Product)
        .join(Warehouse, Warehouse.is_active == True)  # noqa: E712
        .outerjoin(StockMovement,
                   (StockMovement.product_id == Product.id) &
                   (StockMovement.warehouse_id == Warehouse.id))
        .group_by(Product.id, Warehouse.id)
        .all())

    low_threshold = 10
    low_count = sum(1 for r in stock_rows if 0 < int(r.qty or 0) < low_threshold)
    zero_count = sum(1 for r in stock_rows if int(r.qty or 0) <= 0)

    # Движения за 7 дней
    week_ago = date.today() - timedelta(days=7)
    recent = StockMovement.query.filter(StockMovement.movement_date >= week_ago).count()

    return jsonify({
        'total_products': total_products,
        'total_warehouses': total_warehouses,
        'stock_by_warehouse': stock_by_warehouse,
        'low_stock_count': low_count,
        'zero_stock_count': zero_count,
        'recent_movements_count': recent,
    })


# ---------- ДВИЖЕНИЯ ----------

@bp.get('/movements')
def list_movements():
    """История движений с фильтрами + пагинацией.

    Query params:
        warehouse_id, product_id, movement_type, date_from, date_to
        limit (default 50), offset (default 0)
    """
    q = StockMovement.query

    warehouse_id = request.args.get('warehouse_id', type=int)
    product_id = request.args.get('product_id', type=int)
    mtype = request.args.get('movement_type')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')

    if warehouse_id:
        q = q.filter(StockMovement.warehouse_id == warehouse_id)
    if product_id:
        q = q.filter(StockMovement.product_id == product_id)
    if mtype:
        q = q.filter(StockMovement.movement_type == mtype)
    if date_from:
        q = q.filter(StockMovement.movement_date >= date_from)
    if date_to:
        q = q.filter(StockMovement.movement_date <= date_to)

    total = q.count()
    limit = min(int(request.args.get('limit', 50)), 500)
    offset = int(request.args.get('offset', 0))
    items = q.order_by(StockMovement.movement_date.desc(),
                       StockMovement.id.desc()).limit(limit).offset(offset).all()

    return jsonify({
        'total': total,
        'items': [m.to_dict() for m in items],
    })


@bp.post('/movements')
def create_movement():
    """Зарегистрировать приход / расход / корректировку.

    Body:
        product_id (req), warehouse_id (req),
        movement_type: 'in' | 'out' | 'adjustment' (req),
        quantity (req, всегда положительное число — знак выставляется по типу),
        document_ref, counterparty, note, movement_date, created_by
    """
    data = request.get_json(silent=True) or {}
    required = ('product_id', 'warehouse_id', 'movement_type', 'quantity')
    if not all(data.get(k) is not None for k in required):
        return jsonify({'error': f'fields required: {", ".join(required)}'}), 400

    mtype = data['movement_type']
    if mtype not in ('in', 'out', 'adjustment'):
        return jsonify({'error': 'movement_type must be: in | out | adjustment'}), 400

    qty = int(data['quantity'])
    if qty <= 0:
        return jsonify({'error': 'quantity must be positive (sign is set by movement_type)'}), 400

    Product.query.get_or_404(data['product_id'])
    Warehouse.query.get_or_404(data['warehouse_id'])

    # Знак: in = +qty, out = -qty, adjustment = ±qty (передаётся как qty с флагом)
    signed_qty = qty if mtype == 'in' else -qty if mtype == 'out' else int(data.get('signed_quantity', qty))

    m = StockMovement(
        product_id=int(data['product_id']),
        warehouse_id=int(data['warehouse_id']),
        movement_type=mtype,
        quantity=signed_qty,
        document_ref=data.get('document_ref'),
        counterparty=data.get('counterparty'),
        note=data.get('note'),
        movement_date=data.get('movement_date') or date.today(),
        created_by=data.get('created_by'),
    )
    db.session.add(m)
    db.session.commit()
    return jsonify(m.to_dict()), 201


@bp.post('/transfer')
def transfer_stock():
    """Перемещение товара между складами — создаёт пару движений (transfer_out + transfer_in).

    Body:
        product_id, from_warehouse_id, to_warehouse_id, quantity, note, movement_date
    """
    data = request.get_json(silent=True) or {}
    required = ('product_id', 'from_warehouse_id', 'to_warehouse_id', 'quantity')
    if not all(data.get(k) is not None for k in required):
        return jsonify({'error': f'fields required: {", ".join(required)}'}), 400
    if data['from_warehouse_id'] == data['to_warehouse_id']:
        return jsonify({'error': 'from and to warehouses must differ'}), 400
    qty = int(data['quantity'])
    if qty <= 0:
        return jsonify({'error': 'quantity must be positive'}), 400

    Product.query.get_or_404(data['product_id'])
    Warehouse.query.get_or_404(data['from_warehouse_id'])
    Warehouse.query.get_or_404(data['to_warehouse_id'])

    common = dict(
        product_id=int(data['product_id']),
        document_ref=data.get('document_ref'),
        note=data.get('note'),
        movement_date=data.get('movement_date') or date.today(),
        created_by=data.get('created_by'),
    )
    out_mov = StockMovement(
        warehouse_id=int(data['from_warehouse_id']),
        movement_type='transfer_out', quantity=-qty, **common,
    )
    in_mov = StockMovement(
        warehouse_id=int(data['to_warehouse_id']),
        movement_type='transfer_in', quantity=qty, **common,
    )
    db.session.add_all([out_mov, in_mov])
    db.session.commit()
    return jsonify({'out': out_mov.to_dict(), 'in': in_mov.to_dict()}), 201


# ---------- ПРОГНОЗ ----------

@bp.get('/forecast')
def stock_forecast():
    """Прогноз закупок на основе скорости продаж за N дней.

    Алгоритм:
        1. Берём продажи за последние lookback_days дней (default 30)
        2. Считаем avg_daily_sales = total_sold / lookback_days per product
        3. Дни до исчерпания = current_qty / avg_daily_sales (если avg > 0)
        4. Рекомендация к закупке = max(0, target_days * avg_daily - current_qty)

    Query: lookback_days (default 30), target_days (default 60)
    """
    from app.models import SaleItem  # local import to avoid circular

    lookback_days = int(request.args.get('lookback_days', 30))
    target_days = int(request.args.get('target_days', 60))
    cutoff = date.today() - timedelta(days=lookback_days)

    # Скорость продаж per product (сумма по всем складам)
    sales_rate = (db.session.query(
            SaleItem.product_id,
            func.sum(SaleItem.quantity).label('sold'),
        )
        .filter(SaleItem.sale_date >= cutoff)
        .group_by(SaleItem.product_id)
        .all())
    sold_by_product = {r.product_id: int(r.sold or 0) for r in sales_rate}

    # Текущие остатки per product (сумма по всем складам)
    stock_rows = (db.session.query(
            Product.id, Product.name, Product.category, Product.unit,
            func.coalesce(func.sum(StockMovement.quantity), 0).label('qty'),
        )
        .select_from(Product)
        .outerjoin(StockMovement, StockMovement.product_id == Product.id)
        .group_by(Product.id)
        .all())

    result = []
    for r in stock_rows:
        sold = sold_by_product.get(r.id, 0)
        avg_daily = sold / lookback_days if lookback_days > 0 else 0
        current_qty = int(r.qty or 0)
        days_left = round(current_qty / avg_daily, 1) if avg_daily > 0 else None
        recommended_qty = max(0, round(target_days * avg_daily - current_qty))

        if avg_daily == 0 and current_qty > 0:
            urgency = 'none'
        elif days_left is None or days_left > 60:
            urgency = 'low'
        elif days_left > 30:
            urgency = 'medium'
        elif days_left > 7:
            urgency = 'high'
        else:
            urgency = 'critical'

        result.append({
            'product_id': r.id,
            'product_name': r.name,
            'category': r.category,
            'unit': r.unit,
            'current_qty': current_qty,
            'sold_last_period': sold,
            'avg_daily_sales': round(avg_daily, 2),
            'days_left': days_left,
            'recommended_qty': recommended_qty,
            'urgency': urgency,
        })

    result.sort(key=lambda x: (x['urgency'] != 'critical', x['urgency'] != 'high',
                               x['days_left'] if x['days_left'] is not None else 9999))
    return jsonify({
        'lookback_days': lookback_days,
        'target_days': target_days,
        'items': result,
    })
