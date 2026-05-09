import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { api, Currency, ExchangeRate, RateSource } from '../../../utils/api';

const CURRENCY_FLAGS: Record<Currency, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', CNY: '🇨🇳', RUB: '🇷🇺', KZT: '🇰🇿',
};

const SOURCE_LABEL: Record<RateSource, string> = {
  manual: 'Ручной', nbk: 'НБК', xe: 'XE.com', api: 'API',
};

const today = () => new Date().toISOString().slice(0, 10);

const SERIES_COLORS: Record<string, string> = {
  USD: '#5fa8ff', EUR: '#d4af37', CNY: '#ef4444', RUB: '#22c55e',
};

export default function RatesTab() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [history, setHistory] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [formBase, setFormBase] = useState<Currency>('USD');
  const [formRate, setFormRate] = useState('');
  const [formDate, setFormDate] = useState(today());
  const [formSource, setFormSource] = useState<RateSource>('manual');
  const [formNote, setFormNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    try {
      const [r, h] = await Promise.all([
        api.listExchangeRates({ target: 'KZT' }),
        api.getRateHistory({ target: 'KZT', limit: 200 }),
      ]);
      setRates(r);
      setHistory(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  // Группировка истории по дате для графика
  const chartData = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const r of history) {
      if (!r.rate_date) continue;
      if (!byDate.has(r.rate_date)) {
        byDate.set(r.rate_date, { date: r.rate_date });
      }
      byDate.get(r.rate_date)![r.base_currency] = r.rate;
    }
    return Array.from(byDate.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );
  }, [history]);

  const submit = async () => {
    const rate = parseFloat(formRate);
    if (!rate || rate <= 0) {
      setError('Курс должен быть > 0');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createExchangeRate({
        base_currency: formBase,
        target_currency: 'KZT',
        rate,
        rate_date: formDate,
        source: formSource,
        note: formNote || undefined,
      });
      setFormRate('');
      setFormNote('');
      setShowForm(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSubmitting(false);
    }
  };

  const removeRate = async (id: number) => {
    if (!confirm('Удалить курс?')) return;
    try {
      await api.deleteExchangeRate(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка курсов…</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Current rates */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {rates.map(r => {
          const trend = r.week_change_percent;
          return (
            <div key={r.id} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>
                  {CURRENCY_FLAGS[r.base_currency]} {r.base_currency} → {r.target_currency}
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--tm)' }}>
                  {SOURCE_LABEL[r.source]}
                </span>
              </div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 28, fontWeight: 700,
                color: 'var(--gold)', lineHeight: 1, marginBottom: 8,
              }}>
                {r.rate.toFixed(2)}
              </div>
              {trend !== null && trend !== undefined && (
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
                  color: trend > 0 ? 'var(--red)' : trend < 0 ? 'var(--green)' : 'var(--tm)',
                }}>
                  {trend > 0 ? '↑' : trend < 0 ? '↓' : '='} {Math.abs(trend).toFixed(2)}% за неделю
                </div>
              )}
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)', marginTop: 6 }}>
                {r.rate_date}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 16,
      }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
          textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12,
        }}>
          График курсов к KZT
        </div>
        {chartData.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--tm)', fontSize: 13 }}>
            Нет данных для графика
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="var(--tm)" tick={{ fontSize: 11, fontFamily: 'var(--mono)' }} />
              <YAxis stroke="var(--tm)" tick={{ fontSize: 11, fontFamily: 'var(--mono)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-el)', border: '1px solid var(--border-l)', borderRadius: 6 }}
                labelStyle={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)' }}
                itemStyle={{ fontFamily: 'var(--mono)', fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontFamily: 'var(--mono)', fontSize: 11 }} />
              {(['USD', 'EUR', 'CNY', 'RUB'] as Currency[]).map(cur => (
                <Line
                  key={cur} type="monotone" dataKey={cur}
                  stroke={SERIES_COLORS[cur]} strokeWidth={2}
                  dot={false} connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center',
        padding: '10px 14px', background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 8,
      }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)' }}>
          Записей в истории: {history.length}
        </span>
        <button className="btn btn-gold" style={{ marginLeft: 'auto' }}
          onClick={() => { setShowForm(s => !s); setError(null); }}>
          {showForm ? '✕ Закрыть' : '+ Добавить курс'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--gold)',
          borderRadius: 10, padding: 18,
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gold)',
            textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14,
          }}>
            Новый курс к KZT
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <Field label="Валюта" required>
              <select value={formBase} onChange={e => setFormBase(e.target.value as Currency)}>
                <option value="USD">USD 🇺🇸</option>
                <option value="EUR">EUR 🇪🇺</option>
                <option value="CNY">CNY 🇨🇳</option>
                <option value="RUB">RUB 🇷🇺</option>
              </select>
            </Field>
            <Field label="Курс к KZT" required>
              <input type="number" step="0.0001" min="0"
                value={formRate} onChange={e => setFormRate(e.target.value)}
                placeholder="450.00" />
            </Field>
            <Field label="Дата">
              <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
            </Field>
            <Field label="Источник">
              <select value={formSource} onChange={e => setFormSource(e.target.value as RateSource)}>
                <option value="manual">Ручной</option>
                <option value="nbk">НБК</option>
                <option value="xe">XE.com</option>
                <option value="api">API</option>
              </select>
            </Field>
            <Field label="Примечание">
              <input value={formNote} onChange={e => setFormNote(e.target.value)} />
            </Field>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button className="btn btn-gold" onClick={submit} disabled={submitting}>
              {submitting ? 'Сохранение…' : 'Сохранить'}
            </button>
            <button className="btn btn-outline" onClick={() => { setShowForm(false); setError(null); }}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(248,113,113,.10)', border: '1px solid var(--red)',
          borderRadius: 6, padding: '10px 14px', color: 'var(--red)', fontSize: 12.5,
        }}>{error}</div>
      )}

      {/* History table */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 16px', background: 'var(--bg-el)',
          borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
          textTransform: 'uppercase', letterSpacing: '0.15em',
        }}>
          История курсов
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: '110px 100px 120px 110px 1fr 60px',
          gap: 8, padding: '10px 16px', fontSize: 10, color: 'var(--tm)',
          fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.1em',
          borderBottom: '1px solid var(--border)',
        }}>
          <span>Дата</span>
          <span>Пара</span>
          <span style={{ textAlign: 'right' }}>Курс</span>
          <span>Источник</span>
          <span>Примечание</span>
          <span></span>
        </div>
        {history.map(r => (
          <div key={r.id} style={{
            display: 'grid', gridTemplateColumns: '110px 100px 120px 110px 1fr 60px',
            gap: 8, padding: '10px 16px', alignItems: 'center', fontSize: 12.5,
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--ts)' }}>{r.rate_date}</span>
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--tp)' }}>
              {CURRENCY_FLAGS[r.base_currency]} {r.base_currency}/{r.target_currency}
            </span>
            <span style={{
              fontFamily: 'var(--mono)', textAlign: 'right',
              color: 'var(--gold)', fontWeight: 600,
            }}>{r.rate.toFixed(4)}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ts)' }}>
              {SOURCE_LABEL[r.source]}
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--ts)' }}>{r.note || '—'}</span>
            <button onClick={() => removeRate(r.id)} style={{
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 4, color: 'var(--red)', cursor: 'pointer',
              padding: '3px 8px', fontSize: 11,
            }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
      }}>
        {label}{required && <span style={{ color: 'var(--red)' }}> *</span>}
      </span>
      <div>{children}</div>
      <style>{`
        label > div input, label > div select {
          width: 100%;
          background: var(--bg-el);
          border: 1px solid var(--border);
          border-radius: 5px;
          padding: 7px 10px;
          color: var(--tp);
          font-size: 12.5px;
          font-family: inherit;
          box-sizing: border-box;
        }
        label > div input:focus, label > div select:focus {
          outline: none; border-color: var(--gold);
        }
      `}</style>
    </label>
  );
}
