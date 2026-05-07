import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../../utils/api';

type Tx = Awaited<ReturnType<typeof api.listCashTransactions>>['rows'][number];
type Account = Awaited<ReturnType<typeof api.listAccounts>>[number];

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');
const USD_RATE = 450;

export default function CashflowTab() {
  const [txs, setTxs] = useState<Tx[] | null>(null);
  const [accounts, setAccounts] = useState<Account[] | null>(null);

  useEffect(() => {
    api.listCashTransactions(30).then(d => setTxs(d.rows)).catch(() => setTxs([]));
    api.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  const totals = useMemo(() => {
    const inTotal = (txs ?? []).filter(t => t.type === 'income').reduce((s, t) => s + t.amount_kzt, 0);
    const outTotal = (txs ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_kzt, 0);
    const balanceKzt = (accounts ?? []).reduce((s, a) => s + (a.currency === 'USD' ? a.balance * USD_RATE : a.balance), 0);
    return { inTotal, outTotal, net: inTotal - outTotal, balanceKzt };
  }, [txs, accounts]);

  // Группировка транзакций по дням для bar-chart
  const dailyData = useMemo(() => {
    if (!txs) return [];
    const map = new Map<string, { day: string; in: number; out: number }>();
    for (const t of txs) {
      const day = (t.transaction_date ?? '').slice(8, 10) || '?';
      const key = day;
      if (!map.has(key)) map.set(key, { day: key, in: 0, out: 0 });
      const bucket = map.get(key)!;
      if (t.type === 'income') bucket.in += t.amount_kzt;
      else if (t.type === 'expense') bucket.out += t.amount_kzt;
    }
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [txs]);

  return (
    <>
      <div className="kpi-row-3">
        <div className="kpi-card" style={{ borderColor: 'rgba(201,162,39,.2)' }}>
          <div className="kpi-label">Остаток на счетах</div>
          <div className="cf-balance">
            <div className="cf-balance-cur">₸</div>
            <div className="cf-balance-val">{accounts ? fmt(totals.balanceKzt) : '…'}</div>
          </div>
          <div className="cf-balance-label">{accounts?.length ?? 0} счёта · live</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Поступило за 30 дней</div>
          <div className="kpi-value"><span className="cur">₸</span>{txs ? fmt(totals.inTotal) : '…'}</div>
          <div className="kpi-delta up">за 30 дней · live</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Расход за 30 дней</div>
          <div className="kpi-value" style={{ color: 'var(--red)' }}>
            <span className="cur" style={{ color: 'var(--red)' }}>₸</span>{txs ? fmt(totals.outTotal) : '…'}
          </div>
          <div className="kpi-delta dn">{txs && totals.net < 0 ? `Net ${fmt(totals.net)} ₸` : `Net +${fmt(totals.net)} ₸`}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">ДВИЖЕНИЕ ДЕНЕГ — 30 ДНЕЙ</div>
          <div className="legend">
            <div className="legend-item"><div className="legend-dot" style={{ background: '#34D399' }} />Поступления</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#F87171' }} />Платежи</div>
          </div>
        </div>
        <div className="chart-wrap-lg">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: 'var(--tm)', fontSize: 10, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--tm)', fontSize: 9, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}М`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-el)', border: '1px solid var(--border-l)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 11 }}
                formatter={(v) => fmt(Number(v)) + ' ₸'}
              />
              <Bar dataKey="in" name="Поступления" fill="#34D399" radius={[3, 3, 0, 0]} />
              <Bar dataKey="out" name="Платежи" fill="#F87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">БАЛАНС КАССЫ — 30 ДНЕЙ</div>
            <span className="card-badge badge-gold">Итог</span>
          </div>
          <div className="pl-rows">
            <div className="pl-row">
              <div className="pl-label">+ Поступления (факт)</div>
              <div className="pl-val" style={{ color: 'var(--green)' }}>+₸{txs ? fmt(totals.inTotal) : '…'}</div>
            </div>
            <div className="pl-row">
              <div className="pl-label">− Платежи</div>
              <div className="pl-val" style={{ color: 'var(--red)' }}>−₸{txs ? fmt(totals.outTotal) : '…'}</div>
            </div>
            <div className="pl-row total">
              <div className="pl-label">Чистый поток</div>
              <div className="pl-val" style={{ color: totals.net >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {totals.net >= 0 ? '+' : ''}₸{txs ? fmt(totals.net) : '…'}
              </div>
            </div>
            <div className="pl-row">
              <div className="pl-label">Текущий остаток счетов</div>
              <div className="pl-val">₸{accounts ? fmt(totals.balanceKzt) : '…'}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              ПРЕДСТОЯЩИЕ ПЛАТЕЖИ
              <span style={{ fontSize: 9, color: 'var(--tm)', fontWeight: 400, marginLeft: 6 }}>· demo</span>
            </div>
            <span className="card-badge badge-gold">план</span>
          </div>
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--tm)', fontSize: 12 }}>
            Календарь предстоящих платежей появится когда подключим<br />
            <code style={{ background: 'var(--bg-el)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--mono)', fontSize: 10 }}>scheduled_payments</code> таблицу (Phase 2.5).
          </div>
        </div>
      </div>
    </>
  );
}
