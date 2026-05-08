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

    status = db.Column(db.String(50), default='draft')  # draft|in_transit|arrived|completed|cancelled
    import_date = db.Column(db.Date, nullable=True)

    # Module 4 — отслеживание грузов
    tracking_number = db.Column(db.String(100), nullable=True)
    eta_date = db.Column(db.Date, nullable=True)
    arrival_date = db.Column(db.Date, nullable=True)
    destination_warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'), nullable=True)
    stock_in_created = db.Column(db.Boolean, default=False)  # флаг для предотвращения двойных приходов

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = db.relationship('ImportBatchItem', back_populates='batch', cascade='all, delete-orphan')
    destination_warehouse = db.relationship('Warehouse')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'batch_number': self.batch_number,
            'invoice_number': self.invoice_number,
            'supplier_name': self.supplier_name,
            'shipping_cost_usd': self.shipping_cost_usd,
            'additional_costs_kzt': self.additional_costs_kzt,
            'exchange_rate': self.exchange_rate,
            'total_fob_usd': self.total_fob_usd,
            'total_customs_duty_usd': self.total_customs_duty_usd,
            'total_vat_import_usd': self.total_vat_import_usd,
            'total_cost_usd': self.total_cost_usd,
            'total_cost_kzt': self.total_cost_kzt,
            'status': self.status,
            'import_date': self.import_date.isoformat() if self.import_date else None,
            'tracking_number': self.tracking_number,
            'eta_date': self.eta_date.isoformat() if self.eta_date else None,
            'arrival_date': self.arrival_date.isoformat() if self.arrival_date else None,
            'destination_warehouse_id': self.destination_warehouse_id,
            'destination_warehouse_name': self.destination_warehouse.name if self.destination_warehouse else None,
            'stock_in_created': bool(self.stock_in_created),
            'items_count': len(self.items),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


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
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=True)  # Module 3 link
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)  # Module 3 link
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
    invoice = db.relationship('Invoice', back_populates='items')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'invoice_number': self.invoice_number,
            'invoice_id': self.invoice_id,
            'customer_id': self.customer_id,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else None,
            'customer_name': self.customer_name,
            'quantity': self.quantity,
            'unit_price_kzt': self.unit_price_kzt,
            'unit_cost_kzt': self.unit_cost_kzt,
            'total_revenue_kzt': self.total_revenue_kzt,
            'total_cost_kzt': self.total_cost_kzt,
            'vat_to_pay_kzt': self.vat_to_pay_kzt,
            'gross_margin_kzt': self.gross_margin_kzt,
            'gross_margin_percent': self.gross_margin_percent,
            'net_profit_kzt': self.net_profit_kzt,
            'sale_date': self.sale_date.isoformat() if self.sale_date else None,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'payment_status': self.payment_status,
            'paid_kzt': self.paid_kzt or 0,
        }


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
    expense_category_id = db.Column(db.Integer, db.ForeignKey('expense_categories.id'), nullable=True)  # Module 7 link
    amount_kzt = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(255), nullable=True)
    counterparty = db.Column(db.String(255), nullable=True)
    transaction_date = db.Column(db.Date, default=date.today)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    expense_category = db.relationship('ExpenseCategory')


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), default='analyst')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Warehouse(db.Model):
    __tablename__ = 'warehouses'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    city = db.Column(db.String(50), nullable=False)
    address = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    movements = db.relationship('StockMovement', back_populates='warehouse')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'city': self.city,
            'address': self.address,
            'is_active': self.is_active,
        }


class Customer(db.Model):
    """Справочник клиентов (Module 3)."""
    __tablename__ = 'customers'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(50), nullable=True)
    email = db.Column(db.String(255), nullable=True)
    address = db.Column(db.String(500), nullable=True)
    tax_id = db.Column(db.String(50), nullable=True)  # БИН/ИИН
    customer_type = db.Column(db.String(20), default='b2b')   # b2b | b2c
    status = db.Column(db.String(20), default='active')        # active | inactive | blocked
    discount_percent = db.Column(db.Float, default=0)
    credit_limit_kzt = db.Column(db.Float, default=0)
    notes = db.Column(db.String(1000), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    invoices = db.relationship('Invoice', back_populates='customer')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'name': self.name,
            'phone': self.phone,
            'email': self.email,
            'address': self.address,
            'tax_id': self.tax_id,
            'customer_type': self.customer_type,
            'status': self.status,
            'discount_percent': self.discount_percent,
            'credit_limit_kzt': self.credit_limit_kzt,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Invoice(db.Model):
    """Счёт-фактура (хедер). Линии = sale_items, связаны через invoice_id."""
    __tablename__ = 'invoices'

    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(100), unique=True, nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    issue_date = db.Column(db.Date, default=date.today)
    due_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(20), default='draft')  # draft | issued | paid | partially_paid | overdue | cancelled
    total_kzt = db.Column(db.Float, default=0)         # денормализован, рассчитывается из sale_items
    paid_kzt = db.Column(db.Float, default=0)          # денормализован, рассчитывается из payments
    notes = db.Column(db.String(1000), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    customer = db.relationship('Customer', back_populates='invoices')
    items = db.relationship('SaleItem', back_populates='invoice')
    payments = db.relationship('Payment', back_populates='invoice', cascade='all, delete-orphan')

    def to_dict(self, with_items: bool = False) -> dict:
        outstanding = max(0, (self.total_kzt or 0) - (self.paid_kzt or 0))
        d = {
            'id': self.id,
            'invoice_number': self.invoice_number,
            'customer_id': self.customer_id,
            'customer_name': self.customer.name if self.customer else None,
            'issue_date': self.issue_date.isoformat() if self.issue_date else None,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'status': self.status,
            'total_kzt': self.total_kzt or 0,
            'paid_kzt': self.paid_kzt or 0,
            'outstanding_kzt': outstanding,
            'notes': self.notes,
            'items_count': len(self.items),
        }
        if with_items:
            d['items'] = [i.to_dict() for i in self.items]
            d['payments'] = [p.to_dict() for p in self.payments]
        return d


class Payment(db.Model):
    """Платёж по счёту."""
    __tablename__ = 'payments'

    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=False)
    amount_kzt = db.Column(db.Float, nullable=False)
    payment_date = db.Column(db.Date, default=date.today)
    method = db.Column(db.String(20), default='bank')  # bank | cash | kaspi | card | other
    reference = db.Column(db.String(100), nullable=True)  # № платёжки / чек
    notes = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    invoice = db.relationship('Invoice', back_populates='payments')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'invoice_id': self.invoice_id,
            'invoice_number': self.invoice.invoice_number if self.invoice else None,
            'amount_kzt': self.amount_kzt,
            'payment_date': self.payment_date.isoformat() if self.payment_date else None,
            'method': self.method,
            'reference': self.reference,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class StockMovement(db.Model):
    __tablename__ = 'stock_movements'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'), nullable=False)
    movement_type = db.Column(db.String(20), nullable=False)  # in | out | transfer_in | transfer_out | adjustment
    quantity = db.Column(db.Integer, nullable=False)  # положительное (in) или отрицательное (out)
    document_ref = db.Column(db.String(100), nullable=True)  # номер инвойса/СФ
    counterparty = db.Column(db.String(255), nullable=True)
    note = db.Column(db.String(500), nullable=True)
    movement_date = db.Column(db.Date, default=date.today)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.String(100), nullable=True)

    product = db.relationship('Product')
    warehouse = db.relationship('Warehouse', back_populates='movements')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else None,
            'warehouse_id': self.warehouse_id,
            'warehouse_name': self.warehouse.name if self.warehouse else None,
            'movement_type': self.movement_type,
            'quantity': self.quantity,
            'document_ref': self.document_ref,
            'counterparty': self.counterparty,
            'note': self.note,
            'movement_date': self.movement_date.isoformat() if self.movement_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'created_by': self.created_by,
        }


