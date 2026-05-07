"""Cash transactions: GET (с фильтрами), POST, summary по категориям."""
from datetime import date, datetime, timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.models import Account, CashTransaction, db

bp = Blueprint('cash_transactions', __name__, url_prefix='/api/finance/cash-transactions')


def _get_period():
    days = request.args.get('days', default=30, type=int)
    end = date.today()
    start = end - timedelta(days=days)
    return start, end, days


@bp.get('/')
def list_transactions():
    start, _, days = _get_period()
    q = (db.session.query(CashTransaction, Account)
         .join(Account, CashTransaction.account_id == Account.id)
         .filter(CashTransaction.transaction_date >= start)
         .order_by(CashTransaction.transaction_date.desc(), CashTransaction.id.desc()))
    rows = q.limit(200).all()
    return jsonify({
        'period_days': days,
        'rows': [{
            'id': tx.id,
            'account_id': tx.account_id,
            'bank_name': acc.bank_name,
            'account_number': acc.account_number,
            'currency': acc.currency,
            'type': tx.transaction_type,
            'category': tx.category,
            'amount_kzt': tx.amount_kzt,
            'description': tx.description,
            'counterparty': tx.counterparty,
            'transaction_date': tx.transaction_date.isoformat() if tx.transaction_date else None,
        } for tx, acc in rows],
    })


@bp.get('/summary')
def summary():
    """Свод по категориям расходов и общий cashflow за период."""
    start, _, days = _get_period()

    income_total = (db.session.query(func.sum(CashTransaction.amount_kzt))
                    .filter(CashTransaction.transaction_date >= start,
                            CashTransaction.transaction_type == 'income')
                    .scalar() or 0)
    expense_total = (db.session.query(func.sum(CashTransaction.amount_kzt))
                     .filter(CashTransaction.transaction_date >= start,
                             CashTransaction.transaction_type == 'expense')
                     .scalar() or 0)

    by_cat = (db.session.query(
        CashTransaction.category,
        func.sum(CashTransaction.amount_kzt).label('total'),
        func.count(CashTransaction.id).label('cnt'),
    )
    .filter(CashTransaction.transaction_date >= start,
            CashTransaction.transaction_type == 'expense')
    .group_by(CashTransaction.category)
    .order_by(func.sum(CashTransaction.amount_kzt).desc())
    .all())

    return jsonify({
        'period_days': days,
        'income_kzt': round(income_total, 2),
        'expense_kzt': round(expense_total, 2),
        'net_kzt': round(income_total - expense_total, 2),
        'by_category': [{
            'category': r.category or 'other',
            'total_kzt': round(r.total or 0, 2),
            'count': r.cnt,
            'percent_of_expenses': round((r.total or 0) / expense_total * 100, 1) if expense_total > 0 else 0,
        } for r in by_cat],
    })


VALID_CATEGORIES = {
    'sales', 'purchase', 'salary', 'rent', 'logistics',
    'utilities', 'marketing', 'tax', 'other',
}


@bp.post('/')
def create_transaction():
    data = request.get_json(silent=True) or {}
    account = Account.query.get(data.get('account_id'))
    if not account:
        return jsonify({'error': 'account_not_found'}), 404
    ttype = data.get('type')
    if ttype not in ('income', 'expense', 'transfer'):
        return jsonify({'error': 'type must be income | expense | transfer'}), 400
    amount = float(data.get('amount_kzt', 0))
    if amount <= 0:
        return jsonify({'error': 'amount_kzt must be > 0'}), 400
    category = data.get('category')
    if category and category not in VALID_CATEGORIES:
        return jsonify({'error': f'category must be one of {sorted(VALID_CATEGORIES)}'}), 400

    tx_date = date.fromisoformat(data['transaction_date']) if data.get('transaction_date') else date.today()
    tx = CashTransaction(
        account_id=account.id,
        transaction_type=ttype,
        category=category,
        amount_kzt=amount,
        description=data.get('description'),
        counterparty=data.get('counterparty'),
        transaction_date=tx_date,
    )
    db.session.add(tx)

    # Обновим баланс счёта
    sign = 1 if ttype == 'income' else -1
    if account.currency == 'KZT':
        account.balance += sign * amount
    # USD счёт — если хотим тут вычесть, нужен USD-amount; пока KZT-only

    db.session.commit()
    return jsonify({
        'id': tx.id,
        'account_id': tx.account_id,
        'type': tx.transaction_type,
        'category': tx.category,
        'amount_kzt': tx.amount_kzt,
        'transaction_date': tx.transaction_date.isoformat(),
        'new_balance': account.balance,
    }), 201
