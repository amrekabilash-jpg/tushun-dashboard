-- =====================================================================
-- Tushun Dashboard — PostgreSQL schema (Phase 1 + Phase 2 — все 8 модулей)
-- Применить к Supabase: psql $DATABASE_URL -f backend/sql/schema.sql
--
-- Файл идемпотентен (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS),
-- безопасно запускать повторно. Порядок таблиц учитывает зависимости FK:
-- сначала справочники, потом таблицы со ссылками.
-- =====================================================================

-- ----- 1. БАЗОВЫЕ СПРАВОЧНИКИ -----

CREATE TABLE IF NOT EXISTS app_settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       VARCHAR(255) NOT NULL,
    updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id                    SERIAL PRIMARY KEY,
    name                  VARCHAR(255) UNIQUE NOT NULL,
    tn_ved_code           VARCHAR(50),
    category              VARCHAR(100) NOT NULL,
    unit                  VARCHAR(50) DEFAULT 'шт',
    customs_duty_percent  DOUBLE PRECISION DEFAULT 0.12 NOT NULL,
    vat_import_percent    DOUBLE PRECISION DEFAULT 0.12 NOT NULL,
    vat_sale_percent      DOUBLE PRECISION DEFAULT 0.16 NOT NULL,
    kpn_percent           DOUBLE PRECISION DEFAULT 0.10 NOT NULL,
    created_at            TIMESTAMP DEFAULT NOW(),
    updated_at            TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(100) UNIQUE NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(50) DEFAULT 'analyst',
    created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
    id              SERIAL PRIMARY KEY,
    account_number  VARCHAR(100) UNIQUE NOT NULL,
    bank_name       VARCHAR(255),
    account_type    VARCHAR(50) DEFAULT 'checking',
    currency        VARCHAR(3)  DEFAULT 'KZT',
    balance         DOUBLE PRECISION DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_accounts_currency ON accounts(currency);

-- ----- 2. НАЛОГИ И ИХ ИСТОРИЯ -----

