from datetime import datetime, date

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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    product = db.relationship('Product', back_populates='sale_items')


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
    transaction_type = db.Column(db.String(50), nullable=False)  # income | expense
    amount_kzt = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(255), nullable=True)
    transaction_date = db.Column(db.Date, default=date.today)


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
