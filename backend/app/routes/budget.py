"""Бюджет (плановые показатели) + План vs Факт."""
from datetime import date, timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.models import BudgetPlan, CashTransaction, SaleItem, db

bp = Blueprint('budget', __name__, url_prefix='/api/finance/budget')


@bp.get('/')
def list_budget():
    year = request.args.get('year', default=date.today().year, type=int)
    month = request.args.get('month', type=int)
    q = BudgetPlan.query.filter(BudgetPlan.year == year)
    if month:
        q = q.filter(BudgetPlan.month == month)
    rows = q.order_by(BudgetPlan.month.asc(), BudgetPlan.metric.asc()).all()
    return jsonify([{
        'id': r.id,
        'year': r.year,
        'month': r.month,
        'metric': r.metric,
        'plan_kzt': r.plan_kzt,
    } for r in rows])


def _month_bounds(year: int, month: int):
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)
    return start, end - timedelta(days=1)


@bp.get('/plan-vs-fact')
def plan_vs_fact():
    """Сравнение плана и факта за указанный месяц.

    Факт собирается из sale_items + cash_transactions по тому же месяцу.
    """
    year = request.args.get('year', default=date.today().year, type=int)
    month = request.args.get('month', default=date.today().month, type=int)
    start, end = _month_bounds(year, month)

    # Факт по продажам
    sales_q = (SaleItem.query
               .filter(SaleItem.sale_date >= start, SaleItem.sale_date <= end))
    revenue_fact = sum(s.total_revenue_kzt or 0 for s in sales_q.all())
    cost_fact    = sum(s.total_cost_kzt    or 0 for s in sales_q.all())
    margin_fact  = sum(s.gross_margin_kzt  or 0 for s in sales_q.all())
    net_fact     = sum(s.net_profit_kzt    or 0 for s in sales_q.all())

    # Факт по расходам — группировка по category
    expense_by_cat = dict(db.session.query(
        CashTransaction.category,
        func.sum(CashTransaction.amount_kzt),
    )
    .filter(CashTransaction.transaction_date >= start,
            CashTransaction.transaction_date <= end,
            CashTransaction.transaction_type == 'expense')
    .group_by(CashTransaction.category)
    .all())

    # План по метрикам
    plans = {p.metric: p.plan_kzt for p in
             BudgetPlan.query.filter_by(year=year, month=month).all()}

    def row(metric_key, label, fact):
        plan = plans.get(metric_key, 0)
        diff = fact - plan
        pct = (fact / plan * 100) if plan else 0
        return {
            'metric': metric_key,
            'label': label,
            'plan_kzt': round(plan, 2),
            'fact_kzt': round(fact, 2),
            'diff_kzt': round(diff, 2),
            'achievement_percent': round(pct, 1),
        }

    rows = [
        row('revenue',      'Выручка',          revenue_fact),
        row('cost',         'Себестоимость',    cost_fact),
        row('gross_margin', 'Валовая маржа',    margin_fact),
        row('net_profit',   'Чистая прибыль',   net_fact),
    ]

    expense_rows = []
    for cat in ('purchase', 'salary', 'logistics', 'rent', 'marketing', 'utilities', 'tax', 'other'):
        fact = expense_by_cat.get(cat, 0) or 0
        expense_rows.append(row(f'expenses_{cat}', cat, fact))

    return jsonify({
        'year': year,
        'month': month,
        'period_start': start.isoformat(),
        'period_end': end.isoformat(),
        'main_rows': rows,
        'expense_rows': expense_rows,
    })
