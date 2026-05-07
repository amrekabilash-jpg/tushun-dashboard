-- =====================================================================
-- Tushun Dashboard — PostgreSQL schema
-- Применить к Supabase: psql $DATABASE_URL -f backend/sql/schema.sql
--
-- Замечание: код приложения вызывает db.create_all() при старте, который
-- создаст эти таблицы автоматически если БД пустая. Этот файл — для аудита,
-- ручного развёртывания, и для миграций без запуска Python.
-- =====================================================================

-- ----- СПРАВОЧНИКИ -----

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

-- ----- НАЛОГИ И ИХ ИСТОРИЯ -----

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

-- ----- ПАРТИИ ИМПОРТА -----

CREATE TABLE IF NOT EXISTS import_batches (
    id                       SERIAL PRIMARY KEY,
    batch_number             VARCHAR(50) UNIQUE NOT NULL,
    invoice_number           VARCHAR(100),
    supplier_name            VARCHAR(255),
    shipping_cost_usd        DOUBLE PRECISION DEFAULT 0,
    additional_costs_kzt     DOUBLE PRECISION DEFAULT 0,
    exchange_rate            DOUBLE PRECISION DEFAULT 450,
    total_fob_usd            DOUBLE PRECISION DEFAULT 0,
    total_customs_duty_usd   DOUBLE PRECISION DEFAULT 0,
    total_vat_import_usd     DOUBLE PRECISION DEFAULT 0,
    total_cost_usd           DOUBLE PRECISION DEFAULT 0,
    total_cost_kzt           DOUBLE PRECISION DEFAULT 0,
    status                   VARCHAR(50) DEFAULT 'draft',
    import_date              DATE,
    created_at               TIMESTAMP DEFAULT NOW(),
    updated_at               TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_import_batches_date ON import_batches(import_date DESC);

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

-- ----- ПРОДАЖИ + ДЕБИТОРКА -----

CREATE TABLE IF NOT EXISTS sale_items (
    id                    SERIAL PRIMARY KEY,
    invoice_number        VARCHAR(100),
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
CREATE INDEX IF NOT EXISTS idx_sale_date            ON sale_items(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sale_payment_status  ON sale_items(payment_status);
CREATE INDEX IF NOT EXISTS idx_sale_customer        ON sale_items(customer_name);
CREATE INDEX IF NOT EXISTS idx_sale_product         ON sale_items(product_id);

-- ----- КАССОВЫЕ ТРАНЗАКЦИИ -----

CREATE TABLE IF NOT EXISTS cash_transactions (
    id                SERIAL PRIMARY KEY,
    account_id        INTEGER NOT NULL REFERENCES accounts(id),
    transaction_type  VARCHAR(50) NOT NULL,
    category          VARCHAR(50),
    amount_kzt        DOUBLE PRECISION NOT NULL,
    description       VARCHAR(255),
    counterparty      VARCHAR(255),
    transaction_date  DATE,
    created_at        TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cash_date     ON cash_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_category ON cash_transactions(category);
CREATE INDEX IF NOT EXISTS idx_cash_account  ON cash_transactions(account_id);

-- ----- БЮДЖЕТ (План vs Факт) -----

CREATE TABLE IF NOT EXISTS budget_plan (
    id        SERIAL PRIMARY KEY,
    year      INTEGER NOT NULL,
    month     INTEGER NOT NULL,
    metric    VARCHAR(50) NOT NULL,
    plan_kzt  DOUBLE PRECISION NOT NULL,
    CONSTRAINT uq_budget_year_month_metric UNIQUE (year, month, metric)
);
CREATE INDEX IF NOT EXISTS idx_budget_year_month ON budget_plan(year, month);