class TelegramUser(db.Model):
    """Подписчики Telegram-бота (Module 8)."""
    __tablename__ = 'telegram_users'

    id = db.Column(db.Integer, primary_key=True)
    tg_user_id = db.Column(db.BigInteger, unique=True, nullable=False)  # Telegram ID
    chat_id = db.Column(db.BigInteger, nullable=False)
    username = db.Column(db.String(100), nullable=True)
    full_name = db.Column(db.String(255), nullable=True)
    role = db.Column(db.String(20), default='viewer')          # admin | manager | viewer
    notifications_enabled = db.Column(db.Boolean, default=True)
    subscriptions = db.Column(db.String(255), default='alerts')  # comma-separated: alerts,sales,expenses,daily
    language = db.Column(db.String(5), default='ru')
    is_active = db.Column(db.Boolean, default=True)
    last_command = db.Column(db.String(100), nullable=True)
    last_seen = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self) -> dict:
        subs = [s.strip() for s in (self.subscriptions or '').split(',') if s.strip()]
        return {
            'id': self.id,
            'tg_user_id': self.tg_user_id,
            'chat_id': self.chat_id,
            'username': self.username,
            'full_name': self.full_name,
            'role': self.role,
            'notifications_enabled': self.notifications_enabled,
            'subscriptions': subs,
            'language': self.language,
            'is_active': self.is_active,
            'last_command': self.last_command,
            'last_seen': self.last_seen.isoformat() if self.last_seen else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class ExpenseCategory(db.Model):
    """Категории расходов (Module 7) — справочник для cash_transactions типа expense."""
    __tablename__ = 'expense_categories'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False)  # для маппинга со старым cash_transactions.category
    name = db.Column(db.String(100), nullable=False)
    color = db.Column(db.String(20), default='#d4af37')           # для UI визуализации
    icon = db.Column(db.String(20), nullable=True)                # эмодзи или иконка
    description = db.Column(db.String(255), nullable=True)
    monthly_limit_kzt = db.Column(db.Float, default=0)            # дефолтный лимит в месяц
    alert_percent = db.Column(db.Float, default=80)               # alert при достижении X% лимита
    is_active = db.Column(db.Boolean, default=True)
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'color': self.color,
            'icon': self.icon,
            'description': self.description,
            'monthly_limit_kzt': self.monthly_limit_kzt,
            'alert_percent': self.alert_percent,
            'is_active': self.is_active,
            'sort_order': self.sort_order,
        }


class ExpenseBudget(db.Model):
    """Бюджет на категорию по месяцам (Module 7).

    Отличается от существующего BudgetPlan (который для P&L total): здесь — план
    на каждую категорию расходов в конкретном месяце.
    """
    __tablename__ = 'expense_budgets'

    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey('expense_categories.id'), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)        # 1..12
    limit_amount_kzt = db.Column(db.Float, nullable=False)
    alert_percent = db.Column(db.Float, default=80)      # переопределение alert per-month (если нужно)
    note = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    category = db.relationship('ExpenseCategory')

    __table_args__ = (
        db.UniqueConstraint('category_id', 'year', 'month', name='uq_expense_budget_cat_year_month'),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'category_id': self.category_id,
            'category_name': self.category.name if self.category else None,
            'category_color': self.category.color if self.category else None,
            'year': self.year,
            'month': self.month,
            'limit_amount_kzt': self.limit_amount_kzt,
            'alert_percent': self.alert_percent,
            'note': self.note,
        }


class WarrantyPlan(db.Model):
    """Гарантийные планы на товары (Module 6)."""
    __tablename__ = 'warranty_plans'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    months = db.Column(db.Integer, nullable=False)              # срок гарантии в месяцах
    coverage_percent = db.Column(db.Float, default=100)         # 100 = полное возмещение, <100 = частичное
    price_kzt = db.Column(db.Float, default=0)                  # доплата за гарантию (0 = бесплатная)
    description = db.Column(db.String(500), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product = db.relationship('Product')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else None,
            'category': self.product.category if self.product else None,
            'name': self.name,
            'months': self.months,
            'coverage_percent': self.coverage_percent,
            'price_kzt': self.price_kzt,
            'description': self.description,
            'is_active': self.is_active,
        }


