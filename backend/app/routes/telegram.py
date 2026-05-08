"""Module 8: Telegram Bot — webhook, команды, broadcast, уведомления.

Реальная отправка сообщений происходит через Telegram Bot API, если задан
TELEGRAM_BOT_TOKEN в env. Без токена endpoint /api/telegram/broadcast возвращает
«dry-run» результат (что было бы отправлено), но сообщения в Telegram не идут.

Webhook /api/telegram/webhook принимает payload от Telegram, парсит /команды
и сохраняет TelegramUser. Готовый ответ возвращается в JSON (для Telegram —
ответ нужно отправлять отдельным запросом, реализовано в _send_message).
"""
from datetime import date, datetime, timedelta
from typing import List, Optional
import os

from flask import Blueprint, jsonify, request, current_app
from sqlalchemy import func

from app.models import (
    CashTransaction, ExpenseCategory, Product, SaleItem,
    TelegramUser, WarrantyClaim, db,
)

bp = Blueprint('telegram', __name__, url_prefix='/api/telegram')

VALID_ROLES = {'admin', 'manager', 'viewer'}
DEFAULT_BOT_USERNAME = 'tushun_dashboard_bot'

# In-process notifications log (для UI Module 8)
_notifications_log: List[dict] = []
_LOG_LIMIT = 100


def _bot_token() -> Optional[str]:
    return os.getenv('TELEGRAM_BOT_TOKEN')


def _bot_username() -> str:
    return os.getenv('TELEGRAM_BOT_USERNAME', DEFAULT_BOT_USERNAME)


def _send_message(chat_id: int, text: str, parse_mode: str = 'Markdown') -> bool:
    """Отправить сообщение пользователю Telegram.

    Возвращает True если отправлено реально, False если dry-run (нет токена).
    """
    token = _bot_token()
    log_entry = {
        'chat_id': chat_id,
        'text': text[:200],
        'sent_at': datetime.utcnow().isoformat(),
        'real': bool(token),
    }
    _notifications_log.insert(0, log_entry)
    if len(_notifications_log) > _LOG_LIMIT:
        _notifications_log.pop()

    if not token:
        return False

    # Реальная отправка через Bot API
    try:
        import urllib.request
        import urllib.parse
        import json
        url = f'https://api.telegram.org/bot{token}/sendMessage'
        data = urllib.parse.urlencode({
            'chat_id': chat_id, 'text': text, 'parse_mode': parse_mode,
        }).encode()
        req = urllib.request.Request(url, data=data)
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = json.loads(resp.read().decode())
            return bool(body.get('ok'))
    except Exception as e:
        current_app.logger.warning('telegram send failed: %s', e)
        return False


# ---------- COMMAND HANDLERS ----------

def _cmd_start(user: TelegramUser) -> str:
    return (
        f"👋 Добро пожаловать, *{user.full_name or user.username}*!\n\n"
        f"Ты подключился к *Tushun Dashboard Bot*.\n"
        f"Текущая роль: `{user.role}`\n"
        f"Подписки: `{user.subscriptions}`\n\n"
        "*Доступные команды:*\n"
        "/status — текущий статус KPI\n"
        "/sales — продажи за 7 дней\n"
        "/expenses — расходы по категориям\n"
        "/alerts — критичные уведомления\n"
        "/forecast — прогноз на месяц\n"
        "/help — эта справка"
    )


def _cmd_help(_: TelegramUser) -> str:
    return (
        "*Команды бота:*\n\n"
        "/start — подключение\n"
        "/status — KPI продаж/расходов сейчас\n"
        "/sales — последние продажи\n"
        "/expenses — расходы текущего месяца\n"
        "/alerts — критичные алерты\n"
        "/forecast — прогноз расходов\n"
        "/help — эта справка"
    )


def _cmd_status(_: TelegramUser) -> str:
    today = date.today()
    week_ago = today - timedelta(days=7)
    revenue = float(db.session.query(
        func.coalesce(func.sum(SaleItem.total_revenue_kzt), 0)
    ).filter(SaleItem.sale_date >= week_ago).scalar() or 0)
    expenses = float(db.session.query(
        func.coalesce(func.sum(CashTransaction.amount_kzt), 0)
    ).filter(
        CashTransaction.transaction_type == 'expense',
        CashTransaction.transaction_date >= week_ago,
    ).scalar() or 0)
    products_cnt = Product.query.count()
    open_claims = WarrantyClaim.query.filter(
        WarrantyClaim.status.in_(['open', 'in_review'])
    ).count()
    return (
        "*📊 Статус Tushun Dashboard*\n\n"
        f"💰 Выручка (7 дн): *₸{revenue:,.0f}*\n"
        f"💸 Расходы (7 дн): *₸{expenses:,.0f}*\n"
        f"📈 Маржа: *₸{revenue - expenses:,.0f}*\n\n"
        f"📦 Товаров в каталоге: {products_cnt}\n"
        f"⚠️ Открытых рекламаций: {open_claims}"
    )


