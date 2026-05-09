"""End-to-end smoke test для Phase 1 OCR pipeline.

Создаёт фейк-счёт через PIL, отправляет в Claude Vision, маршрутит как expense
в production Supabase БД.

Запуск:
  ANTHROPIC_API_KEY=sk-ant-... \
  DATABASE_URL='postgresql://postgres.<...>@...pooler.supabase.com:6543/postgres' \
  venv/bin/python test_ocr_phase1.py
"""
import io
import os
import sys

from PIL import Image, ImageDraw, ImageFont


def make_fake_expense_doc() -> bytes:
    """Создаёт изображение 'счёта на оплату аренды' для теста OCR."""
    W, H = 800, 1100
    img = Image.new('RGB', (W, H), 'white')
    draw = ImageDraw.Draw(img)

    # macOS системные шрифты
    try:
        f_title = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Unicode.ttf', 40)
        f_body = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Unicode.ttf', 24)
        f_small = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Unicode.ttf', 18)
    except Exception:
        f_title = ImageFont.load_default()
        f_body = ImageFont.load_default()
        f_small = ImageFont.load_default()

    y = 60
    draw.text((W // 2 - 150, y), 'СЧЁТ-ФАКТУРА', fill='black', font=f_title)
    y += 80
    draw.text((50, y), 'Поставщик: ИП Жанатов', fill='black', font=f_body)
    y += 40
    draw.text((50, y), 'БИН: 920510301234', fill='black', font=f_body)
    y += 40
    draw.text((50, y), 'Адрес: г. Алматы, ул. Толе би 247', fill='black', font=f_body)
    y += 80
    draw.text((50, y), 'Получатель: ТОО «Тушун»', fill='black', font=f_body)
    y += 40
    draw.text((50, y), 'Дата: 8 мая 2026 г.', fill='black', font=f_body)
    y += 80
    draw.text((50, y), 'Назначение платежа:', fill='black', font=f_body)
    y += 40
    draw.text((70, y), '— Аренда офисного помещения за май 2026', fill='black', font=f_body)
    y += 40
    draw.text((70, y), '  по адресу: пр. Достык 89, офис 305', fill='black', font=f_small)
    y += 100
    draw.text((50, y), 'Сумма к оплате: 950 000 тенге', fill='black', font=f_title)
    y += 80
    draw.text((50, y), 'НДС: 152 678 тенге (16%)', fill='black', font=f_body)
    y += 60
    draw.text((50, y), 'Оплатить до: 15 мая 2026 г.', fill='black', font=f_small)
    y += 100
    draw.text((50, y), 'Подпись: ____________', fill='black', font=f_body)

    out = io.BytesIO()
    img.save(out, format='JPEG', quality=85)
    return out.getvalue()


def main():
    if not os.getenv('ANTHROPIC_API_KEY'):
        print('✗ ANTHROPIC_API_KEY not set in env')
        sys.exit(1)
    if not os.getenv('DATABASE_URL'):
        print('✗ DATABASE_URL not set in env (нужна prod Supabase)')
        sys.exit(1)

    print('=== Step 1: Создаю тестовое фото счёта ===')
    img_bytes = make_fake_expense_doc()
    print(f'  size: {len(img_bytes)} bytes')

    # Импорт после env validation
    from app import create_app
    app = create_app('development')
    with app.app_context():
        from app.routes.telegram import (
            _resize_image, _ocr_via_claude, _route_expense, _convert_to_kzt,
        )
        from app.models import CashTransaction, ExpenseCategory, Account, TelegramUser, db

        print()
        print('=== Step 2: Resize 1024px ===')
        resized, mt = _resize_image(img_bytes, max_dim=1024)
        print(f'  resized: {len(resized)} bytes, type={mt}')

        print()
        print('=== Step 3: Claude Vision OCR ===')
        extracted = _ocr_via_claude(resized, mt)
        print(f'  type:        {extracted.get("type")}')
        print(f'  amount:      {extracted.get("amount_value")} {extracted.get("amount_currency")}')
        print(f'  date:        {extracted.get("date")}')
        print(f'  supplier:    {extracted.get("supplier_name")}')
        print(f'  category:    {extracted.get("category")}')
        print(f'  description: {extracted.get("description")}')
        print(f'  confidence:  {extracted.get("confidence")}')

        if extracted.get('type') != 'expense':
            print(f'⚠ Unexpected type {extracted.get("type")}, не маршрутизируем')
            return

        print()
        print('=== Step 4: Convert to KZT через Module 5 ===')
        kzt = _convert_to_kzt(
            extracted.get('amount_value', 0),
            extracted.get('amount_currency', 'KZT'))
        print(f'  KZT: {kzt:,.2f}')

        print()
        print('=== Step 5: Route to expense ===')
        # Создаём фейк-юзера для теста
        user = TelegramUser.query.filter_by(tg_user_id=999777).first()
        if not user:
            user = TelegramUser(
                tg_user_id=999777, chat_id=999777,
                username='ocr_test', full_name='OCR Test',
                role='admin', subscriptions='alerts', is_active=True,
            )
            db.session.add(user)
            db.session.commit()

        # Перед роутингом — подсчитаем сколько расходов было
        before = CashTransaction.query.filter_by(transaction_type='expense').count()
        print(f'  expenses before: {before}')

        result = _route_expense(extracted, user)
        print(f'  result: {result}')

        after = CashTransaction.query.filter_by(transaction_type='expense').count()
        print(f'  expenses after:  {after}')
        print(f'  delta: +{after - before}')

        if result.get('ok'):
            new_tx = CashTransaction.query.get(result['expense_id'])
            print()
            print('=== Step 6: Verify in DB ===')
            print(f'  id:               {new_tx.id}')
            print(f'  amount_kzt:       {new_tx.amount_kzt}')
            print(f'  category:         {new_tx.category}')
            print(f'  description:      {new_tx.description}')
            print(f'  counterparty:     {new_tx.counterparty}')
            print(f'  transaction_date: {new_tx.transaction_date}')
            print()
            print('✓✓✓ END-TO-END PIPELINE WORKS!')


if __name__ == '__main__':
    main()