class WarrantyClaim(db.Model):
    """Рекламации/гарантийные случаи (Module 6)."""
    __tablename__ = 'warranty_claims'

    id = db.Column(db.Integer, primary_key=True)
    claim_number = db.Column(db.String(50), unique=True, nullable=False)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=True)  # ссылка на счёт
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    customer_name = db.Column(db.String(255), nullable=True)  # дублируем для случаев без customer_id
    quantity = db.Column(db.Integer, default=1)
    claim_type = db.Column(db.String(20), default='defect')   # defect | damage | wrong_item | other
    description = db.Column(db.String(1000), nullable=True)
    status = db.Column(db.String(20), default='open')          # open | in_review | resolved | rejected
    resolution = db.Column(db.String(500), nullable=True)
    claim_date = db.Column(db.Date, default=date.today)
    resolved_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product = db.relationship('Product')
    invoice = db.relationship('Invoice')
    customer = db.relationship('Customer')
    returns = db.relationship('WarrantyReturn', back_populates='claim', cascade='all, delete-orphan')

    def to_dict(self) -> dict:
        # Время разрешения в днях (или None если открыта)
        resolution_days = None
        if self.resolved_date and self.claim_date:
            resolution_days = (self.resolved_date - self.claim_date).days
        return {
            'id': self.id,
            'claim_number': self.claim_number,
            'invoice_id': self.invoice_id,
            'invoice_number': self.invoice.invoice_number if self.invoice else None,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else None,
            'customer_id': self.customer_id,
            'customer_name': self.customer.name if self.customer else self.customer_name,
            'quantity': self.quantity,
            'claim_type': self.claim_type,
            'description': self.description,
            'status': self.status,
            'resolution': self.resolution,
            'claim_date': self.claim_date.isoformat() if self.claim_date else None,
            'resolved_date': self.resolved_date.isoformat() if self.resolved_date else None,
            'resolution_days': resolution_days,
            'returns_count': len(self.returns),
        }


class WarrantyReturn(db.Model):
    """Возвраты по гарантийным случаям (Module 6)."""
    __tablename__ = 'warranty_returns'

    id = db.Column(db.Integer, primary_key=True)
    claim_id = db.Column(db.Integer, db.ForeignKey('warranty_claims.id'), nullable=False)
    quantity = db.Column(db.Integer, default=1)
    reason = db.Column(db.String(500), nullable=True)
    refund_amount_kzt = db.Column(db.Float, default=0)
    refund_method = db.Column(db.String(20), default='cash')   # cash | bank | exchange | credit
    return_date = db.Column(db.Date, default=date.today)
    status = db.Column(db.String(20), default='pending')       # pending | approved | refunded | rejected
    note = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    claim = db.relationship('WarrantyClaim', back_populates='returns')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'claim_id': self.claim_id,
            'claim_number': self.claim.claim_number if self.claim else None,
            'product_name': self.claim.product.name if (self.claim and self.claim.product) else None,
            'customer_name': self.claim.customer_name if self.claim else None,
            'quantity': self.quantity,
            'reason': self.reason,
            'refund_amount_kzt': self.refund_amount_kzt,
            'refund_method': self.refund_method,
            'return_date': self.return_date.isoformat() if self.return_date else None,
            'status': self.status,
            'note': self.note,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class ExchangeRate(db.Model):
    """История курсов валют (Module 5)."""
    __tablename__ = 'exchange_rates'

    id = db.Column(db.Integer, primary_key=True)
    base_currency = db.Column(db.String(3), nullable=False)
    target_currency = db.Column(db.String(3), nullable=False)
    rate = db.Column(db.Float, nullable=False)
    rate_date = db.Column(db.Date, default=date.today, nullable=False)
    source = db.Column(db.String(50), default='manual')  # manual | nbk | xe | api
    note = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('base_currency', 'target_currency', 'rate_date',
                            name='uq_rate_base_target_date'),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'base_currency': self.base_currency,
            'target_currency': self.target_currency,
            'rate': self.rate,
            'rate_date': self.rate_date.isoformat() if self.rate_date else None,
            'source': self.source,
            'note': self.note,
        }


class Premium(db.Model):
    """Премии и бонусы (Module 5)."""
    __tablename__ = 'premiums'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    premium_type = db.Column(db.String(20), default='fixed')  # fixed | percent
    amount = db.Column(db.Float, nullable=False)              # KZT для fixed, % для percent
    description = db.Column(db.String(500), nullable=True)
    period = db.Column(db.String(50), nullable=True)          # monthly | quarterly | yearly | one-time
    target_role = db.Column(db.String(50), nullable=True)     # sales | warehouse | management | all
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'name': self.name,
            'premium_type': self.premium_type,
            'amount': self.amount,
            'description': self.description,
            'period': self.period,
            'target_role': self.target_role,
            'is_active': self.is_active,
        }


class Commission(db.Model):
    """Комиссии — % от транзакции (Module 5)."""
    __tablename__ = 'commissions'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    commission_type = db.Column(db.String(30), default='sales')  # sales | service | returns | logistics
    percent = db.Column(db.Float, nullable=False)               # % от суммы
    min_amount_kzt = db.Column(db.Float, default=0)             # минимум суммы для применения
    max_amount_kzt = db.Column(db.Float, nullable=True)          # cap
    description = db.Column(db.String(500), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'name': self.name,
            'commission_type': self.commission_type,
            'percent': self.percent,
            'min_amount_kzt': self.min_amount_kzt,
            'max_amount_kzt': self.max_amount_kzt,
            'description': self.description,
            'is_active': self.is_active,
        }


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

