from datetime import datetime, date, timedelta

from sqlalchemy import inspect, text
from werkzeug.security import generate_password_hash

from app.models import db


class AppSetting(db.Model):
    __tablename__ = 'app_settings'
    key = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.String(255), nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Product(db.Model):
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), unique=True, nullable=False)
    tn_ved_code = db.Column(db.String(50), nullable=True)
    category = db.Column(db.String(100), nullable=False)
    unit = db.Column(db.String(50), default='шт')

    # Переменные процентные ставки (КРИТИЧНО — редактируются через UI)
    customs_duty_percent = db.Column(db.Float, default=0.12, nullable=False)
    vat_import_percent = db.Column(db.Float, default=0.12, nullable=False)
    vat_sale_percent = db.Column(db.Float, default=0.16, nullable=False)
    kpn_percent = db.Column(db.Float, default=0.10, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    import_items = db.relationship('ImportBatchItem', back_populates='product')
    sale_items = db.relationship('SaleItem', back_populates='product')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'name': self.name,
            'tn_ved_code': self.tn_ved_code,
            'category': self.category,
            'unit': self.unit,
            'customs_duty_percent': self.customs_duty_percent,
            'vat_import_percent': self.vat_import_percent,
            'vat_sale_percent': self.vat_sale_percent,
            'kpn_percent': self.kpn_percent,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class TaxSettingsHistory(db.Model):
    __tablename__ = 'tax_settings_history'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    field_name = db.Column(db.String(50), nullable=False)
    old_value = db.Column(db.Float, nullable=True)
    new_value = db.Column(db.Float, nullable=False)
    changed_by = db.Column(db.String(100), nullable=True)
    reason = db.Column(db.String(500), nullable=True)
    changed_at = db.Column(db.DateTime, default=datetime.utcnow)


class ImportBatch(db.Model):
    __tablename__ = 'import_batches'

    id = db.Column(db.Integer, primary_key=True)
    batch_number = db.Column(db.String(50), unique=True, nullable=False)
    invoice_number = db.Column(db.String(100), nullable=True)
    supplier_name = db.Column(db.String(255), nullable=True)

    shipping_cost_usd = db.Column(db.Float, default=0)
    additional_costs_kzt = db.Column(db.Float, default=0)
    exchange_rate = db.Column(db.Float, default=450.0)

    total_fob_usd = db.Column(db.Float, default=0)
    total_customs_duty_usd = db.Column(db.Float, default=0)
    total_vat_import_usd = db.Column(db.Float, default=0)
    total_cost_usd = db.Column(db.Float, default=0)
    total_cost_kzt = db.Column(db.Float, default=0)

    status = db.Column(db.String(50), default='draft')
    import_date = db.Column(db.Date, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = db.relationship('ImportBatchItem', back_populates='batch', cascade='all, delete-orphan')


class ImportBatchItem(db.Model):
    __tablename__ = 'import_batch_items'

    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('import_batches.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)

    quantity = db.Column(db.Integer, nullable=False)
    price_per_unit_usd = db.Column(db.Float, nullable=False)

    customs_duty_percent = db.Column(db.Float, nullable=False)
    vat_import_percent = db.Column(db.Float, nullable=False)

    fob_usd = db.Column(db.Float, default=0)
    customs_duty_usd = db.Column(db.Float, default=0)
    vat_import_usd = db.Column(db.Float, default=0)
    unit_cost_usd = db.Column(db.Float, default=0)
    unit_cost_kzt = db.Column(db.Float, default=0)

    batch = db.relationship('ImportBatch', back_populates='items')
    product = db.relationship('Product', back_populates='import_items')


class SaleItem(db.Model):
    __tablename__ = 'sale_items'

    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(100), nullable=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    customer_name = db.Column(db.String(255), nullable=True)

    quantity = db.Column(db.Integer, nullable=False)
    unit_price_kzt = db.Column(db.Float, nullable=False)
    unit_cost_kzt = db.Column(db.Float, nullable=False)

    total_revenue_kzt = db.Column(db.Float, default=0)
    total_cost_kzt = db.Column(db.Float, default=0)
    vat_input_kzt = db.Column(db.Float, default=0)
    vat_output_kzt = db.Column(db.Float, default=0)
    vat_to_pay_kzt = db.Column(db.Float, default=0)
    gross_margin_kzt = db.Column(db.Float, default=0)
    gross_margin_percent = db.Column(db.Float, default=0)
    kpn_tax_kzt = db.Column(db.Float, default=0)
    net_profit_kzt = db.Column(db.Float, default=0)

    sale_date = db.Column(db.Date, default=date.today)
    status = db.Column(db.String(50), default='sold')
    # Дебиторка: статус оплаты + плановая дата + фактически оплачено
    payment_status = db.Column(db.String(20), default='pending')  # paid | pending | overdue | partial
    due_date = db.Column(db.Date, nullable=True)
    paid_kzt = db.Column(db.Float, default=0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    product = db.relationship('Product', back_populates='sale_items')


class BudgetPlan(db.Model):
    """Плановые показатели по месяцам (для таба План vs Факт)."""
    __tablename__ = 'budget_plan'

    id = db.Column(db.Integer, primary_key=True)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)        # 1..12
    metric = db.Column(db.String(50), nullable=False)    # revenue | cost | gross_margin | net_profit | expenses_<cat>
    plan_kzt = db.Column(db.Float, nullable=False)

    __table_args__ = (db.UniqueConstraint('year', 'month', 'metric', name='uq_budget_year_month_metric'),)


class Account(db.Model):
    __tablename__ = 'accounts'

    id = db.Column(db.Integer, primary_key=True)
    account_number = db.Column(db.String(100), unique=True, nullable=False)
    bank_name = db.Column(db.String(255), nullable=True)
    account_type = db.Column(db.String(50), default='checking')
    currency = db.Column(db.String(3), default='KZT')
    balance = db.Column(db.Float, default=0)


class CashTransaction(db.Model):
    __tablename__ = 'cash_transactions'

    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=False)
    transaction_type = db.Column(db.String(50), nullable=False)   # income | expense | transfer
    category = db.Column(db.String(50), nullable=True)             # purchase | salary | rent | logistics | utilities | marketing | tax | other
    amount_kzt = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(255), nullable=True)
    counterparty = db.Column(db.String(255), nullable=True)
    transaction_date = db.Column(db.Date, default=date.today)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), default='analyst')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# ---------- SEED ----------

