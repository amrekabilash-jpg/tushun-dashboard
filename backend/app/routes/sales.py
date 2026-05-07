"""API для продаж — рассчитывает выручку, маржу, налоги при создании сделки."""
from datetime import date

from flask import Blueprint, jsonify, request

from app.formulas.calculations import calculate_sale
from app.models import Product, SaleItem, db

bp = Blueprint('sales', __name__, url_prefix='/api/sales')


@bp.get('/')
def list_sales():
    sales = SaleItem.query.order_by(SaleItem.created_at.desc()).limit(200).all()
    return jsonify([{
        'id': s.id,
        'invoice_number': s.invoice_number,
        'product_id': s.product_id,
        'product_name': s.product.name if s.product else None,
        'customer_name': s.customer_name,
        'quantity': s.quantity,
        'unit_price_kzt': s.unit_price_kzt,
        'unit_cost_kzt': s.unit_cost_kzt,
        'total_revenue_kzt': s.total_revenue_kzt,
        'gross_margin_kzt': s.gross_margin_kzt,
        'gross_margin_percent': s.gross_margin_percent,
        'vat_to_pay_kzt': s.vat_to_pay_kzt,
        'kpn_tax_kzt': s.kpn_tax_kzt,
        'net_profit_kzt': s.net_profit_kzt,
        'sale_date': s.sale_date.isoformat() if s.sale_date else None,
        'status': s.status,
    } for s in sales])


@bp.post('/')
def create_sale():
    data = request.get_json(silent=True) or {}
    product = Product.query.get(data.get('product_id'))
    if not product:
        return jsonify({'error': 'product_not_found'}), 404
    if not data.get('quantity') or not data.get('unit_price_kzt') or data.get('unit_cost_kzt') is None:
        return jsonify({'error': 'quantity, unit_price_kzt, unit_cost_kzt required'}), 400

    calc = calculate_sale(
        quantity=int(data['quantity']),
        unit_price_kzt=float(data['unit_price_kzt']),
        unit_cost_kzt=float(data['unit_cost_kzt']),
        vat_sale_percent=product.vat_sale_percent,
        kpn_percent=product.kpn_percent,
    )

    sale = SaleItem(
        invoice_number=data.get('invoice_number'),
        product_id=product.id,
        customer_name=data.get('customer_name'),
        quantity=calc['quantity'],
        unit_price_kzt=calc['unit_price_kzt'],
        unit_cost_kzt=calc['unit_cost_kzt'],
        total_revenue_kzt=calc['total_revenue_kzt'],
        total_cost_kzt=calc['total_cost_kzt'],
        gross_margin_kzt=calc['gross_margin_kzt'],
        gross_margin_percent=calc['gross_margin_percent'],
        vat_input_kzt=calc['vat_input_kzt'],
        vat_output_kzt=calc['vat_output_kzt'],
        vat_to_pay_kzt=calc['vat_to_pay_kzt'],
        kpn_tax_kzt=calc['kpn_tax_kzt'],
        net_profit_kzt=calc['net_profit_kzt'],
        sale_date=date.today(),
    )
    db.session.add(sale)
    db.session.commit()
    return jsonify({'id': sale.id, **calc}), 201


@bp.post('/preview')
def preview_sale():
    data = request.get_json(silent=True) or {}
    product = Product.query.get(data.get('product_id'))
    if not product:
        return jsonify({'error': 'product_not_found'}), 404
    calc = calculate_sale(
        quantity=int(data.get('quantity', 0) or 0),
        unit_price_kzt=float(data.get('unit_price_kzt', 0) or 0),
        unit_cost_kzt=float(data.get('unit_cost_kzt', 0) or 0),
        vat_sale_percent=product.vat_sale_percent,
        kpn_percent=product.kpn_percent,
    )
    return jsonify(calc)