SEED_WAREHOUSES = [
    {'code': 'ALA', 'name': 'Склад Алматы', 'city': 'Алматы', 'address': 'мкр. Айнабулак, ул. Промышленная 12'},
    {'code': 'NQZ', 'name': 'Склад Астана', 'city': 'Астана', 'address': 'пр. Кабанбай батыра 47'},
]

SEED_TELEGRAM_USERS = [
    # (tg_user_id, chat_id, username, full_name, role, subs, language, last_command, last_seen_days_ago)
    (123456789, 123456789, 'amrekabilash',  'Амреахавлаш Кабилаш',
     'admin',   'alerts,sales,expenses,daily', 'ru', '/status',  0),
    (234567890, 234567890, 'manager_kz',    'Дина Сейтжанова',
     'manager', 'alerts,sales',                'ru', '/sales',   1),
    (345678901, 345678901, 'analyst_team',  'Игорь Петров',
     'viewer',  'alerts',                      'ru', '/alerts',  3),
]

SEED_EXPENSE_CATEGORIES = [
    # (code, name, color, icon, monthly_limit, alert%, sort)
    ('salary',     'Зарплата',      '#5fa8ff', '👥', 5_000_000, 90, 1),
    ('rent',       'Аренда',        '#d4af37', '🏢', 1_500_000, 95, 2),
    ('utilities',  'Коммуналка',    '#22c55e', '💡',   300_000, 80, 3),
    ('marketing',  'Маркетинг',     '#fbbf24', '📢',   600_000, 70, 4),
    ('logistics',  'Логистика',     '#ef4444', '🚚', 3_000_000, 85, 5),
    ('purchase',   'Закупки товара','#a855f7', '📦', 12_000_000, 95, 6),
    ('tax',        'Налоги',        '#06b6d4', '📊', 1_000_000, 100, 7),
    ('other',      'Прочее',        '#9ca3af', '📁',   500_000, 80, 8),
]

SEED_WARRANTY_PLANS = [
    # (product_idx, name, months, coverage_percent, price_kzt, description, is_active)
    (0, 'Стандартная гарантия 12 мес.',  12, 100,    0,    'Полное возмещение при заводском браке',                       True),
    (1, 'Расширенная гарантия 24 мес.',  24, 100,    1500, 'Защита от заводских дефектов и неправильной установки',       True),
    (2, 'Премиум гарантия 36 мес.',      36,  80,    3500, 'Покрытие 80% стоимости, включая износ',                       True),
    (3, 'Базовая 6 мес. (б/у запчасти)',  6,  50,    0,    'Только заводской брак, 50% возмещение',                       False),
]

# (claim_idx, customer_idx, product_idx, qty, type, status, claim_days_ago, resolved_days_ago, description, resolution)
SEED_WARRANTY_CLAIMS = [
    # Закрытые (resolved)
    ('РК-2026-001', 0, 0, 2, 'defect',     'resolved', 25, 18, 'Течь масла из-под прокладки фильтра, 2 шт.',
     'Произведена замена бракованных фильтров. Возврат денег не требуется.'),
    ('РК-2026-002', 1, 1, 1, 'wrong_item', 'resolved', 20, 15, 'Получили фильтр другой модели вместо заказанного',
     'Обмен на правильный товар выполнен.'),
    ('РК-2026-003', 2, 2, 5, 'defect',     'resolved', 18, 10, 'Партия фильтров с неисправной мембраной',
     'Полный возврат стоимости через банковский перевод.'),
    ('РК-2026-004', 3, 0, 1, 'damage',     'resolved', 14,  7, 'Повреждение упаковки при доставке',
     'Скидка 50% на следующую покупку взамен возврата.'),
    # В работе
    ('РК-2026-005', 4, 4, 3, 'defect',     'in_review', 8,  None, 'Патрубки лопаются при высокой температуре. На экспертизе.',
     None),
    ('РК-2026-006', 0, 5, 2, 'defect',     'in_review', 5,  None, 'Силиконовые патрубки с трещинами после 1 месяца',
     None),
    # Открытые
    ('РК-2026-007', 1, 3, 1, 'wrong_item', 'open',      3,  None, 'Не тот размер фильтра салона',
     None),
    ('РК-2026-008', 4, 1, 2, 'defect',     'open',      1,  None, 'Воздушный фильтр забивается за неделю',
     None),
]

# (claim_idx 0-based в массиве выше, qty, reason, refund_kzt, method, status, days_ago, note)
SEED_WARRANTY_RETURNS = [
    # Возвраты по resolved претензиям
    (2, 5, 'Заводской брак партии', 75_000, 'bank',     'refunded', 10, 'Полный возврат на счёт клиента'),
    (3, 1, 'Повреждение упаковки',  10_000, 'credit',   'refunded',  7, 'Скидка 50% на след. покупку'),
    (0, 2, 'Заводской брак',        24_000, 'exchange', 'refunded', 18, 'Замена на новые фильтры'),
    (1, 1, 'Неправильный товар',    18_000, 'exchange', 'refunded', 15, 'Обмен'),
    # Возврат по in_review
    (4, 3, 'Дефект патрубков',      75_000, 'bank',     'pending',   2, 'Ждём результаты экспертизы'),
]