SEED_PRODUCTS = [
    {'name': 'Фильтр масляный',     'tn_ved_code': '8421.23', 'category': 'oil_filter',     'customs_duty_percent': 0.12, 'vat_import_percent': 0.12},
    {'name': 'Фильтр воздушный',    'tn_ved_code': '8421.31', 'category': 'air_filter',     'customs_duty_percent': 0.12, 'vat_import_percent': 0.12},
    {'name': 'Фильтр топливный',    'tn_ved_code': '8421.23', 'category': 'fuel_filter',    'customs_duty_percent': 0.12, 'vat_import_percent': 0.12},
    {'name': 'Фильтр салонный',     'tn_ved_code': '8421.39', 'category': 'cabin_filter',   'customs_duty_percent': 0.12, 'vat_import_percent': 0.12},
    {'name': 'Патрубок резиновый',  'tn_ved_code': '4009.31', 'category': 'rubber_hose',    'customs_duty_percent': 0.15, 'vat_import_percent': 0.12},
    {'name': 'Патрубок силиконовый','tn_ved_code': '4009.32', 'category': 'silicone_hose',  'customs_duty_percent': 0.20, 'vat_import_percent': 0.12},
]

SEED_ACCOUNTS = [
    {'account_number': 'KZ56125KZT0000001', 'bank_name': 'Kaspi Bank',  'currency': 'KZT', 'balance':  4_200_000},
    {'account_number': 'KZ89914KZT0000002', 'bank_name': 'Halyk Bank',  'currency': 'KZT', 'balance': 12_800_000},
    {'account_number': 'KZ24519KZT0000003', 'bank_name': 'BCC',         'currency': 'KZT', 'balance':  3_100_000},
    {'account_number': 'KZ13191USD0000004', 'bank_name': 'Halyk Bank',  'currency': 'USD', 'balance':     21_700},
]

