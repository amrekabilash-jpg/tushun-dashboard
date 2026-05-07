"""Юнит-тесты формул себестоимости и маржи.

Тесты построены вокруг конкретных кейсов из бизнес-сценария,
чтобы поломка ставок или порядка расчёта сразу падала.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest

from app.formulas.calculations import (
    calculate_sale,
    calculate_unit_cost,
    distribute_batch_costs,
)


def test_unit_cost_basic_case():
    """50 000 фильтров × $3, доставка $4 500, пошлина 12%, НДС 12%, курс 450."""
    r = calculate_unit_cost(
        quantity=50_000,
        price_per_unit_usd=3.0,
        shipping_cost_usd=4_500,
        exchange_rate=450,
        customs_duty_percent=0.12,
        vat_import_percent=0.12,
    )
    assert r['fob_usd'] == 150_000
    assert r['with_shipping_usd'] == 154_500
    assert r['customs_duty_usd'] == 18_540        # 154500 * 0.12
    assert r['vat_import_usd'] == pytest.approx(20_764.80)  # (154500+18540)*0.12
    assert r['total_cost_usd'] == pytest.approx(193_804.80)
    assert r['total_cost_kzt'] == pytest.approx(87_212_160.0)
    assert r['unit_cost_kzt'] == pytest.approx(1_744.24, abs=0.01)


def test_unit_cost_changes_with_duty():
    base = calculate_unit_cost(quantity=100, price_per_unit_usd=10, customs_duty_percent=0.12)
    high = calculate_unit_cost(quantity=100, price_per_unit_usd=10, customs_duty_percent=0.20)
    assert high['unit_cost_kzt'] > base['unit_cost_kzt']


def test_unit_cost_zero_duty():
    r = calculate_unit_cost(
        quantity=100, price_per_unit_usd=10,
        customs_duty_percent=0, vat_import_percent=0, exchange_rate=1,
    )
    assert r['customs_duty_usd'] == 0
    assert r['vat_import_usd'] == 0
    assert r['total_cost_usd'] == 1_000


def test_unit_cost_rejects_zero_quantity():
    with pytest.raises(ValueError):
        calculate_unit_cost(quantity=0, price_per_unit_usd=10)


def test_sale_positive_margin():
    r = calculate_sale(quantity=1_000, unit_price_kzt=2_700, unit_cost_kzt=1_744.24,
                       vat_sale_percent=0.16, kpn_percent=0.10)
    assert r['total_revenue_kzt'] == 2_700_000
    assert r['gross_margin_kzt'] == pytest.approx(955_760.0)
    # НДС с цены, включающей налог: rate = 0.16/1.16
    expected_vat_out = 2_700_000 * 0.16 / 1.16
    assert r['vat_output_kzt'] == pytest.approx(round(expected_vat_out, 2), abs=0.01)
    assert r['net_profit_kzt'] > 0


def test_sale_with_loss():
    r = calculate_sale(quantity=10, unit_price_kzt=100, unit_cost_kzt=200)
    assert r['gross_margin_kzt'] == -1000
    assert r['kpn_tax_kzt'] == 0  # КПН не начисляется при убытке


def test_sale_rejects_zero_qty():
    with pytest.raises(ValueError):
        calculate_sale(quantity=0, unit_price_kzt=100, unit_cost_kzt=50)


def test_distribute_costs_proportional():
    items = [
        {'product_id': 1, 'quantity': 100, 'price_per_unit_usd': 10,
         'customs_duty_percent': 0.12, 'vat_import_percent': 0.12},
        {'product_id': 2, 'quantity': 100, 'price_per_unit_usd': 30,
         'customs_duty_percent': 0.12, 'vat_import_percent': 0.12},
    ]
    out = distribute_batch_costs(items, shipping_cost_usd=400, additional_costs_kzt=0, exchange_rate=450)
    # FOB товара 2 в 3 раза больше → его share ≈ 75%
    assert out[1]['share_percent'] == pytest.approx(75.0)
    assert out[0]['share_percent'] == pytest.approx(25.0)
    # Сумма shipping в товарах = total shipping
    total_with_shipping = sum(it['with_shipping_usd'] for it in out)
    assert total_with_shipping == pytest.approx(100*10 + 100*30 + 400)