SEED_EXCHANGE_RATES = [
    # (base, target, rate, days_ago, source) — история за последние 30 дней
    # USD → KZT
    ('USD', 'KZT', 442.50, 30, 'nbk'),
    ('USD', 'KZT', 444.10, 25, 'nbk'),
    ('USD', 'KZT', 446.30, 20, 'nbk'),
    ('USD', 'KZT', 448.70, 15, 'nbk'),
    ('USD', 'KZT', 450.20, 10, 'nbk'),
    ('USD', 'KZT', 452.00, 5,  'nbk'),
    ('USD', 'KZT', 451.30, 0,  'nbk'),
    # EUR → KZT
    ('EUR', 'KZT', 478.80, 20, 'nbk'),
    ('EUR', 'KZT', 482.40, 10, 'nbk'),
    ('EUR', 'KZT', 488.50, 0,  'nbk'),
    # CNY → KZT
    ('CNY', 'KZT', 61.20,  20, 'nbk'),
    ('CNY', 'KZT', 62.10,  10, 'nbk'),
    ('CNY', 'KZT', 62.80,  0,  'nbk'),
    # RUB → KZT
    ('RUB', 'KZT', 4.85,   10, 'nbk'),
    ('RUB', 'KZT', 4.92,   0,  'nbk'),
]

SEED_PREMIUMS = [
    {'name': 'Квартальный бонус продаж',  'premium_type': 'percent', 'amount': 5.0,
     'description': '5% от чистой прибыли отдела продаж за квартал',
     'period': 'quarterly', 'target_role': 'sales',     'is_active': True},
    {'name': 'Выслуга лет',                'premium_type': 'fixed',   'amount': 50_000,
     'description': '50 000 ₸ за каждый полный год работы',
     'period': 'yearly',    'target_role': 'all',       'is_active': True},
    {'name': 'Спецпроект (Tushun-Asia)',  'premium_type': 'fixed',   'amount': 200_000,
     'description': 'Разовая премия за расширение в новый регион',
     'period': 'one-time',  'target_role': 'management','is_active': True},
    {'name': 'Бонус за безаварийность',    'premium_type': 'fixed',   'amount': 30_000,
     'description': 'Месячный бонус для склада за отсутствие потерь',
     'period': 'monthly',   'target_role': 'warehouse', 'is_active': False},
]

SEED_COMMISSIONS = [
    {'name': 'Комиссия за продажи (стандарт)', 'commission_type': 'sales',
     'percent': 2.0, 'min_amount_kzt': 0, 'max_amount_kzt': None,
     'description': '2% от выручки по сделке для менеджера',
     'is_active': True},
    {'name': 'Комиссия за услуги доставки',     'commission_type': 'logistics',
     'percent': 5.0, 'min_amount_kzt': 50_000, 'max_amount_kzt': 500_000,
     'description': '5% сверху на доставку, max 500K ₸',
     'is_active': True},
    {'name': 'Комиссия за возврат',             'commission_type': 'returns',
     'percent': 1.5, 'min_amount_kzt': 0, 'max_amount_kzt': None,
     'description': 'Удержание 1.5% при возврате товара',
     'is_active': True},
    {'name': 'Сервисный сбор (платный сервис)', 'commission_type': 'service',
     'percent': 3.0, 'min_amount_kzt': 100_000, 'max_amount_kzt': None,
     'description': '3% за дополнительные услуги (от 100K ₸)',
     'is_active': True},
]

