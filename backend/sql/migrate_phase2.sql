-- =====================================================================
-- Tushun Dashboard — Phase 2 миграция (Module 2-8)
-- Безопасно применять к существующей Phase 1 БД (Supabase).
-- НЕ трогает существующие таблицы products, users, sale_items, cash_transactions, etc.
-- Создаёт только новые таблицы и добавляет nullable колонки через ALTER.
-- =====================================================================

-- ----- 1. СКЛАДЫ + ДВИЖЕНИЕ ТОВАРА (Module 2) -----

CREATE TABLE IF NOT EXISTS warehouses (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(20) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    city        VARCHAR(50) NOT NULL,
    address     VARCHAR(255),
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW()
);

INSERT INTO warehouses (code, name, city, address) VALUES
    ('ALA', 'Склад Алматы', 'Алматы', 'мкр. Айнабулак, ул. Промышленная 12'),
    ('NQZ', 'Склад Астана', 'Астана', 'пр. Кабанбай батыра 47')
ON CONFLICT (code) DO NOTHING;

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

-- ----- 2. КЛИЕНТЫ + СЧЕТА + ПЛАТЕЖИ (Module 3) -----

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

-- ----- 3. ДОБАВЛЯЕМ FK В sale_items (Module 3) - безопасно через IF NOT EXISTS -----

ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS invoice_id     INTEGER;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS customer_id    INTEGER;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS due_date       DATE;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS paid_kzt       DOUBLE PRECISION DEFAULT 0;

-- ----- 4. РАСШИРЯЕМ import_batches (Module 4) -----

ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS tracking_number          VARCHAR(100);
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS eta_date                 DATE;
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS arrival_date             DATE;
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS destination_warehouse_id INTEGER;
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS stock_in_created         BOOLEAN DEFAULT FALSE;

-- ----- 5. ФИНАНСОВЫЕ ИНСТРУМЕНТЫ (Module 5) -----

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

-- ----- 6. ГАРАНТИЙНЫЙ УЧЁТ (Module 6) -----

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

CREATE TABLE IF NOT EXISTS warranty_claims (
    id              SERIAL PRIMARY KEY,
    claim_number    VARCHAR(50) UNIQUE NOT NULL,
    invoice_id      INTEGER,
    product_id      INTEGER NOT NULL REFERENCES products(id),
    customer_id     INTEGER,
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

-- ----- 7. РАСХОДЫ И БЮДЖЕТ (Module 7) -----

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

ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS expense_category_id INTEGER;

-- ----- 8. TELEGRAM BOT (Module 8) -----

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

-- ----- 9. ИНДЕКСЫ ДЛЯ НОВЫХ ТАБЛИЦ (без зависимостей от Phase 1) -----

CREATE INDEX IF NOT EXISTS idx_warehouses_city          ON warehouses(city);
CREATE INDEX IF NOT EXISTS idx_stock_mov_product        ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_warehouse      ON stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_date           ON stock_movements(movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_customers_status         ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_name           ON customers(name);
CREATE INDEX IF NOT EXISTS idx_invoices_customer        ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status          ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date            ON invoices(issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_invoice         ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_date            ON payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_rates_date               ON exchange_rates(rate_date DESC);
CREATE INDEX IF NOT EXISTS idx_rates_pair               ON exchange_rates(base_currency, target_currency);
CREATE INDEX IF NOT EXISTS idx_premiums_active          ON premiums(is_active);
CREATE INDEX IF NOT EXISTS idx_commissions_active       ON commissions(is_active);
CREATE INDEX IF NOT EXISTS idx_warranty_plans_product   ON warranty_plans(product_id);
CREATE INDEX IF NOT EXISTS idx_claims_status            ON warranty_claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_date              ON warranty_claims(claim_date DESC);
CREATE INDEX IF NOT EXISTS idx_claims_product           ON warranty_claims(product_id);
CREATE INDEX IF NOT EXISTS idx_returns_claim            ON warranty_returns(claim_id);
CREATE INDEX IF NOT EXISTS idx_returns_date             ON warranty_returns(return_date DESC);
CREATE INDEX IF NOT EXISTS idx_expense_cat_active       ON expense_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_expense_budget_period    ON expense_budgets(year, month);
CREATE INDEX IF NOT EXISTS idx_tg_users_active          ON telegram_users(is_active);

-- ----- 10. ПРОВЕРКА -----

SELECT
    (SELECT count(*) FROM warehouses) AS warehouses,
    (SELECT count(*) FROM customers) AS customers,
    (SELECT count(*) FROM invoices) AS invoices,
    (SELECT count(*) FROM payments) AS payments,
    (SELECT count(*) FROM exchange_rates) AS exchange_rates,
    (SELECT count(*) FROM premiums) AS premiums,
    (SELECT count(*) FROM commissions) AS commissions,
    (SELECT count(*) FROM warranty_plans) AS warranty_plans,
    (SELECT count(*) FROM warranty_claims) AS warranty_claims,
    (SELECT count(*) FROM warranty_returns) AS warranty_returns,
    (SELECT count(*) FROM expense_categories) AS expense_categories,
    (SELECT count(*) FROM expense_budgets) AS expense_budgets,
    (SELECT count(*) FROM telegram_users) AS telegram_users,
    (SELECT count(*) FROM stock_movements) AS stock_movements;
