import { useEffect, useMemo, useState } from 'react';
import { api, Customer, Payment, PaymentMethod } from '../../../utils/api';
import { useAppStore } from '../../../store';
import { useModule3Store } from '../store';

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');

const METHOD_LABEL: Record<PaymentMethod, string> = {
  bank: 'Банк', cash: 'Наличные', kaspi: 'Kaspi', card: 'Карта', other: 'Другое',
};

const METHOD_COLOR: Record<PaymentMethod, string> = {
  bank:  'var(--green)',
  cash:  'var(--yellow)',
  kaspi: 'var(--gold)',
  card:  'var(--blue, #5fa8ff)',
  other: 'var(--tm)',
};

export default function PaymentTab() {
  const setRoute = useAppStore(s => s.setRoute);
  const setTab = useAppStore(s => s.setTab);
  const setSelectedInvoice = useModule3Store(s => s.setSelectedInvoice);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [methodFilter, setMethodFilter] = useState<'all' | PaymentMethod>('all');
  const [customerFilter, setCustomerFilter] = useState<'all' | number>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const refresh = async () => {
    try {
      const params: Parameters<typeof api.listPayments>[0] = { limit: 200 };
      if (methodFilter !== 'all') params.method = methodFilter;
      if (customerFilter !== 'all') params.customer_id = customerFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const data = await api.listPayments(params);
      setPayments(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.listCustomers().then(setCustomers).catch(() => {});
  }, []);

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [methodFilter, customerFilter, dateFrom, dateTo]);

  const totals = useMemo(() => {
    const byMethod: Record<string, { count: number; sum: number }> = {};
    let total = 0;
    for (const p of payments) {
      total += p.amount_kzt;
      if (!byMethod[p.method]) byMethod[p.method] = { count: 0, sum: 0 };
      byMethod[p.method].count++;
      byMethod[p.method].sum += p.amount_kzt;
    }
    return { total, byMethod, count: payments.length };
  }, [payments]);

  const openInvoice = (invoiceId: number) => {
    setSelectedInvoice(invoiceId);
    setRoute(3);
    setTab(3, 'm3-detail');
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка платежей…</div>;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <SummaryCard label="Всего платежей" value={String(totals.count)} hint="по фильтрам" />
        <SummaryCard
          label="Сумма по фильтрам"
          value={`₸${fmt(totals.total)}`}
          color="var(--gold)"
          hint="всего получено"
        />
        {(['bank', 'kaspi', 'cash'] as PaymentMethod[]).map(m => (
          <SummaryCard
            key={m}
            label={METHOD_LABEL[m]}
            value={`₸${fmt(totals.byMethod[m]?.sum || 0)}`}
            color={METHOD_COLOR[m]}
            hint={`${totals.byMethod[m]?.count || 0} платежей`}
          />
        ))}
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        padding: '10px 14px', background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 8,
      }}>
        <select value={methodFilter} onChange={e => setMethodFilter(e.target.value as any)} style={selectStyle}>
          <option value="all">Все методы</option>
          <option value="bank">Банк</option>
          <option value="kaspi">Kaspi</option>
          <option value="cash">Наличные</option>
          <option value="card">Карта</option>
          <option value="other">Другое</option>
        </select>
        <select
          value={customerFilter}
          onChange={e => setCustomerFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          style={selectStyle}
        >
          <option value="all">Все клиенты</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--tm)' }}>
          с
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={selectStyle} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--tm)' }}>
          по
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={selectStyle} />
        </label>
        <button onClick={() => { setMethodFilter('all'); setCustomerFilter('all'); setDateFrom(''); setDateTo(''); }}
          className="btn btn-outline" style={{ fontSize: 11 }}>
          Сбросить
        </button>
      </div>

      {error && (
        <div style={{
          background: 'rgba(248,113,113,.10)', border: '1px solid var(--red)',
          borderRadius: 6, padding: '10px 14px', color: 'var(--red)', fontSize: 12.5,
        }}>{error}</div>
      )}

      {/* List */}
      {payments.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 32, textAlign: 'center', color: 'var(--tm)', fontSize: 13,
        }}>
          Платежей не найдено
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '110px 130px 100px 130px 1.5fr 130px',
            gap: 8, padding: '12px 16px', background: 'var(--bg-el)',
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>Дата</span>
            <span>№ Счёта</span>
            <span>Метод</span>
            <span style={{ textAlign: 'right' }}>Сумма ₸</span>
            <span>Референс</span>
            <span>Создано</span>
          </div>
          {payments.map(p => (
            <div
              key={p.id}
              onClick={() => p.invoice_id && openInvoice(p.invoice_id)}
              style={{
                display: 'grid',
                gridTemplateColumns: '110px 130px 100px 130px 1.5fr 130px',
                gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
                borderBottom: '1px solid var(--border)', cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,55,.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--ts)' }}>{p.payment_date}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--gold)', fontWeight: 600 }}>
                {p.invoice_number || '—'}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: METHOD_COLOR[p.method],
              }}>{METHOD_LABEL[p.method]}</span>
              <span style={{
                fontFamily: 'var(--mono)', textAlign: 'right',
                color: 'var(--green)', fontWeight: 700,
              }}>+{fmt(p.amount_kzt)}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ts)' }}>
                {p.reference || '—'}
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)' }}>
                {p.created_at?.slice(0, 16).replace('T', ' ')}
              </span>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)', marginTop: -4 }}>
        Регистрация платежей: открой счёт во вкладке «Счета» → «Зарегистрировать платёж».
        Клик по строке → детали счёта.
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-el)', border: '1px solid var(--border)',
  borderRadius: 5, padding: '7px 10px', color: 'var(--tp)',
  fontSize: 12.5, fontFamily: 'inherit',
};

function SummaryCard({ label, value, color, hint }: {
  label: string; value: string; color?: string; hint?: string;
}) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '14px 16px',
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
      }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 700, color: color || 'var(--tp)',
        lineHeight: 1, marginBottom: hint ? 4 : 0,
      }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--ts)' }}>{hint}</div>}
    </div>
  );
}