SEED_CUSTOMERS = [
    {'name': 'ТОО АвтоАлмат',     'phone': '+7 727 234 56 78', 'email': 'info@autoalmat.kz', 'tax_id': '050340012345',
     'address': 'г. Алматы, ул. Толе би 247', 'customer_type': 'b2b', 'status': 'active',
     'discount_percent': 5, 'credit_limit_kzt': 8_000_000, 'notes': 'Постоянный клиент с 2024'},
    {'name': 'СТО Рахмет',        'phone': '+7 727 345 67 89', 'email': 'rahmet@gmail.com', 'tax_id': '050240098765',
     'address': 'г. Алматы, мкр. Аксай-3, д. 12', 'customer_type': 'b2b', 'status': 'active',
     'discount_percent': 3, 'credit_limit_kzt': 3_000_000, 'notes': 'Сеть автосервисов'},
    {'name': 'АвтоПарк KZ',       'phone': '+7 717 456 78 90', 'email': 'sales@autopark.kz', 'tax_id': '010240054321',
     'address': 'г. Астана, пр. Республики 56', 'customer_type': 'b2b', 'status': 'active',
     'discount_percent': 7, 'credit_limit_kzt': 12_000_000, 'notes': 'Крупный дистрибьютор Астана'},
    {'name': 'AutoParts KZ',      'phone': '+7 727 567 89 01', 'email': 'order@autoparts.kz', 'tax_id': '050340076543',
     'address': 'г. Алматы, пр. Райымбека 480', 'customer_type': 'b2b', 'status': 'active',
     'discount_percent': 4, 'credit_limit_kzt': 5_000_000, 'notes': None},
    {'name': 'ТОО МастерСервис',  'phone': '+7 727 678 90 12', 'email': 'master@srv.kz', 'tax_id': '050240087654',
     'address': 'г. Алматы, ул. Сейфуллина 458', 'customer_type': 'b2b', 'status': 'active',
     'discount_percent': 2, 'credit_limit_kzt': 4_000_000, 'notes': 'Иногда задержки оплаты'},
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
            # Module 3 FK columns
            if 'invoice_id' not in sale_cols:
                conn.execute(text("ALTER TABLE sale_items ADD COLUMN invoice_id INTEGER"))
            if 'customer_id' not in sale_cols:
                conn.execute(text("ALTER TABLE sale_items ADD COLUMN customer_id INTEGER"))

    # Module 7: FK на expense_categories в cash_transactions
    if 'cash_transactions' in insp.get_table_names():
        ct_cols = {c['name'] for c in insp.get_columns('cash_transactions')}
        with db.engine.begin() as conn:
            if 'expense_category_id' not in ct_cols:
                conn.execute(text("ALTER TABLE cash_transactions ADD COLUMN expense_category_id INTEGER"))

    # Module 4: расширение import_batches
    if 'import_batches' in insp.get_table_names():
        ib_cols = {c['name'] for c in insp.get_columns('import_batches')}
        with db.engine.begin() as conn:
            if 'tracking_number' not in ib_cols:
                conn.execute(text("ALTER TABLE import_batches ADD COLUMN tracking_number VARCHAR(100)"))
            if 'eta_date' not in ib_cols:
                conn.execute(text("ALTER TABLE import_batches ADD COLUMN eta_date DATE"))
            if 'arrival_date' not in ib_cols:
                conn.execute(text("ALTER TABLE import_batches ADD COLUMN arrival_date DATE"))
            if 'destination_warehouse_id' not in ib_cols:
                conn.execute(text("ALTER TABLE import_batches ADD COLUMN destination_warehouse_id INTEGER"))
            if 'stock_in_created' not in ib_cols:
                conn.execute(text("ALTER TABLE import_batches ADD COLUMN stock_in_created BOOLEAN DEFAULT 0"))


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
    if Warehouse.query.count() == 0:
        for w in SEED_WAREHOUSES:
            db.session.add(Warehouse(**w))
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

    # Демо-движения по складам (только при первом запуске)
    if StockMovement.query.count() == 0:
        _seed_stock_movements()

    # Module 3: customers + invoices + payments
    if Customer.query.count() == 0:
        for c in SEED_CUSTOMERS:
            db.session.add(Customer(**c))
        db.session.commit()

    if Invoice.query.count() == 0:
        _seed_invoices_and_payments()

    # Module 5: exchange rates + premiums + commissions
    if ExchangeRate.query.count() == 0:
        today = date.today()
        for base, target, rate, days_ago, source in SEED_EXCHANGE_RATES:
            db.session.add(ExchangeRate(
                base_currency=base, target_currency=target, rate=rate,
                rate_date=today - timedelta(days=days_ago), source=source,
            ))
        db.session.commit()

    if Premium.query.count() == 0:
        for p in SEED_PREMIUMS:
            db.session.add(Premium(**p))
        db.session.commit()

    if Commission.query.count() == 0:
        for c in SEED_COMMISSIONS:
            db.session.add(Commission(**c))
        db.session.commit()

    # Module 6: warranty plans + claims + returns
    if WarrantyPlan.query.count() == 0:
        _seed_warranties()

    # Module 7: expense categories + budgets + auto-link cash_transactions
    if ExpenseCategory.query.count() == 0:
        _seed_expense_categories_and_budgets()

    # Module 8: Telegram users
    if TelegramUser.query.count() == 0:
        today = date.today()
        for tg_id, chat_id, username, full_name, role, subs, lang, cmd, days_ago in SEED_TELEGRAM_USERS:
            db.session.add(TelegramUser(
                tg_user_id=tg_id, chat_id=chat_id,
                username=username, full_name=full_name,
                role=role, subscriptions=subs, language=lang,
                notifications_enabled=True, is_active=True,
                last_command=cmd,
                last_seen=datetime.utcnow() - timedelta(days=days_ago),
            ))
        db.session.commit()


def _seed_stock_movements() -> None:
    """Seed: распределяем демо-приход 6 товаров на 2 склада."""
    products = Product.query.order_by(Product.id).all()
    warehouses = Warehouse.query.order_by(Warehouse.id).all()
    if not products or not warehouses:
        return

    today = date.today()
    # (product_idx, warehouse_idx, qty, days_ago, type)
    plan = [
        # Партия #1 — поступила 14 дней назад на оба склада
        (0, 0, 200, 14, 'in'),  (0, 1, 80, 14, 'in'),
        (1, 0, 150, 14, 'in'),  (1, 1, 60, 14, 'in'),
        (2, 0, 180, 14, 'in'),  (2, 1, 70, 14, 'in'),
        (3, 0, 120, 14, 'in'),  (3, 1, 50, 14, 'in'),
        (4, 0,  80, 14, 'in'),  (4, 1, 30, 14, 'in'),
        (5, 0,  60, 14, 'in'),  (5, 1, 20, 14, 'in'),
        # Расходы (продажи) за последние 10 дней
        (0, 0, 35, 9, 'out'),  (0, 0, 28, 5, 'out'),  (0, 1, 15, 7, 'out'),
        (1, 0, 22, 8, 'out'),  (1, 1, 10, 4, 'out'),
        (2, 0, 30, 6, 'out'),  (2, 0, 18, 2, 'out'),
        (3, 0, 25, 3, 'out'),  (3, 1, 8,  6, 'out'),
        (4, 0, 12, 5, 'out'),  (4, 1, 4,  3, 'out'),
        (5, 0, 8,  4, 'out'),
        # Перемещение Алматы → Астана (transfer)
        (0, 0, 10, 1, 'transfer_out'),  (0, 1, 10, 1, 'transfer_in'),
    ]

    for p_idx, w_idx, qty, days_ago, mtype in plan:
        if p_idx >= len(products) or w_idx >= len(warehouses):
            continue
        signed = qty if mtype in ('in', 'transfer_in') else -qty
        db.session.add(StockMovement(
            product_id=products[p_idx].id,
            warehouse_id=warehouses[w_idx].id,
            movement_type=mtype,
            quantity=signed,
            document_ref=f'BATCH-2026-{1 + (p_idx % 2):03d}' if mtype == 'in' else f'СФ-2026-{100 + p_idx * 3 + days_ago}',
            counterparty='Tushun Co., Ltd' if mtype == 'in' else None,
            note='Перемещение между складами' if mtype.startswith('transfer') else None,
            movement_date=today - timedelta(days=days_ago),
        ))
    db.session.commit()


def _seed_invoices_and_payments() -> None:
    """Seed: 8 invoices + 12 sale_items линий + 15 платежей.

    Создаёт линии счёта (SaleItem) для каждого invoice — позволяет Module 3
    показывать реальные данные при первом запуске.
    """
    customers = Customer.query.order_by(Customer.id).all()
    products = Product.query.order_by(Product.id).all()
    if not customers or not products:
        return

    today = date.today()

    # (customer_idx, days_ago, due_offset_from_issue, status, notes,
    #  [(product_idx, qty, unit_price_kzt), ...])
    invoice_plan = [
        # 1: оплачен полностью (старый)
        (0, 28, 30, 'paid', 'Постоянный клиент', [(0, 50, 12_000), (1, 80, 18_000)]),
        # 2: оплачен полностью
        (3, 25, 30, 'paid', None, [(2, 60, 15_500), (3, 40, 8_000)]),
        # 3: оплачен полностью
        (1, 22, 30, 'paid', 'Срочная поставка', [(0, 100, 12_500)]),
        # 4: частично оплачен
        (2, 18, 30, 'partially_paid', 'Платят траншами', [(0, 80, 12_800), (4, 50, 25_000)]),
        # 5: просрочен (старый)
        (4, 28, 7,  'overdue', 'Просрочка ~21 день', [(1, 70, 17_800), (5, 30, 22_000)]),
        # 6: просрочен (недавний)
        (4, 14, 5,  'overdue', 'Просрочка ~9 дней', [(2, 40, 16_500), (3, 50, 8_500)]),
        # 7: в сроке (свежий)
        (0, 5,  30, 'issued', None, [(0, 60, 13_000), (1, 50, 18_500)]),
        # 8: только выпущен
        (3, 3,  30, 'issued', None, [(2, 80, 16_000)]),
    ]

    invoices = []
    for idx, (c_idx, days_ago, due_offset, status, notes, lines) in enumerate(invoice_plan, start=1):
        customer = customers[c_idx]
        issue_date = today - timedelta(days=days_ago)

        inv = Invoice(
            invoice_number=f'СФ-2026-{100 + idx:03d}',
            customer_id=customer.id,
            issue_date=issue_date,
            due_date=issue_date + timedelta(days=due_offset),
            status=status,
            total_kzt=0,
            paid_kzt=0,
            notes=notes,
        )
        db.session.add(inv)
        db.session.flush()  # получаем inv.id

        # Линии счёта
        invoice_total = 0.0
        for p_idx, qty, unit_price in lines:
            if p_idx >= len(products):
                continue
            prod = products[p_idx]
            unit_cost = unit_price * 0.7  # ~30% маржа для seed
            total_revenue = qty * unit_price
            total_cost = qty * unit_cost
            vat_output = total_revenue * (prod.vat_sale_percent or 0.16)
            vat_input = total_cost * (prod.vat_import_percent or 0.12)
            vat_to_pay = max(0, vat_output - vat_input)
            gross_margin = total_revenue - total_cost
            margin_pct = (gross_margin / total_revenue * 100) if total_revenue > 0 else 0
            kpn = max(0, gross_margin - vat_to_pay) * (prod.kpn_percent or 0.10)
            net_profit = gross_margin - vat_to_pay - kpn

            db.session.add(SaleItem(
                invoice_id=inv.id,
                customer_id=customer.id,
                invoice_number=inv.invoice_number,
                product_id=prod.id,
                customer_name=customer.name,
                quantity=qty,
                unit_price_kzt=unit_price,
                unit_cost_kzt=unit_cost,
                total_revenue_kzt=total_revenue,
                total_cost_kzt=total_cost,
                vat_output_kzt=vat_output,
                vat_input_kzt=vat_input,
                vat_to_pay_kzt=vat_to_pay,
                gross_margin_kzt=gross_margin,
                gross_margin_percent=margin_pct,
                kpn_tax_kzt=kpn,
                net_profit_kzt=net_profit,
                sale_date=issue_date,
                due_date=issue_date + timedelta(days=due_offset),
                payment_status='paid' if status == 'paid' else 'overdue' if status == 'overdue' else 'pending',
                paid_kzt=total_revenue if status == 'paid' else 0,
                status='sold',
            ))
            invoice_total += total_revenue

        inv.total_kzt = invoice_total
        invoices.append(inv)
    db.session.commit()

    # Платежи привязываем к реальным total invoices
    # (invoice_idx, fraction_of_total, days_after_issue, method, ref)
    payment_plan = [
        # Invoice 1 — полная оплата одним платежом
        (0, 1.0,  10, 'bank',  'PP-2026-0142'),
        # Invoice 2 — полная оплата (kaspi)
        (1, 1.0,   8, 'kaspi', 'KSP-558823'),
        # Invoice 3 — полная оплата
        (2, 1.0,  12, 'bank',  'PP-2026-0156'),
        # Invoice 4 — частично (~60% от total)
        (3, 0.40,  4, 'bank',  'PP-2026-0177'),
        (3, 0.20,  9, 'bank',  'PP-2026-0192'),
        # Invoice 5 — просрочен (нет оплат)
        # Invoice 6 — просрочен (нет оплат)
        # Invoice 7 и 8 — в сроке (нет оплат)
    ]

    for inv_idx, fraction, days_after, method, ref in payment_plan:
        if inv_idx >= len(invoices):
            continue
        inv = invoices[inv_idx]
        amount = round(inv.total_kzt * fraction)
        if amount <= 0:
            continue
        db.session.add(Payment(
            invoice_id=inv.id,
            amount_kzt=amount,
            payment_date=inv.issue_date + timedelta(days=days_after),
            method=method,
            reference=ref,
        ))
    db.session.commit()

    # Денормализуем paid_kzt в invoices.paid_kzt
    for inv in invoices:
        total_paid = sum(p.amount_kzt for p in inv.payments)
        inv.paid_kzt = total_paid
    db.session.commit()


def _seed_expense_categories_and_budgets() -> None:
    """Module 7 seed: категории расходов + 12 бюджетов + auto-link старых cash_transactions."""
    today = date.today()

    # 1. Категории
    code_to_cat = {}
    for code, name, color, icon, limit, alert, sort in SEED_EXPENSE_CATEGORIES:
        cat = ExpenseCategory(
            code=code, name=name, color=color, icon=icon,
            monthly_limit_kzt=limit, alert_percent=alert,
            sort_order=sort, is_active=True,
        )
        db.session.add(cat)
        code_to_cat[code] = cat
    db.session.commit()

    # 2. Auto-link существующих cash_transactions по text-полю category → expense_category_id
    txs = CashTransaction.query.filter(
        CashTransaction.transaction_type == 'expense',
        CashTransaction.expense_category_id.is_(None),
    ).all()
    for tx in txs:
        if tx.category and tx.category in code_to_cat:
            tx.expense_category_id = code_to_cat[tx.category].id
    db.session.commit()

    # 3. Бюджеты на 12 месяцев (текущий + 2 предыдущих + 9 будущих) для каждой активной категории
    # Чтобы было на чём показать "план vs факт" в текущем и прошлых месяцах
    months_to_plan = []
    for offset in range(-2, 10):  # от -2 (2 мес назад) до +9 (9 мес вперёд)
        ref = today.replace(day=1)
        # сдвигаем месяцы
        m = ref.month - 1 + offset
        y = ref.year + m // 12
        m = m % 12 + 1
        months_to_plan.append((y, m))

    for cat in code_to_cat.values():
        for y, m in months_to_plan:
            db.session.add(ExpenseBudget(
                category_id=cat.id,
                year=y, month=m,
                limit_amount_kzt=cat.monthly_limit_kzt,
                alert_percent=cat.alert_percent,
            ))
    db.session.commit()

    # 4. Дополнительные expense-транзакции для разнообразия (если их мало)
    # Проверим что у нас есть транзакции по разным категориям и добавим если нет
    existing_count = CashTransaction.query.filter(
        CashTransaction.transaction_type == 'expense'
    ).count()
    if existing_count < 20:
        accounts = Account.query.order_by(Account.id).all()
        if accounts:
            extra = [
                # (cat_code, days_ago, amount, description, counterparty)
                ('marketing', 25, 280_000, 'Реклама в Instagram',          'Meta'),
                ('marketing', 12, 150_000, 'SEO-продвижение сайта',        'WebStudio'),
                ('marketing',  4, 220_000, 'Контекстная реклама Yandex',   'Yandex'),
                ('utilities', 20, 95_000,  'Интернет + телефония',         'Beeline'),
                ('utilities',  6, 120_000, 'Электричество складов',        'Алматы Энерго'),
                ('logistics',  9, 580_000, 'Доставка партии #2',           'KazPost Logistics'),
                ('logistics',  2, 340_000, 'Перевозка Алматы → Астана',    'СДЭК'),
                ('purchase',   17, 4_500_000, 'Закупка фильтров (партия)',  'Tushun Co.'),
                ('purchase',   3, 2_800_000, 'Закупка патрубков',          'Tushun Co.'),
                ('tax',       14, 450_000, 'Социальный налог',             'Налоговая'),
                ('tax',        1, 320_000, 'Подоходный налог сотрудников', 'Налоговая'),
                ('salary',     5, 4_200_000, 'Зарплата за май (аванс)',     'Сотрудники'),
                ('rent',       8, 950_000, 'Аренда офиса май',              'ИП Жанатов'),
                ('other',     11, 75_000,  'Канцелярия, бумага, картриджи','Marwin'),
            ]
            for cat_code, days_ago, amount, desc, party in extra:
                cat_id = code_to_cat[cat_code].id if cat_code in code_to_cat else None
                db.session.add(CashTransaction(
                    account_id=accounts[0].id,
                    transaction_type='expense',
                    category=cat_code,
                    expense_category_id=cat_id,
                    amount_kzt=amount,
                    description=desc,
                    counterparty=party,
                    transaction_date=today - timedelta(days=days_ago),
                ))
            db.session.commit()


def _seed_warranties() -> None:
    """Module 6 seed: warranty plans + claims + returns."""
    products = Product.query.order_by(Product.id).all()
    customers = Customer.query.order_by(Customer.id).all()
    invoices = Invoice.query.order_by(Invoice.id).all()
    if not products or not customers:
        return

    today = date.today()

    # Plans
    for p_idx, name, months, cov, price, desc, active in SEED_WARRANTY_PLANS:
        if p_idx >= len(products):
            continue
        db.session.add(WarrantyPlan(
            product_id=products[p_idx].id,
            name=name, months=months, coverage_percent=cov, price_kzt=price,
            description=desc, is_active=active,
        ))
    db.session.commit()

    # Claims
    claim_objs = []
    for claim_no, c_idx, p_idx, qty, ctype, status, claim_days_ago, resolved_days_ago, desc, resolution in SEED_WARRANTY_CLAIMS:
        if c_idx >= len(customers) or p_idx >= len(products):
            continue
        customer = customers[c_idx]
        # Привяжем к первому invoice этого клиента, если есть
        inv = next((i for i in invoices if i.customer_id == customer.id), None)
        claim = WarrantyClaim(
            claim_number=claim_no,
            invoice_id=inv.id if inv else None,
            product_id=products[p_idx].id,
            customer_id=customer.id,
            customer_name=customer.name,
            quantity=qty,
            claim_type=ctype,
            description=desc,
            status=status,
            resolution=resolution,
            claim_date=today - timedelta(days=claim_days_ago),
            resolved_date=(today - timedelta(days=resolved_days_ago)) if resolved_days_ago is not None else None,
        )
        db.session.add(claim)
        claim_objs.append(claim)
    db.session.commit()

    # Returns
    for c_idx, qty, reason, refund, method, status, days_ago, note in SEED_WARRANTY_RETURNS:
        if c_idx >= len(claim_objs):
            continue
        db.session.add(WarrantyReturn(
            claim_id=claim_objs[c_idx].id,
            quantity=qty,
            reason=reason,
            refund_amount_kzt=refund,
            refund_method=method,
            return_date=today - timedelta(days=days_ago),
            status=status,
            note=note,
        ))
    db.session.commit()