def _cmd_sales(_: TelegramUser) -> str:
    today = date.today()
    week_ago = today - timedelta(days=7)
    rows = (db.session.query(
                SaleItem.sale_date,
                func.coalesce(func.sum(SaleItem.total_revenue_kzt), 0).label('rev'),
                func.count(SaleItem.id).label('cnt'),
            )
            .filter(SaleItem.sale_date >= week_ago)
            .group_by(SaleItem.sale_date)
            .order_by(SaleItem.sale_date.desc())
            .limit(7).all())
    if not rows:
        return "📊 *Продажи за 7 дней*\n\nДанных нет"
    total = sum(float(r.rev) for r in rows)
    lines = ["*📊 Продажи за 7 дней*\n"]
    for r in rows:
        lines.append(f"`{r.sale_date}` ₸{float(r.rev):>10,.0f} ({r.cnt} операций)")
    lines.append(f"\n*ИТОГО:* ₸{total:,.0f}")
    return "\n".join(lines)


def _cmd_expenses(_: TelegramUser) -> str:
    today = date.today()
    month_start = today.replace(day=1)
    rows = (db.session.query(
                ExpenseCategory.name, ExpenseCategory.icon,
                func.coalesce(func.sum(CashTransaction.amount_kzt), 0).label('amt'),
            )
            .select_from(ExpenseCategory)
            .outerjoin(CashTransaction,
                       (CashTransaction.expense_category_id == ExpenseCategory.id) &
                       (CashTransaction.transaction_type == 'expense') &
                       (CashTransaction.transaction_date >= month_start))
            .filter(ExpenseCategory.is_active == True)  # noqa: E712
            .group_by(ExpenseCategory.id)
            .order_by(func.sum(CashTransaction.amount_kzt).desc().nullslast())
            .all())
    total = sum(float(r.amt or 0) for r in rows)
    lines = ["*💸 Расходы текущего месяца*\n"]
    for r in rows:
        if (r.amt or 0) > 0:
            lines.append(f"{r.icon or '📁'} {r.name}: *₸{float(r.amt):,.0f}*")
    lines.append(f"\n*ИТОГО:* ₸{total:,.0f}")
    return "\n".join(lines)


def _cmd_alerts(_: TelegramUser) -> str:
    today = date.today()
    month_start = today.replace(day=1)
    cats = ExpenseCategory.query.filter_by(is_active=True).all()
    lines = ["*⚠️ Критичные уведомления*\n"]
    found = 0
    for c in cats:
        if c.monthly_limit_kzt <= 0:
            continue
        fact = float(db.session.query(
            func.coalesce(func.sum(CashTransaction.amount_kzt), 0)
        ).filter(
            CashTransaction.transaction_type == 'expense',
            CashTransaction.transaction_date >= month_start,
            CashTransaction.expense_category_id == c.id,
        ).scalar() or 0)
        used = fact / c.monthly_limit_kzt * 100
        if fact > c.monthly_limit_kzt:
            lines.append(f"🔴 {c.icon or ''} *{c.name}*: {used:.0f}% (превышение ₸{fact - c.monthly_limit_kzt:,.0f})")
            found += 1
        elif used >= c.alert_percent:
            lines.append(f"🟡 {c.icon or ''} *{c.name}*: {used:.0f}% от лимита")
            found += 1

    open_claims = WarrantyClaim.query.filter(
        WarrantyClaim.status.in_(['open', 'in_review']),
        WarrantyClaim.claim_date <= today - timedelta(days=14),
    ).count()
    if open_claims > 0:
        lines.append(f"⏰ *Рекламаций > 14 дней:* {open_claims}")
        found += 1

    if found == 0:
        return "*✅ Алертов нет*\n\nВсё в норме!"
    return "\n".join(lines)


