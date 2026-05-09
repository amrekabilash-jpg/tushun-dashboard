"""Module 7: расходы, категории, бюджеты, анализ.

Использует существующую модель CashTransaction (type='expense') и
добавляет ExpenseCategory + ExpenseBudget для классификации и контроля.
"""
from datetime import date, timedelta
from collections import defaultdict

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.models import (
    Account, CashTransaction, ExpenseBudget, ExpenseCategory, SaleItem, db,
)

bp = Blueprint('expenses', __name__)


def _parse_date(s):
    if not s:
        return None
    if isinstance(s, date):
        return s
    return date.fromisoformat(s)


# ---------- CATEGORIES ----------

@bp.get('/api/expenses/categories')
def list_categories():
    """Список категорий с агрегатом фактических расходов в текущем месяце."""
    only_active = request.args.get('active', 'true').lower() == 'true'
    q = ExpenseCategory.query
    if only_active:
        q = q.filter_by(is_active=True)
    cats = q.order_by(ExpenseCategory.sort_order, ExpenseCategory.id).all()

    today = date.today()
    month_start = today.replace(day=1)

    # Факт за текущий месяц per category
    facts = (db.session.query(
                CashTransaction.expense_category_id,
                func.coalesce(func.sum(CashTransaction.amount_kzt), 0).label('amt'),
                func.count(CashTransaction.id).label('cnt'),
             )
             .filter(CashTransaction.transaction_type == 'expense',
                     CashTransaction.transaction_date >= month_start,
                     CashTransaction.expense_category_id.isnot(None))
             .group_by(CashTransaction.expense_category_id)
             .all())
    fact_map = {f.expense_category_id: (float(f.amt), int(f.cnt)) for f in facts}

    # Бюджет на текущий месяц
    budgets = (ExpenseBudget.query
               .filter_by(year=today.year, month=today.month)
               .all())
    budget_map = {b.category_id: b.limit_amount_kzt for b in budgets}

    result = []
    for c in cats:
        d = c.to_dict()
        fact_amt, fact_cnt = fact_map.get(c.id, (0.0, 0))
        budget = budget_map.get(c.id, c.monthly_limit_kzt or 0)
        used_pct = (fact_amt / budget * 100) if budget > 0 else 0
        d['current_month_fact_kzt'] = round(fact_amt, 2)
        d['current_month_count'] = fact_cnt
        d['current_month_budget_kzt'] = budget
        d['current_month_used_percent'] = round(used_pct, 1)
        d['current_month_remaining_kzt'] = max(0, budget - fact_amt)
        d['is_over_budget'] = fact_amt > budget if budget > 0 else False
        d['is_alert'] = used_pct >= c.alert_percent
        result.append(d)
    return jsonify(result)


@bp.post('/api/expenses/categories')
def create_category():
    data = request.get_json(silent=True) or {}
    if not data.get('code') or not data.get('name'):
        return jsonify({'error': 'code and name required'}), 400
    if ExpenseCategory.query.filter_by(code=data['code']).first():
        return jsonify({'error': 'category code already exists'}), 409
    c = ExpenseCategory(
        code=data['code'].strip(),
        name=data['name'].strip(),
        color=data.get('color', '#d4af37'),
        icon=data.get('icon'),
        description=data.get('description'),
        monthly_limit_kzt=float(data.get('monthly_limit_kzt', 0)),
        alert_percent=float(data.get('alert_percent', 80)),
        is_active=bool(data.get('is_active', True)),
        sort_order=int(data.get('sort_order', 999)),
    )
    db.session.add(c)
    db.session.commit()
    return jsonify(c.to_dict()), 201


@bp.put('/api/expenses/categories/<int:cat_id>')
def update_category(cat_id):
    c = ExpenseCategory.query.get_or_404(cat_id)
    data = request.get_json(silent=True) or {}
    for f in ('name', 'color', 'icon', 'description'):
        if f in data:
            setattr(c, f, data[f])
    if 'monthly_limit_kzt' in data:
        c.monthly_limit_kzt = float(data['monthly_limit_kzt'])
    if 'alert_percent' in data:
        c.alert_percent = float(data['alert_percent'])
    if 'is_active' in data:
        c.is_active = bool(data['is_active'])
    if 'sort_order' in data:
        c.sort_order = int(data['sort_order'])
    db.session.commit()
    return jsonify(c.to_dict())


