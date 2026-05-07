"""Перенос данных из локального SQLite в PostgreSQL (Supabase).

Использование (после того как PostgreSQL schema создана через
db.create_all() при первом запуске Flask, или через psql -f schema.sql):

    DATABASE_URL=postgresql://postgres:PASSWORD@xxx.supabase.co:5432/postgres \
    SQLITE_PATH=instance/dashboard.db \
    python migrate_sqlite_to_postgres.py

Идемпотентность достигается через ON CONFLICT DO NOTHING — повторный запуск
не дублирует строки. После миграции последовательности SERIAL подкручиваются
к max(id).
"""
import argparse
import os
import sqlite3
import sys
from typing import List, Tuple

import psycopg2
from psycopg2.extras import execute_values


# Порядок важен: сначала родители, потом дети с FK
TABLES_IN_ORDER: List[str] = [
    'app_settings',
    'products',
    'users',
    'accounts',
    'tax_settings_history',
    'import_batches',
    'import_batch_items',
    'sale_items',
    'cash_transactions',
    'budget_plan',
]

# Конфликт-таргеты для UPSERT (или DO NOTHING)
CONFLICT_TARGETS = {
    'app_settings':       '(key)',
    'products':           '(name)',
    'users':              '(username)',
    'accounts':           '(account_number)',
    'import_batches':     '(batch_number)',
    'budget_plan':        '(year, month, metric)',
    # Для остальных — DO NOTHING без таргета (по primary key)
}


def open_sqlite(path: str) -> sqlite3.Connection:
    if not os.path.exists(path):
        sys.exit(f'❌ SQLite файл не найден: {path}')
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def get_pg_conn(url: str):
    return psycopg2.connect(url)


def migrate_table(sqlite_conn: sqlite3.Connection, pg_conn, table: str) -> int:
    cur_sqlite = sqlite_conn.cursor()
    try:
        cur_sqlite.execute(f'SELECT * FROM {table}')
    except sqlite3.OperationalError:
        print(f'  ⏭  пропускаю {table} (нет в SQLite)')
        return 0
    rows: List[sqlite3.Row] = cur_sqlite.fetchall()
    if not rows:
        print(f'  ⏭  {table} — пусто')
        return 0

    cols = [d[0] for d in cur_sqlite.description]
    values: List[Tuple] = [tuple(row[c] for c in cols) for row in rows]
    col_list = ', '.join(cols)

    target = CONFLICT_TARGETS.get(table)
    if target:
        sql = f'INSERT INTO {table} ({col_list}) VALUES %s ON CONFLICT {target} DO NOTHING'
    else:
        sql = f'INSERT INTO {table} ({col_list}) VALUES %s ON CONFLICT (id) DO NOTHING'

    with pg_conn.cursor() as cur_pg:
        execute_values(cur_pg, sql, values)
    print(f'  ✅ {table}: {len(values)} строк (DO NOTHING при конфликте)')
    return len(values)


def fix_sequences(pg_conn) -> None:
    """SERIAL-последовательности нужно подкрутить к max(id) после bulk-вставки."""
    with pg_conn.cursor() as cur:
        for table in TABLES_IN_ORDER:
            cur.execute(f"""
                SELECT pg_get_serial_sequence('{table}', 'id'),
                       COALESCE(MAX(id), 0)
                  FROM {table}
            """) if False else None  # ниже отдельный запрос для безопасности
            cur.execute(
                "SELECT pg_get_serial_sequence(%s, 'id')",
                (table,),
            )
            seq_row = cur.fetchone()
            if not seq_row or not seq_row[0]:
                continue
            seq_name = seq_row[0]
            cur.execute(f'SELECT COALESCE(MAX(id), 0) FROM {table}')
            max_id = cur.fetchone()[0] or 0
            if max_id > 0:
                cur.execute(f"SELECT setval('{seq_name}', {max_id}, true)")
                print(f'  🔢 {table}: setval({seq_name}, {max_id})')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--sqlite', default=os.getenv('SQLITE_PATH', 'instance/dashboard.db'))
    parser.add_argument('--pg-url', default=os.getenv('DATABASE_URL'))
    args = parser.parse_args()

    if not args.pg_url:
        sys.exit('❌ Нужен DATABASE_URL (или флаг --pg-url) для PostgreSQL')
    pg_url = args.pg_url
    if pg_url.startswith('postgres://'):
        pg_url = 'postgresql://' + pg_url[len('postgres://'):]

    print(f'📂 SQLite: {args.sqlite}')
    print(f'🐘 Postgres: {pg_url.split("@")[-1] if "@" in pg_url else "***"}')

    sqlite_conn = open_sqlite(args.sqlite)
    pg_conn = get_pg_conn(pg_url)
    pg_conn.autocommit = False

    try:
        total = 0
        for table in TABLES_IN_ORDER:
            total += migrate_table(sqlite_conn, pg_conn, table)
        pg_conn.commit()
        print(f'\n✅ Всего перенесено: {total} строк')

        print('\n🔢 Подкручиваю SERIAL-последовательности...')
        fix_sequences(pg_conn)
        pg_conn.commit()

    except Exception as e:
        pg_conn.rollback()
        print(f'\n❌ Ошибка миграции: {e}')
        raise
    finally:
        sqlite_conn.close()
        pg_conn.close()

    print('\n🎉 Migration complete!')


if __name__ == '__main__':
    main()