def _cmd_forecast(_: TelegramUser) -> str:
    today = date.today()
    month_start = today.replace(day=1)
    days_in_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    days_passed = today.day
    days_left = days_in_month.day - days_passed

    mtd = float(db.session.query(
        func.coalesce(func.sum(CashTransaction.amount_kzt), 0)
    ).filter(
        CashTransaction.transaction_type == 'expense',
        CashTransaction.transaction_date >= month_start,
    ).scalar() or 0)
    avg = mtd / days_passed if days_passed > 0 else 0
    forecast = mtd + avg * days_left

    return (
        "*📅 Прогноз расходов на месяц*\n\n"
        f"Прошло дней: *{days_passed}* / {days_in_month.day}\n"
        f"MTD расходы: *₸{mtd:,.0f}*\n"
        f"В среднем/день: *₸{avg:,.0f}*\n"
        f"Прогноз до конца: *₸{forecast:,.0f}*"
    )


COMMAND_HANDLERS = {
    '/start':    _cmd_start,
    '/help':     _cmd_help,
    '/status':   _cmd_status,
    '/sales':    _cmd_sales,
    '/expenses': _cmd_expenses,
    '/alerts':   _cmd_alerts,
    '/forecast': _cmd_forecast,
}


def _process_command(user: TelegramUser, text: str) -> str:
    cmd = text.split()[0].lower() if text else ''
    handler = COMMAND_HANDLERS.get(cmd)
    if handler:
        user.last_command = cmd
        user.last_seen = datetime.utcnow()
        db.session.commit()
        return handler(user)
    return f"🤔 Неизвестная команда `{cmd}`. /help — список команд."


# ---------- WEBHOOK ----------

@bp.post('/webhook')
def webhook():
    """Telegram webhook. Принимает payload от Telegram, парсит /команды.

    Структура payload (Telegram Bot API):
    {
      "update_id": ...,
      "message": {
        "message_id": ...,
        "from": {"id": 123, "username": "x", "first_name": "...", ...},
        "chat": {"id": 456, ...},
        "text": "/start",
        ...
      }
    }
    """
    data = request.get_json(silent=True) or {}
    msg = data.get('message') or {}
    from_user = msg.get('from') or {}
    chat = msg.get('chat') or {}
    text = (msg.get('text') or '').strip()

    if not from_user.get('id') or not chat.get('id'):
        return jsonify({'ok': True, 'note': 'no message to process'}), 200

    # Upsert TelegramUser
    user = TelegramUser.query.filter_by(tg_user_id=from_user['id']).first()
    if not user:
        user = TelegramUser(
            tg_user_id=from_user['id'],
            chat_id=chat['id'],
            username=from_user.get('username'),
            full_name=' '.join(filter(None, [
                from_user.get('first_name'), from_user.get('last_name'),
            ])) or None,
            role='viewer',
            subscriptions='alerts',
            language=from_user.get('language_code', 'ru')[:5],
            is_active=True,
        )
        db.session.add(user)
        db.session.commit()

    response_text = ''
    if text.startswith('/'):
        response_text = _process_command(user, text)
    else:
        response_text = "Используй команды (например /status). /help — список."
        user.last_seen = datetime.utcnow()
        db.session.commit()

    sent = _send_message(user.chat_id, response_text)

    return jsonify({
        'ok': True,
        'user_id': user.id,
        'response_text': response_text,
        'sent_to_telegram': sent,  # False если bot token не задан
    })


# ---------- API ----------

@bp.get('/link')
def link_info():
    """Информация для подключения бота: deep-link + QR URL."""
    bot_username = _bot_username()
    deep_link = f'https://t.me/{bot_username}?start=tushun'
    # QR через бесплатный сервис api.qrserver.com (200x200)
    qr_url = f'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data={deep_link}'
    return jsonify({
        'bot_username': bot_username,
        'deep_link': deep_link,
        'qr_url': qr_url,
        'has_token': bool(_bot_token()),
        'webhook_url': '/api/telegram/webhook',  # относительный, фронт сам строит абс
    })


@bp.get('/status')
def status():
    """Статус подключения + список пользователей."""
    users = TelegramUser.query.order_by(TelegramUser.created_at.desc()).all()
    by_role = {'admin': 0, 'manager': 0, 'viewer': 0}
    by_subs = {'alerts': 0, 'sales': 0, 'expenses': 0, 'daily': 0}
    for u in users:
        if u.role in by_role:
            by_role[u.role] += 1
        for s in (u.subscriptions or '').split(','):
            s = s.strip()
            if s in by_subs:
                by_subs[s] += 1
    return jsonify({
        'has_token': bool(_bot_token()),
        'bot_username': _bot_username(),
        'users_count': len(users),
        'active_users_count': sum(1 for u in users if u.is_active),
        'by_role': by_role,
        'by_subscription': by_subs,
        'users': [u.to_dict() for u in users],
        'recent_notifications': _notifications_log[:20],
    })