@bp.delete('/api/expenses/categories/<int:cat_id>')
def delete_category(cat_id):
    c = ExpenseCategory.query.get_or_404(cat_id)
    # Сначала отвязать транзакции
    CashTransaction.query.filter_by(expense_category_id=cat_id).update(
        {'expense_category_id': None}
    )
    # Удалить бюджеты
    ExpenseBudget.query.filter_by(category_id=cat_id).delete()
    db.session.delete(c)
    db.session.commit()
    return jsonify({'deleted': True, 'id': cat_id})


# ---------- BUDGETS ----------

@bp.get('/api/expenses/budgets')
def list_budgets():
    """Список бюджетов с фактом для конкретного месяца.

    Query: year, month (default = current). Если не указано → текущий месяц.
    """
    today = date.today()
    year = int(request.args.get('year', today.year))
    month = int(request.args.get('month', today.month))

    cats = (ExpenseCategory.query
            .filter_by(is_active=True)
            .order_by(ExpenseCategory.sort_order)
            .all())

    budgets = ExpenseBudget.query.filter_by(year=year, month=month).all()
    budget_map = {b.category_id: b for b in budgets}

    # Факт за этот месяц per category
    period_start = date(year, month, 1)
    if month == 12:
        period_end = date(year + 1, 1, 1)
    else:
        period_end = date(year, month + 1, 1)

    facts = (db.session.query(
                CashTransaction.expense_category_id,
                func.coalesce(func.sum(CashTransaction.amount_kzt), 0).label('amt'),
                func.count(CashTransaction.id).label('cnt'),
             )
             .filter(CashTransaction.transaction_type == 'expense',
                     CashTransaction.transaction_date >= period_start,
                     CashTransaction.transaction_date < period_end,
                     CashTransaction.expense_category_id.isnot(None))
             .group_by(CashTransaction.expense_category_id)
             .all())
    fact_map = {f.expense_category_id: (float(f.amt), int(f.cnt)) for f in facts}

    rows = []
    for c in cats:
        budget = budget_map.get(c.id)
        fact_amt, fact_cnt = fact_map.get(c.id, (0.0, 0))
        limit = budget.limit_amount_kzt if budget else 0
        diff = fact_amt - limit
        used = (fact_amt / limit * 100) if limit > 0 else 0
        rows.append({
            'category_id': c.id,
            'category_code': c.code,
            'category_name': c.name,
            'category_color': c.color,
            'category_icon': c.icon,
            'budget_id': budget.id if budget else None,
            'limit_amount_kzt': limit,
            'fact_amount_kzt': round(fact_amt, 2),
            'fact_count': fact_cnt,
            'diff_kzt': round(diff, 2),
            'used_percent': round(used, 1),
            'is_over': fact_amt > limit if limit > 0 else False,
            'alert_percent': budget.alert_percent if budget else c.alert_percent,
            'is_alert': used >= (budget.alert_percent if budget else c.alert_percent),
        })

    total_limit = sum(r['limit_amount_kzt'] for r in rows)
    total_fact = sum(r['fact_amount_kzt'] for r in rows)

    return jsonify({
        'year': year,
        'month': month,
        'period_start': period_start.isoformat(),
        'period_end': (period_end - timedelta(days=1)).isoformat(),
        'rows': rows,
        'totals': {
            'limit_kzt': total_limit,
            'fact_kzt': round(total_fact, 2),
            'diff_kzt': round(total_fact - total_limit, 2),
            'used_percent': round(total_fact / total_limit * 100, 1) if total_limit > 0 else 0,
        },
    })


@bp.post('/api/expenses/budgets')
def upsert_budget():
    """Установить/обновить бюджет на месяц.

    Body: category_id, year, month, limit_amount_kzt, alert_percent, note
    """
    data = request.get_json(silent=True) or {}
    required = ('category_id', 'year', 'month', 'limit_amount_kzt')
    if not all(data.get(k) is not None for k in required):
        return jsonify({'error': f'fields required: {", ".join(required)}'}), 400

    ExpenseCategory.query.get_or_404(int(data['category_id']))

    existing = ExpenseBudget.query.filter_by(
        category_id=int(data['category_id']),
        year=int(data['year']),
        month=int(data['month']),
    ).first()

    if existing:
        existing.limit_amount_kzt = float(data['limit_amount_kzt'])
        if 'alert_percent' in data:
            existing.alert_percent = float(data['alert_percent'])
        if 'note' in data:
            existing.note = data['note']
        db.session.commit()
        return jsonify(existing.to_dict()), 200

    b = ExpenseBudget(
        category_id=int(data['category_id']),
        year=int(data['year']),
        month=int(data['month']),
        limit_amount_kzt=float(data['limit_amount_kzt']),
        alert_percent=float(data.get('alert_percent', 80)),
        note=data.get('note'),
    )
    db.session.add(b)
    db.session.commit()
    return jsonify(b.to_dict()), 201


