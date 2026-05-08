-- =====================================================================
-- Tushun Dashboard — включить RLS на всех таблицах БЕЗ политик
--
-- ЦЕЛЬ: Заблокировать публичный anon-доступ к БД через Supabase API.
-- Только наш Flask backend (через DATABASE_URL → postgres role) может
-- читать/писать. Postgres role ОБХОДИТ RLS by default — это OK.
--
-- БЕЗ политик = anon role не имеет доступа ни к одной строке.
-- Если в будущем понадобится Supabase REST API из фронта → добавим
-- политики тогда.
-- =====================================================================

ALTER TABLE app_settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_settings_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices               ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_budgets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batch_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_plan            ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranty_plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranty_claims        ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranty_returns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE premiums               ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_users         ENABLE ROW LEVEL SECURITY;

-- Проверка: список таблиц с включённым RLS
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true
ORDER BY tablename;