SEED_USER = {
    'username': 'admin',
    'email': 'admin@tushun.kz',
    'password': 'admin123',
    'role': 'admin',
}

# Демо cash_transactions: реалистичные расходы и поступления за последний месяц
SEED_CASH_TX = [
    # account_idx (0-based), type, category, amount_kzt, description, counterparty, days_ago
    (0, 'income',  'sales',     3_420_000, 'Поступление по СФ-2026-101',         'ТОО АвтоАлмат',     1),
    (0, 'expense', 'purchase',  8_760_000, 'Оплата Tushun — партия #BATCH-2026-001', 'Tushun Co., Ltd', 2),
    (1, 'expense', 'salary',    4_120_000, 'Зарплата сотрудников — апрель',      'Сотрудники',         5),
    (2, 'income',  'sales',     1_850_000, 'Поступление по СФ-2026-105',         'СТО Рахмет',         6),
    (0, 'expense', 'logistics', 2_340_000, 'Таможня + морской фрахт',            'Брокер ТЭО',         7),
    (1, 'expense', 'rent',        950_000, 'Аренда склада Алматы — май',         'ИП Жанатов',         8),
    (1, 'expense', 'utilities',   180_000, 'Коммунальные платежи',               'Алматы Энерго',     10),
    (1, 'expense', 'marketing',   420_000, 'Реклама — Kaspi Reklama',            'Kaspi',             11),
    (0, 'income',  'sales',     5_680_000, 'Поступление по СФ-2026-103',         'АвтоПарк KZ',       13),
    (2, 'expense', 'tax',         706_676, 'НДС к уплате — апрель',              'Налоговая',         15),
    (1, 'expense', 'other',       320_000, 'Канцелярия + хоз.расходы',            'Прочие',            18),
    (0, 'income',  'sales',     2_212_000, 'Поступление по СФ-2026-100',         'AutoParts KZ',      20),
]


def _migrate_sqlite_columns() -> None:
    """SQLite не делает ALTER при db.create_all() — добавляем колонки вручную.

    Запускается при каждом старте; пропускает уже существующие колонки.
    """
    insp = inspect(db.engine)
    if 'sale_items' in insp.get_table_names():
        sale_cols = {c['name'] for c in insp.get_columns('sale_items')}
        with db.engine.begin() as conn:
            if 'payment_status' not in sale_cols:
                conn.execute(text("ALTER TABLE sale_items ADD COLUMN payment_status VARCHAR(20) DEFAULT 'pending'"))
            if 'due_date' not in sale_cols:
                conn.execute(text("ALTER TABLE sale_items ADD COLUMN due_date DATE"))
            if 'paid_kzt' not in sale_cols:
                conn.execute(text("ALTER TABLE sale_items ADD COLUMN paid_kzt FLOAT DEFAULT 0"))