@bp.delete('/api/expenses/budgets/<int:budget_id>')
def delete_budget(budget_id):
    b = ExpenseBudget.query.get_or_404(budget_id)
    db.session.delete(b)
    db.session.commit()
    return jsonify({'deleted': True, 'id': budget_id})


# ---------- EXPENSES (cash_transactions type=expense) ----------

def _expense_to_dict(tx: CashTransaction) -> dict:
    cat = tx.expense_category
    return {
        'id': tx.id,
        'account_id': tx.account_id,
        'amount_kzt': tx.amount_kzt,
        'description': tx.description,
        'counterparty': tx.counterparty,
        'transaction_date': tx.transaction_date.isoformat() if tx.transaction_date else None,
        'category_legacy': tx.category,
        'expense_category_id': tx.expense_category_id,
        'expense_category_name': cat.name if cat else None,
        'expense_category_color': cat.color if cat else None,
        'expense_category_icon': cat.icon if cat else None,
        'created_at': tx.created_at.isoformat() if tx.created_at else None,
    }


@bp.get('/api/expenses/')
def list_expenses():
    """Список расходов с фильтрами.

    Query: category_id, date_from, date_to, search, limit (default 200)
    """
    q = CashTransaction.query.filter(CashTransaction.transaction_type == 'expense')

    cat_id = request.args.get('category_id', type=int)
    if cat_id:
        q = q.filter(CashTransaction.expense_category_id == cat_id)
    date_from = request.args.get('date_from')
    if date_from:
        q = q.filter(CashTransaction.transaction_date >= date_from)
    date_to = request.args.get('date_to')
    if date_to:
        q = q.filter(CashTransaction.transaction_date <= date_to)
    search = request.args.get('search', '').strip().lower()

    limit = min(int(request.args.get('limit', 200)), 1000)
    items = q.order_by(CashTransaction.transaction_date.desc(), CashTransaction.id.desc()).limit(limit).all()

    rows = [_expense_to_dict(tx) for tx in items]
    if search:
        rows = [d for d in rows
                if search in (d['description'] or '').lower()
                or search in (d['counterparty'] or '').lower()]
    return jsonify(rows)


@bp.post('/api/expenses/')
def create_expense():
    data = request.get_json(silent=True) or {}
    if not data.get('amount_kzt') or not data.get('account_id'):
        return jsonify({'error': 'amount_kzt and account_id required'}), 400

    Account.query.get_or_404(int(data['account_id']))

    cat_id = data.get('expense_category_id')
    cat_legacy = None
    if cat_id:
        cat = ExpenseCategory.query.get_or_404(int(cat_id))
        cat_legacy = cat.code

    tx = CashTransaction(
        account_id=int(data['account_id']),
        transaction_type='expense',
        expense_category_id=int(cat_id) if cat_id else None,
        category=data.get('category') or cat_legacy,
        amount_kzt=float(data['amount_kzt']),
        description=data.get('description'),
        counterparty=data.get('counterparty'),
        transaction_date=_parse_date(data.get('transaction_date')) or date.today(),
    )
    db.session.add(tx)
    db.session.commit()
    return jsonify(_expense_to_dict(tx)), 201


@bp.put('/api/expenses/<int:expense_id>')
def update_expense(expense_id):
    tx = CashTransaction.query.get_or_404(expense_id)
    if tx.transaction_type != 'expense':
        return jsonify({'error': 'not an expense transaction'}), 400
    data = request.get_json(silent=True) or {}
    for f in ('description', 'counterparty'):
        if f in data:
            setattr(tx, f, data[f])
    if 'amount_kzt' in data:
        tx.amount_kzt = float(data['amount_kzt'])
    if 'transaction_date' in data:
        tx.transaction_date = _parse_date(data['transaction_date']) or tx.transaction_date
    if 'expense_category_id' in data:
        new_cat = data['expense_category_id']
        if new_cat:
            cat = ExpenseCategory.query.get_or_404(int(new_cat))
            tx.expense_category_id = int(new_cat)
            tx.category = cat.code
        else:
            tx.expense_category_id = None
    if 'account_id' in data:
        Account.query.get_or_404(int(data['account_id']))
        tx.account_id = int(data['account_id'])
    db.session.commit()
    return jsonify(_expense_to_dict(tx))


@bp.delete('/api/expenses/<int:expense_id>')
def delete_expense(expense_id):
    tx = CashTransaction.query.get_or_404(expense_id)
    if tx.transaction_type != 'expense':
        return jsonify({'error': 'not an expense'}), 400
    db.session.delete(tx)
    db.session.commit()
    return jsonify({'deleted': True, 'id': expense_id})