@bp.post('/subscribe')
def subscribe():
    """Подписка пользователя на уведомления.

    Body: tg_user_id (req), subscriptions (req: csv), notifications_enabled, role
    """
    data = request.get_json(silent=True) or {}
    if not data.get('tg_user_id'):
        return jsonify({'error': 'tg_user_id required'}), 400

    user = TelegramUser.query.filter_by(tg_user_id=int(data['tg_user_id'])).first()
    if not user:
        return jsonify({'error': 'user not found — must /start the bot first'}), 404

    if 'subscriptions' in data:
        subs = data['subscriptions']
        if isinstance(subs, list):
            subs = ','.join(subs)
        user.subscriptions = subs
    if 'notifications_enabled' in data:
        user.notifications_enabled = bool(data['notifications_enabled'])
    if 'role' in data:
        if data['role'] not in VALID_ROLES:
            return jsonify({'error': f'role must be one of {sorted(VALID_ROLES)}'}), 400
        user.role = data['role']
    if 'is_active' in data:
        user.is_active = bool(data['is_active'])

    db.session.commit()
    return jsonify(user.to_dict())


@bp.post('/broadcast')
def broadcast():
    """Отправить сообщение всем активным подписчикам.

    Body: text (req), filter_subscription (опц), filter_role (опц)
    Если bot token не задан — dry-run.
    """
    data = request.get_json(silent=True) or {}
    text = (data.get('text') or '').strip()
    if not text:
        return jsonify({'error': 'text required'}), 400

    q = TelegramUser.query.filter_by(is_active=True, notifications_enabled=True)
    if data.get('filter_role'):
        q = q.filter(TelegramUser.role == data['filter_role'])

    sub_filter = data.get('filter_subscription')
    targets = q.all()
    if sub_filter:
        targets = [u for u in targets if sub_filter in (u.subscriptions or '').split(',')]

    sent_count = 0
    dry_run_count = 0
    for u in targets:
        if _send_message(u.chat_id, text):
            sent_count += 1
        else:
            dry_run_count += 1

    return jsonify({
        'targets_count': len(targets),
        'sent_real': sent_count,
        'dry_run': dry_run_count,
        'has_token': bool(_bot_token()),
        'note': 'Без TELEGRAM_BOT_TOKEN сообщения логируются, но не отправляются.' if not _bot_token() else None,
        'recent_log': _notifications_log[:5],
    })


@bp.delete('/users/<int:user_id>')
def remove_user(user_id):
    u = TelegramUser.query.get_or_404(user_id)
    db.session.delete(u)
    db.session.commit()
    return jsonify({'deleted': True, 'id': user_id})


# ---------- AUTO-NOTIFICATIONS HELPER ----------

def notify_critical_alert(category_name: str, used_percent: float, fact_kzt: float, limit_kzt: float) -> int:
    """Авто-уведомление подписчикам о критичном превышении бюджета.

    Возвращает количество получателей.
    """
    text = (
        "🔴 *Критичное превышение бюджета*\n\n"
        f"Категория: *{category_name}*\n"
        f"Использовано: *{used_percent:.0f}%*\n"
        f"Факт: ₸{fact_kzt:,.0f}\n"
        f"Лимит: ₸{limit_kzt:,.0f}\n"
        f"Превышение: *₸{fact_kzt - limit_kzt:,.0f}*"
    )
    targets = TelegramUser.query.filter(
        TelegramUser.is_active == True,  # noqa: E712
        TelegramUser.notifications_enabled == True,  # noqa: E712
    ).all()
    targets = [u for u in targets if 'alerts' in (u.subscriptions or '').split(',')]
    for u in targets:
        _send_message(u.chat_id, text)
    return len(targets)


def notify_large_sale(invoice_number: str, customer: str, amount_kzt: float) -> int:
    """Уведомление о крупной продаже (> 1M ₸)."""
    if amount_kzt < 1_000_000:
        return 0
    text = (
        "💰 *Крупная продажа*\n\n"
        f"Счёт: `{invoice_number}`\n"
        f"Клиент: *{customer}*\n"
        f"Сумма: *₸{amount_kzt:,.0f}*"
    )
    targets = TelegramUser.query.filter(
        TelegramUser.is_active == True,  # noqa: E712
        TelegramUser.notifications_enabled == True,  # noqa: E712
    ).all()
    targets = [u for u in targets if 'sales' in (u.subscriptions or '').split(',')]
    for u in targets:
        _send_message(u.chat_id, text)
    return len(targets)
