"""Финансовые отчёты: P&L, маржа по товарам, банковские остатки."""
from datetime import date, datetime, timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.models import Account, Product, SaleItem, db

bp = Blueprint('finance', __name__, url_prefix='/api/finance')


def _date_range():
    days = request.args.get('days', default=30, type=int)
    end = date.today()
    start = end - timedelta(days=days)
    return start, end, days


@bp.get('/pl')
def profit_loss():
    start, end, days = _date_range()
    sales = SaleItem.query.filter(SaleItem.sale_date >= start).all()

    revenue = sum(s.total_revenue_kzt or 0 for s in sales)
    cost = sum(s.total_cost_kzt or 0 for s in sales)
    gross = revenue - cost
    vat = sum(s.vat_to_pay_kzt or 0 for s in sales)
    kpn = sum(s.kpn_tax_kzt or 0 for s in sales)
    net = sum(s.net_profit_kzt or 0 for s in sales)

    return jsonify({
        'period_days': days,
        'period_start': start.isoformat(),
        'period_end': end.isoformat(),
        'revenue_kzt': round(revenue, 2),
        'cost_kzt': round(cost, 2),
        'gross_margin_kzt': round(gross, 2),
        'gross_margin_percent': round((gross / revenue * 100) if revenue > 0 else 0, 2),
        'vat_to_pay_kzt': round(vat, 2),
        'kpn_tax_kzt': round(kpn, 2),
        'net_profit_kzt': round(net, 2),
        'sales_count': len(sales),
    })


@bp.get('/margin-by-product')
def margin_by_product():
    start, _, days = _date_range()
    rows = (db.session.query(
        SaleItem.product_id,
        Product.name,
        func.sum(SaleItem.total_revenue_kzt).label('revenue'),
        func.sum(SaleItem.total_cost_kzt).label('cost'),
        func.sum(SaleItem.gross_margin_kzt).label('margin'),
        func.sum(SaleItem.net_profit_kzt).label('net'),
        func.count(SaleItem.id).label('cnt'),
    )
    .join(Product, SaleItem.product_id == Product.id)
    .filter(SaleItem.sale_date >= start)
    .group_by(SaleItem.product_id, Product.name)
    .order_by(func.sum(SaleItem.gross_margin_kzt).desc())
    .all())

    out = []
    for r in rows:
        revenue = r.revenue or 0
        margin = r.margin or 0
        out.append({
            'product_id': r.product_id,
            'product_name': r.name,
            'revenue_kzt': round(revenue, 2),
            'cost_kzt': round(r.cost or 0, 2),
            'margin_kzt': round(margin, 2),
            'margin_percent': round((margin / revenue * 100) if revenue else 0, 2),
            'net_profit_kzt': round(r.net or 0, 2),
            'sales_count': r.cnt,
        })
    return jsonify({'period_days': days, 'rows': out})


@bp.get('/accounts')
def accounts():
    rows = Account.query.order_by(Account.id).all()
    return jsonify([{
        'id': a.id,
        'account_number': a.account_number,
        'bank_name': a.bank_name,
        'account_type': a.account_type,
        'currency': a.currency,
        'balance': a.balance,
    } for a in rows])