# ---------- ANALYTICS ----------

@bp.get('/api/expenses/summary')
def summary():
    """KPI для Analytics tab.

    Query: days (default 30) — период анализа
    """
    days = int(request.args.get('days', 30))
    today = date.today()
    cutoff = today - timedelta(days=days)
    month_start = today.replace(day=1)

    # Total expenses за период
    total = db.session.query(
        func.coalesce(func.sum(CashTransaction.amount_kzt), 0)
    ).filter(
        CashTransaction.transaction_type == 'expense',
        CashTransaction.transaction_date >= cutoff,
    ).scalar() or 0

    total_count = CashTransaction.query.filter(
        CashTransaction.transaction_type == 'expense',
        CashTransaction.transaction_date >= cutoff,
    ).count()

    # Месяц to-date
    mtd = db.session.query(
        func.coalesce(func.sum(CashTransaction.amount_kzt), 0)
    ).filter(
        CashTransaction.transaction_type == 'expense',
        CashTransaction.transaction_date >= month_start,
    ).scalar() or 0

    # Revenue за период (для % от выручки)
    revenue = db.session.query(
        func.coalesce(func.sum(SaleItem.total_revenue_kzt), 0)
    ).filter(SaleItem.sale_date >= cutoff).scalar() or 0

    expense_to_revenue = (float(total) / float(revenue) * 100) if revenue > 0 else 0

    # By category за период
    by_cat = (db.session.query(
                ExpenseCategory.id, ExpenseCategory.name, ExpenseCategory.color, ExpenseCategory.icon,
                func.coalesce(func.sum(CashTransaction.amount_kzt), 0).label('amt'),
                func.count(CashTransaction.id).label('cnt'),
              )
              .select_from(ExpenseCategory)
              .outerjoin(CashTransaction,
                         (CashTransaction.expense_category_id == ExpenseCategory.id) &
                         (CashTransaction.transaction_type == 'expense') &
                         (CashTransaction.transaction_date >= cutoff))
              .filter(ExpenseCategory.is_active == True)  # noqa: E712
              .group_by(ExpenseCategory.id)
              .order_by(func.sum(CashTransaction.amount_kzt).desc().nullslast())
              .all())
    categories = [{
        'category_id': r.id,
        'category_name': r.name,
        'color': r.color,
        'icon': r.icon,
        'amount_kzt': float(r.amt or 0),
        'count': int(r.cnt or 0),
        'percent_of_total': round(float(r.amt or 0) / float(total) * 100, 1) if total > 0 else 0,
    } for r in by_cat]

    # Daily breakdown за период
    daily_rows = (db.session.query(
                    CashTransaction.transaction_date,
                    func.coalesce(func.sum(CashTransaction.amount_kzt), 0).label('amt'),
                  )
                  .filter(CashTransaction.transaction_type == 'expense',
                          CashTransaction.transaction_date >= cutoff)
                  .group_by(CashTransaction.transaction_date)
                  .order_by(CashTransaction.transaction_date)
                  .all())
    daily = [{
        'date': r.transaction_date.isoformat() if r.transaction_date else None,
        'amount_kzt': float(r.amt or 0),
    } for r in daily_rows]

    return jsonify({
        'period_days': days,
        'period_start': cutoff.isoformat(),
        'period_end': today.isoformat(),
        'total_kzt': float(total),
        'total_count': total_count,
        'avg_per_day_kzt': round(float(total) / days, 2) if days > 0 else 0,
        'month_to_date_kzt': float(mtd),
        'revenue_kzt': float(revenue),
        'expense_to_revenue_percent': round(expense_to_revenue, 2),
        'by_category': categories,
        'daily': daily,
    })