def _seed_payment_statuses_and_due_dates() -> None:
    """Распределяет статусы оплаты + дату продажи + срок оплаты по существующим продажам.

    Применяется только если sale_date у всех продаж == today (то есть seed
    из API ещё не разносил их по датам). После первого запуска
    sale_date становятся разными и функция больше не трогает их.
    """
    sales = SaleItem.query.order_by(SaleItem.id).all()
    today = date.today()
    # Если хоть одна продажа уже разнесена по дате — пропускаем (idempotent seed)
    if not sales or any(s.sale_date != today for s in sales):
        return

    # (status, sale_offset, due_offset) — оба относительно today
    # Кредит ~30 дней, статус определяется логически
    plan = [
        ('paid',    -25, +5),
        ('paid',    -22, +8),
        ('paid',    -20, +10),
        ('pending', -18, +12),
        ('pending', -10, +20),
        ('overdue', -15, -5),
        ('overdue', -28, -18),
    ]
    for sale, (status, sale_offset, due_offset) in zip(sales, plan):
        sale.payment_status = status
        sale.sale_date = today + timedelta(days=sale_offset)
        sale.due_date = today + timedelta(days=due_offset)
        if status == 'paid':
            sale.paid_kzt = sale.total_revenue_kzt
    db.session.commit()


SEED_BUDGET_2026 = [
    # year, month, metric, plan_kzt
    # Доход
    (2026, 4, 'revenue',     14_000_000),
    (2026, 5, 'revenue',     20_000_000),
    # Себестоимость
    (2026, 4, 'cost',         9_500_000),
    (2026, 5, 'cost',        13_500_000),
    # Валовая маржа
    (2026, 4, 'gross_margin', 4_500_000),
    (2026, 5, 'gross_margin', 6_500_000),
    # Чистая прибыль
    (2026, 4, 'net_profit',   3_200_000),
    (2026, 5, 'net_profit',   4_500_000),
    # Расходные категории
    (2026, 5, 'expenses_purchase',    9_000_000),
    (2026, 5, 'expenses_salary',      4_200_000),
    (2026, 5, 'expenses_logistics',   2_400_000),
    (2026, 5, 'expenses_rent',        1_000_000),
    (2026, 5, 'expenses_marketing',     400_000),
    (2026, 5, 'expenses_utilities',     200_000),
    (2026, 5, 'expenses_tax',           750_000),
    (2026, 5, 'expenses_other',         300_000),
]


def seed_initial_data() -> None:
    if Product.query.count() == 0:
        for p in SEED_PRODUCTS:
            db.session.add(Product(**p, vat_sale_percent=0.16, kpn_percent=0.10))
    if Account.query.count() == 0:
        for a in SEED_ACCOUNTS:
            db.session.add(Account(**a))
    if User.query.count() == 0:
        db.session.add(User(
            username=SEED_USER['username'],
            email=SEED_USER['email'],
            password_hash=generate_password_hash(SEED_USER['password'], method='pbkdf2:sha256'),
            role=SEED_USER['role'],
        ))
    if not AppSetting.query.get('exchange_rate_usd_kzt'):
        db.session.add(AppSetting(key='exchange_rate_usd_kzt', value='450'))
    db.session.commit()

    # Cash transactions seed — после accounts чтобы id были известны
    if CashTransaction.query.count() == 0:
        accounts = Account.query.order_by(Account.id).all()
        today = date.today()
        for acc_idx, ttype, cat, amount, desc, party, days_ago in SEED_CASH_TX:
            if acc_idx >= len(accounts):
                continue
            db.session.add(CashTransaction(
                account_id=accounts[acc_idx].id,
                transaction_type=ttype,
                category=cat,
                amount_kzt=amount,
                description=desc,
                counterparty=party,
                transaction_date=today - timedelta(days=days_ago),
            ))
        db.session.commit()

    # SQLite ALTER миграция — для уже существующей БД с продажами
    _migrate_sqlite_columns()

    # Budget plan seed
    if BudgetPlan.query.count() == 0:
        for y, m, metric, plan in SEED_BUDGET_2026:
            db.session.add(BudgetPlan(year=y, month=m, metric=metric, plan_kzt=plan))
        db.session.commit()

    # Дебиторка — раскрашиваем статусы существующих продаж
    if SaleItem.query.count() > 0:
        _seed_payment_statuses_and_due_dates()