CREATE TABLE IF NOT EXISTS tax_settings_history (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    field_name  VARCHAR(50) NOT NULL,
    old_value   DOUBLE PRECISION,
    new_value   DOUBLE PRECISION NOT NULL,
    changed_by  VARCHAR(100),
    reason      VARCHAR(500),
    changed_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tax_history_product ON tax_settings_history(product_id);
CREATE INDEX IF NOT EXISTS idx_tax_history_changed_at ON tax_settings_history(changed_at DESC);

-- ----- 3. СКЛАДЫ И ДВИЖЕНИЕ ТОВАРА (Module 2) — справочники ДО любых FK -----

CREATE TABLE IF NOT EXISTS warehouses (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(20) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    city        VARCHAR(50) NOT NULL,
    address     VARCHAR(255),
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_warehouses_city ON warehouses(city);

-- Seed начальные склады (Алматы и Астана)
INSERT INTO warehouses (code, name, city, address) VALUES
    ('ALA', 'Склад Алматы', 'Алматы', 'мкр. Айнабулак, ул. Промышленная 12'),
    ('NQZ', 'Склад Астана', 'Астана', 'пр. Кабанбай батыра 47')
ON CONFLICT (code) DO NOTHING;

-- ----- 4. КЛИЕНТЫ + СЧЕТА + ПЛАТЕЖИ (Module 3) -----

CREATE TABLE IF NOT EXISTS customers (
    id                 SERIAL PRIMARY KEY,
    name               VARCHAR(255) NOT NULL,
    phone              VARCHAR(50),
    email              VARCHAR(255),
    address            VARCHAR(500),
    tax_id             VARCHAR(50),
    customer_type      VARCHAR(20) DEFAULT 'b2b',
    status             VARCHAR(20) DEFAULT 'active',
    discount_percent   DOUBLE PRECISION DEFAULT 0,
    credit_limit_kzt   DOUBLE PRECISION DEFAULT 0,
    notes              VARCHAR(1000),
    created_at         TIMESTAMP DEFAULT NOW(),
    updated_at         TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

CREATE TABLE IF NOT EXISTS invoices (
    id              SERIAL PRIMARY KEY,
    invoice_number  VARCHAR(100) UNIQUE NOT NULL,
    customer_id     INTEGER NOT NULL REFERENCES customers(id),
    issue_date      DATE DEFAULT CURRENT_DATE,
    due_date        DATE,
    status          VARCHAR(20) DEFAULT 'draft',
    total_kzt       DOUBLE PRECISION DEFAULT 0,
    paid_kzt        DOUBLE PRECISION DEFAULT 0,
    notes           VARCHAR(1000),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status   ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date     ON invoices(issue_date DESC);

CREATE TABLE IF NOT EXISTS payments (
    id            SERIAL PRIMARY KEY,
    invoice_id    INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount_kzt    DOUBLE PRECISION NOT NULL,
    payment_date  DATE DEFAULT CURRENT_DATE,
    method        VARCHAR(20) DEFAULT 'bank',
    reference     VARCHAR(100),
    notes         VARCHAR(500),
    created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_date    ON payments(payment_date DESC);

-- ----- 5. КАТЕГОРИИ РАСХОДОВ (Module 7) — ДО cash_transactions ALTER -----

CREATE TABLE IF NOT EXISTS expense_categories (
    id                 SERIAL PRIMARY KEY,
    code               VARCHAR(50) UNIQUE NOT NULL,
    name               VARCHAR(100) NOT NULL,
    color              VARCHAR(20) DEFAULT '#d4af37',
    icon               VARCHAR(20),
    description        VARCHAR(255),
    monthly_limit_kzt  DOUBLE PRECISION DEFAULT 0,
    alert_percent      DOUBLE PRECISION DEFAULT 80,
    is_active          BOOLEAN DEFAULT TRUE,
    sort_order         INTEGER DEFAULT 0,
    created_at         TIMESTAMP DEFAULT NOW(),
    updated_at         TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expense_cat_active ON expense_categories(is_active);

CREATE TABLE IF NOT EXISTS expense_budgets (
    id                  SERIAL PRIMARY KEY,
    category_id         INTEGER NOT NULL REFERENCES expense_categories(id),
    year                INTEGER NOT NULL,
    month               INTEGER NOT NULL,
    limit_amount_kzt    DOUBLE PRECISION NOT NULL,
    alert_percent       DOUBLE PRECISION DEFAULT 80,
    note                VARCHAR(255),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_expense_budget_cat_year_month UNIQUE (category_id, year, month)
);
CREATE INDEX IF NOT EXISTS idx_expense_budget_period ON expense_budgets(year, month);

-- ----- 6. ПАРТИИ ИМПОРТА (с расширением Module 4) -----

CREATE TABLE IF NOT EXISTS import_batches (
    id                          SERIAL PRIMARY KEY,
    batch_number                VARCHAR(50) UNIQUE NOT NULL,
    invoice_number              VARCHAR(100),
    supplier_name               VARCHAR(255),
    shipping_cost_usd           DOUBLE PRECISION DEFAULT 0,
    additional_costs_kzt        DOUBLE PRECISION DEFAULT 0,
    exchange_rate               DOUBLE PRECISION DEFAULT 450,
    total_fob_usd               DOUBLE PRECISION DEFAULT 0,
    total_customs_duty_usd      DOUBLE PRECISION DEFAULT 0,
    total_vat_import_usd        DOUBLE PRECISION DEFAULT 0,
    total_cost_usd              DOUBLE PRECISION DEFAULT 0,
    total_cost_kzt              DOUBLE PRECISION DEFAULT 0,
    status                      VARCHAR(50) DEFAULT 'draft',
    import_date                 DATE,
    tracking_number             VARCHAR(100),
    eta_date                    DATE,
    arrival_date                DATE,
    destination_warehouse_id    INTEGER REFERENCES warehouses(id),
    stock_in_created            BOOLEAN DEFAULT FALSE,
    created_at                  TIMESTAMP DEFAULT NOW(),
    updated_at                  TIMESTAMP DEFAULT NOW()
);
-- ALTER на случай если таблица существовала ранее (Phase 1)
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS tracking_number          VARCHAR(100);
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS eta_date                 DATE;
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS arrival_date             DATE;
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS destination_warehouse_id INTEGER REFERENCES warehouses(id);
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS stock_in_created         BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_import_batches_date    ON import_batches(import_date DESC);
CREATE INDEX IF NOT EXISTS idx_import_batches_status  ON import_batches(status);
CREATE INDEX IF NOT EXISTS idx_import_batches_eta     ON import_batches(eta_date);

CREATE TABLE IF NOT EXISTS import_batch_items (
    id                     SERIAL PRIMARY KEY,
    batch_id               INTEGER NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
    product_id             INTEGER NOT NULL REFERENCES products(id),
    quantity               INTEGER NOT NULL,
    price_per_unit_usd     DOUBLE PRECISION NOT NULL,
    customs_duty_percent   DOUBLE PRECISION NOT NULL,
    vat_import_percent     DOUBLE PRECISION NOT NULL,
    fob_usd                DOUBLE PRECISION DEFAULT 0,
    customs_duty_usd       DOUBLE PRECISION DEFAULT 0,
    vat_import_usd         DOUBLE PRECISION DEFAULT 0,
    unit_cost_usd          DOUBLE PRECISION DEFAULT 0,
    unit_cost_kzt          DOUBLE PRECISION DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_batch_items_batch    ON import_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_product  ON import_batch_items(product_id);

-- ----- 7. ПРОДАЖИ + ДЕБИТОРКА (с FK Module 3) -----

CREATE TABLE IF NOT EXISTS sale_items (
    id                    SERIAL PRIMARY KEY,
    invoice_number        VARCHAR(100),
    invoice_id            INTEGER REFERENCES invoices(id),
    customer_id           INTEGER REFERENCES customers(id),
    product_id            INTEGER NOT NULL REFERENCES products(id),
    customer_name         VARCHAR(255),
    quantity              INTEGER NOT NULL,
    unit_price_kzt        DOUBLE PRECISION NOT NULL,
    unit_cost_kzt         DOUBLE PRECISION NOT NULL,
    total_revenue_kzt     DOUBLE PRECISION DEFAULT 0,
    total_cost_kzt        DOUBLE PRECISION DEFAULT 0,
    vat_input_kzt         DOUBLE PRECISION DEFAULT 0,
    vat_output_kzt        DOUBLE PRECISION DEFAULT 0,
    vat_to_pay_kzt        DOUBLE PRECISION DEFAULT 0,
    gross_margin_kzt      DOUBLE PRECISION DEFAULT 0,
    gross_margin_percent  DOUBLE PRECISION DEFAULT 0,
    kpn_tax_kzt           DOUBLE PRECISION DEFAULT 0,
    net_profit_kzt        DOUBLE PRECISION DEFAULT 0,
    sale_date             DATE,
    status                VARCHAR(50) DEFAULT 'sold',
    payment_status        VARCHAR(20) DEFAULT 'pending',
    due_date              DATE,
    paid_kzt              DOUBLE PRECISION DEFAULT 0,
    created_at            TIMESTAMP DEFAULT NOW()
);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS invoice_id  INTEGER REFERENCES invoices(id);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS paid_kzt DOUBLE PRECISION DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_sale_date            ON sale_items(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sale_payment_status  ON sale_items(payment_status);
CREATE INDEX IF NOT EXISTS idx_sale_customer        ON sale_items(customer_name);
CREATE INDEX IF NOT EXISTS idx_sale_product         ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_invoice         ON sale_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sale_customer_id     ON sale_items(customer_id);

-- ----- 8. КАССОВЫЕ ТРАНЗАКЦИИ (с FK Module 7) -----

CREATE TABLE IF NOT EXISTS cash_transactions (
    id                   SERIAL PRIMARY KEY,
    account_id           INTEGER NOT NULL REFERENCES accounts(id),
    transaction_type     VARCHAR(50) NOT NULL,
    category             VARCHAR(50),
    expense_category_id  INTEGER REFERENCES expense_categories(id),
    amount_kzt           DOUBLE PRECISION NOT NULL,
    description          VARCHAR(255),
    counterparty         VARCHAR(255),
    transaction_date     DATE,
    created_at           TIMESTAMP DEFAULT NOW()
);
ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS expense_category_id INTEGER REFERENCES expense_categories(id);
CREATE INDEX IF NOT EXISTS idx_cash_date         ON cash_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_category     ON cash_transactions(category);
CREATE INDEX IF NOT EXISTS idx_cash_account      ON cash_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_cash_expense_cat  ON cash_transactions(expense_category_id);

-- ----- 9. БЮДЖЕТ для Module 1 (P&L) -----

CREATE TABLE IF NOT EXISTS budget_plan (
    id        SERIAL PRIMARY KEY,
    year      INTEGER NOT NULL,
    month     INTEGER NOT NULL,
    metric    VARCHAR(50) NOT NULL,
    plan_kzt  DOUBLE PRECISION NOT NULL,
    CONSTRAINT uq_budget_year_month_metric UNIQUE (year, month, metric)
);
CREATE INDEX IF NOT EXISTS idx_budget_year_month ON budget_plan(year, month);

-- ----- 10. ДВИЖЕНИЕ ТОВАРА (Module 2) — после warehouses + products -----

CREATE TABLE IF NOT EXISTS stock_movements (
    id             SERIAL PRIMARY KEY,
    product_id     INTEGER NOT NULL REFERENCES products(id),
    warehouse_id   INTEGER NOT NULL REFERENCES warehouses(id),
    movement_type  VARCHAR(20) NOT NULL,
    quantity       INTEGER NOT NULL,
    document_ref   VARCHAR(100),
    counterparty   VARCHAR(255),
    note           VARCHAR(500),
    movement_date  DATE DEFAULT CURRENT_DATE,
    created_at     TIMESTAMP DEFAULT NOW(),
    created_by     VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_stock_mov_product   ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_warehouse ON stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_date      ON stock_movements(movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_mov_type      ON stock_movements(movement_type);

-- ----- 11. ГАРАНТИЙНЫЙ УЧЁТ (Module 6) -----

CREATE TABLE IF NOT EXISTS warranty_plans (
    id                SERIAL PRIMARY KEY,
    product_id        INTEGER NOT NULL REFERENCES products(id),
    name              VARCHAR(255) NOT NULL,
    months            INTEGER NOT NULL,
    coverage_percent  DOUBLE PRECISION DEFAULT 100,
    price_kzt         DOUBLE PRECISION DEFAULT 0,
    description       VARCHAR(500),
    is_active         BOOLEAN DEFAULT TRUE,
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_warranty_plans_product ON warranty_plans(product_id);

CREATE TABLE IF NOT EXISTS warranty_claims (
    id              SERIAL PRIMARY KEY,
    claim_number    VARCHAR(50) UNIQUE NOT NULL,
    invoice_id      INTEGER REFERENCES invoices(id),
    product_id      INTEGER NOT NULL REFERENCES products(id),
    customer_id     INTEGER REFERENCES customers(id),
    customer_name   VARCHAR(255),
    quantity        INTEGER DEFAULT 1,
    claim_type      VARCHAR(20) DEFAULT 'defect',
    description     VARCHAR(1000),
    status          VARCHAR(20) DEFAULT 'open',
    resolution      VARCHAR(500),
    claim_date      DATE DEFAULT CURRENT_DATE,
    resolved_date   DATE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_claims_status   ON warranty_claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_date     ON warranty_claims(claim_date DESC);
CREATE INDEX IF NOT EXISTS idx_claims_product  ON warranty_claims(product_id);
CREATE INDEX IF NOT EXISTS idx_claims_customer ON warranty_claims(customer_id);

CREATE TABLE IF NOT EXISTS warranty_returns (
    id                  SERIAL PRIMARY KEY,
    claim_id            INTEGER NOT NULL REFERENCES warranty_claims(id) ON DELETE CASCADE,
    quantity            INTEGER DEFAULT 1,
    reason              VARCHAR(500),
    refund_amount_kzt   DOUBLE PRECISION DEFAULT 0,
    refund_method       VARCHAR(20) DEFAULT 'cash',
    return_date         DATE DEFAULT CURRENT_DATE,
    status              VARCHAR(20) DEFAULT 'pending',
    note                VARCHAR(500),
    created_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_returns_claim ON warranty_returns(claim_id);
CREATE INDEX IF NOT EXISTS idx_returns_date  ON warranty_returns(return_date DESC);

-- ----- 12. ФИНАНСОВЫЕ ИНСТРУМЕНТЫ (Module 5) -----

CREATE TABLE IF NOT EXISTS exchange_rates (
    id              SERIAL PRIMARY KEY,
    base_currency   VARCHAR(3) NOT NULL,
    target_currency VARCHAR(3) NOT NULL,
    rate            DOUBLE PRECISION NOT NULL,
    rate_date       DATE DEFAULT CURRENT_DATE NOT NULL,
    source          VARCHAR(50) DEFAULT 'manual',
    note            VARCHAR(255),
    created_at      TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_rate_base_target_date UNIQUE (base_currency, target_currency, rate_date)
);
CREATE INDEX IF NOT EXISTS idx_rates_date ON exchange_rates(rate_date DESC);
CREATE INDEX IF NOT EXISTS idx_rates_pair ON exchange_rates(base_currency, target_currency);

CREATE TABLE IF NOT EXISTS premiums (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    premium_type    VARCHAR(20) DEFAULT 'fixed',
    amount          DOUBLE PRECISION NOT NULL,
    description     VARCHAR(500),
    period          VARCHAR(50),
    target_role     VARCHAR(50),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_premiums_active ON premiums(is_active);

CREATE TABLE IF NOT EXISTS commissions (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(255) NOT NULL,
    commission_type  VARCHAR(30) DEFAULT 'sales',
    percent          DOUBLE PRECISION NOT NULL,
    min_amount_kzt   DOUBLE PRECISION DEFAULT 0,
    max_amount_kzt   DOUBLE PRECISION,
    description      VARCHAR(500),
    is_active        BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_commissions_active ON commissions(is_active);

-- ----- 13. TELEGRAM BOT (Module 8) -----

CREATE TABLE IF NOT EXISTS telegram_users (
    id                       SERIAL PRIMARY KEY,
    tg_user_id               BIGINT UNIQUE NOT NULL,
    chat_id                  BIGINT NOT NULL,
    username                 VARCHAR(100),
    full_name                VARCHAR(255),
    role                     VARCHAR(20) DEFAULT 'viewer',
    notifications_enabled    BOOLEAN DEFAULT TRUE,
    subscriptions            VARCHAR(255) DEFAULT 'alerts',
    language                 VARCHAR(5) DEFAULT 'ru',
    is_active                BOOLEAN DEFAULT TRUE,
    last_command             VARCHAR(100),
    last_seen                TIMESTAMP,
    created_at               TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tg_users_active ON telegram_users(is_active);