@bp.get('/api/expenses/forecast')
def forecast():
    """Прогноз расходов до конца месяца.

    Алгоритм: avg за последние 30 дней × дней до конца месяца.
    Также сравнивается с последним полным месяцем (трендовый анализ).
    """
    today = date.today()
    days_in_month = (today.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    last_day = days_in_month.day
    days_left = last_day - today.day
    days_passed = today.day

    # Текущий месяц to-date
    month_start = today.replace(day=1)
    mtd = db.session.query(
        func.coalesce(func.sum(CashTransaction.amount_kzt), 0)
    ).filter(
        CashTransaction.transaction_type == 'expense',
        CashTransaction.transaction_date >= month_start,
    ).scalar() or 0

    avg_per_day = float(mtd) / days_passed if days_passed > 0 else 0
    forecast_total = float(mtd) + avg_per_day * days_left

    # Прошлый полный месяц для сравнения
    prev_month_end = month_start - timedelta(days=1)
    prev_month_start = prev_month_end.replace(day=1)
    prev = db.session.query(
        func.coalesce(func.sum(CashTransaction.amount_kzt), 0)
    ).filter(
        CashTransaction.transaction_type == 'expense',
        CashTransaction.transaction_date >= prev_month_start,
        CashTransaction.transaction_date <= prev_month_end,
    ).scalar() or 0

    trend_percent = 0
    if prev > 0:
        trend_percent = round((forecast_total - float(prev)) / float(prev) * 100, 1)

    # Forecast per category
    cats = ExpenseCategory.query.filter_by(is_active=True).all()
    cat_forecasts = []
    for c in cats:
        c_mtd = db.session.query(
            func.coalesce(func.sum(CashTransaction.amount_kzt), 0)
        ).filter(
            CashTransaction.transaction_type == 'expense',
            CashTransaction.transaction_date >= month_start,
            CashTransaction.expense_category_id == c.id,
        ).scalar() or 0
        c_avg = float(c_mtd) / days_passed if days_passed > 0 else 0
        c_forecast = float(c_mtd) + c_avg * days_left

        budget = ExpenseBudget.query.filter_by(
            category_id=c.id, year=today.year, month=today.month
        ).first()
        c_limit = budget.limit_amount_kzt if budget else c.monthly_limit_kzt or 0
        will_exceed = c_forecast > c_limit if c_limit > 0 else False

        cat_forecasts.append({
            'category_id': c.id,
            'category_name': c.name,
            'icon': c.icon, 'color': c.color,
            'mtd_kzt': float(c_mtd),
            'avg_per_day_kzt': round(c_avg, 2),
            'forecast_total_kzt': round(c_forecast, 2),
            'budget_kzt': c_limit,
            'will_exceed': will_exceed,
            'over_by_kzt': round(c_forecast - c_limit, 2) if will_exceed else 0,
        })

    return jsonify({
        'month_to_date_kzt': float(mtd),
        'days_passed': days_passed,
        'days_left': days_left,
        'days_in_month': last_day,
        'avg_per_day_kzt': round(avg_per_day, 2),
        'forecast_total_kzt': round(forecast_total, 2),
        'previous_month_kzt': float(prev),
        'trend_percent_vs_prev': trend_percent,
        'by_category': cat_forecasts,
    })


@bp.get('/api/expenses/alerts')
def alerts():
    """Превышения лимитов и приближение к ним за текущий месяц."""
    today = date.today()
    month_start = today.replace(day=1)

    cats = ExpenseCategory.query.filter_by(is_active=True).all()
    items = []
    for c in cats:
        budget = ExpenseBudget.query.filter_by(
            category_id=c.id, year=today.year, month=today.month
        ).first()
        limit = budget.limit_amount_kzt if budget else c.monthly_limit_kzt or 0
        if limit <= 0:
            continue

        fact = db.session.query(
            func.coalesce(func.sum(CashTransaction.amount_kzt), 0)
        ).filter(
            CashTransaction.transaction_type == 'expense',
            CashTransaction.transaction_date >= month_start,
            CashTransaction.expense_category_id == c.id,
        ).scalar() or 0

        used = float(fact) / limit * 100
        alert_threshold = budget.alert_percent if budget else c.alert_percent

        severity = None
        if fact > limit:
            severity = 'critical'  # превышен
        elif used >= alert_threshold:
            severity = 'warning'   # порог пройден
        elif used >= alert_threshold * 0.7:
            severity = 'info'      # приближается

        if severity:
            items.append({
                'category_id': c.id,
                'category_name': c.name,
                'icon': c.icon, 'color': c.color,
                'fact_kzt': float(fact),
                'limit_kzt': limit,
                'used_percent': round(used, 1),
                'alert_threshold': alert_threshold,
                'severity': severity,
                'over_by_kzt': max(0, round(float(fact) - limit, 2)),
            })

    items.sort(key=lambda x: (
        0 if x['severity'] == 'critical' else 1 if x['severity'] == 'warning' else 2,
        -x['used_percent'],
    ))
    return jsonify({
        'period_year': today.year,
        'period_month': today.month,
        'alerts': items,
        'critical_count': sum(1 for i in items if i['severity'] == 'critical'),
        'warning_count': sum(1 for i in items if i['severity'] == 'warning'),
        'info_count': sum(1 for i in items if i['severity'] == 'info'),
    })
