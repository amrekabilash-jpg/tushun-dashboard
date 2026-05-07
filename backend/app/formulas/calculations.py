"""
Формулы расчёта себестоимости импорта и маржи продаж.

Все процентные ставки приходят как параметры (хранятся в БД,
редактируются через UI). Никаких хардкоженных констант в формулах.
"""
from typing import Iterable, List


def round2(x: float) -> float:
    return round(float(x), 2)


def calculate_unit_cost(
    quantity: int,
    price_per_unit_usd: float,
    shipping_cost_usd: float = 0.0,
    exchange_rate: float = 450.0,
    customs_duty_percent: float = 0.12,
    vat_import_percent: float = 0.12,
    additional_costs_kzt: float = 0.0,
) -> dict:
    """Считает себестоимость одной партии одного товара.

    Логика:
        FOB              = quantity * price_per_unit_usd
        FOB+Shipping     = FOB + shipping
        Customs          = (FOB+Shipping) * customs%
        BeforeVAT        = (FOB+Shipping) + Customs
        VAT_import       = BeforeVAT * vat_import%
        TotalCost_USD    = BeforeVAT + VAT_import
        TotalCost_KZT    = TotalCost_USD * rate + additional_KZT
    """
    if quantity <= 0:
        raise ValueError('quantity must be > 0')

    fob_usd = quantity * price_per_unit_usd
    with_shipping_usd = fob_usd + shipping_cost_usd
    customs_duty_usd = with_shipping_usd * customs_duty_percent
    before_vat_usd = with_shipping_usd + customs_duty_usd
    vat_import_usd = before_vat_usd * vat_import_percent
    total_cost_usd = before_vat_usd + vat_import_usd
    total_cost_kzt = total_cost_usd * exchange_rate + additional_costs_kzt

    return {
        'fob_usd':              round2(fob_usd),
        'shipping_cost_usd':    round2(shipping_cost_usd),
        'with_shipping_usd':    round2(with_shipping_usd),
        'customs_duty_usd':     round2(customs_duty_usd),
        'customs_duty_percent': customs_duty_percent,
        'vat_import_usd':       round2(vat_import_usd),
        'vat_import_percent':   vat_import_percent,
        'total_cost_usd':       round2(total_cost_usd),
        'total_cost_kzt':       round2(total_cost_kzt),
        'unit_cost_usd':        round2(total_cost_usd / quantity),
        'unit_cost_kzt':        round2(total_cost_kzt / quantity),
        'exchange_rate':        exchange_rate,
        'quantity':             quantity,
    }


def calculate_sale(
    quantity: int,
    unit_price_kzt: float,
    unit_cost_kzt: float,
    vat_sale_percent: float = 0.16,
    kpn_percent: float = 0.10,
) -> dict:
    """Считает выручку, маржу и налоги по сделке продажи.

    НДС: продажа считается как НДС-облагаемая операция,
    цены вводятся с НДС, поэтому к уплате идёт разница
    исходящего и входящего НДС.
    """
    if quantity <= 0:
        raise ValueError('quantity must be > 0')

    revenue = quantity * unit_price_kzt
    cost = quantity * unit_cost_kzt
    gross_margin = revenue - cost
    gross_margin_pct = (gross_margin / revenue * 100) if revenue > 0 else 0

    # НДС: с цен, уже включающих НДС, выделяем налог: VAT = price * pct/(1+pct)
    rate = vat_sale_percent / (1 + vat_sale_percent)
    vat_output = revenue * rate
    vat_input = cost * rate
    vat_to_pay = vat_output - vat_input

    # КПН считается с прибыли до вычета налогов (валовая маржа за вычетом НДС к уплате)
    profit_before_kpn = gross_margin - vat_to_pay
    kpn = max(profit_before_kpn, 0) * kpn_percent
    net_profit = profit_before_kpn - kpn

    return {
        'quantity': quantity,
        'unit_price_kzt': round2(unit_price_kzt),
        'unit_cost_kzt': round2(unit_cost_kzt),
        'total_revenue_kzt': round2(revenue),
        'total_cost_kzt': round2(cost),
        'gross_margin_kzt': round2(gross_margin),
        'gross_margin_percent': round2(gross_margin_pct),
        'vat_input_kzt': round2(vat_input),
        'vat_output_kzt': round2(vat_output),
        'vat_to_pay_kzt': round2(vat_to_pay),
        'vat_sale_percent': vat_sale_percent,
        'kpn_tax_kzt': round2(kpn),
        'kpn_percent': kpn_percent,
        'net_profit_kzt': round2(net_profit),
    }


def distribute_batch_costs(
    items: Iterable[dict],
    shipping_cost_usd: float,
    additional_costs_kzt: float,
    exchange_rate: float,
) -> List[dict]:
    """Распределяет shipping + доп.расходы пропорционально FOB каждого товара.

    Каждый item ожидает поля:
        product_id, quantity, price_per_unit_usd,
        customs_duty_percent, vat_import_percent
    Возвращает items с добавленными FOB/customs/vat/unit_cost полями.
    """
    items = list(items)
    if not items:
        return []

    fob_by_item = [it['quantity'] * it['price_per_unit_usd'] for it in items]
    total_fob = sum(fob_by_item)
    if total_fob <= 0:
        raise ValueError('total FOB must be > 0')

    results = []
    for it, fob in zip(items, fob_by_item):
        share = fob / total_fob
        item_shipping = shipping_cost_usd * share
        item_extra_kzt = additional_costs_kzt * share
        calc = calculate_unit_cost(
            quantity=it['quantity'],
            price_per_unit_usd=it['price_per_unit_usd'],
            shipping_cost_usd=item_shipping,
            exchange_rate=exchange_rate,
            customs_duty_percent=it['customs_duty_percent'],
            vat_import_percent=it['vat_import_percent'],
            additional_costs_kzt=item_extra_kzt,
        )
        calc['product_id'] = it['product_id']
        calc['share_percent'] = round2(share * 100)
        results.append(calc)
    return results
