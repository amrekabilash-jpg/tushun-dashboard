-- =====================================================================
-- Tushun Dashboard — включить RLS на ВСЕХ public таблицах (динамически)
--
-- Безопасно: ALTER только для реально существующих таблиц.
-- БЕЗ политик = anon role не имеет доступа.
-- Postgres role (Flask backend) обходит RLS — продолжает работать.
-- =====================================================================

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        RAISE NOTICE 'RLS enabled: %', t;
    END LOOP;
END $$;

-- Проверка: показать все таблицы с включённым RLS
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
