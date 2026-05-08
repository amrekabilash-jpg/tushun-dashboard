import { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { api, ExpenseAlerts, ExpenseForecast, ExpenseSummary } from '../../../utils/api';

const fmtKzt = (n: number) => Math.round(n).toLocaleString('ru-RU');

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--red)',
  warning:  'var(--yellow)',
  info:     'var(--gold)',
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Критично',
  warning:  'Внимание',
  info:     'Прогноз',
};

const SEVERITY_ICON: Record<string, string> = {
  critical: '🔴', warning: '🟡', info: '🔵',
};

export default function AnalyticsTab() {
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [forecast, setForecast] = useState<ExpenseForecast | null>(null);
  const [alerts, setAlerts] = useState<ExpenseAlerts | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [s, f, a] = await Promise.all([
        api.getExpenseSummary(days),
        api.getExpenseForecast(),
        api.getExpenseAlerts(),
      ]);
      setSummary(s);
      setForecast(f);
      setAlerts(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  if (loading) return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка аналитики…</div>;
  if (error)   return <div style={{ padding: 24, color: 'var(--red)' }}>Ошибка: {error}</div>;
  if (!summary || !forecast || !alerts) return null;

  const pieData = summary.by_category.filter(c => c.amount_kzt > 0);
  const dailyData = summary.daily;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Period selector */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center',
        padding: '10px 14px', background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 8,
      }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)' }}>Период:</span>
        {[7, 14, 30, 60, 90].map(d => (
          <button key={d} onClick={() => setDays(d)} style={{
            background: d === days ? 'var(--gold)' : 'var(--bg-el)',
            color: d === days ? 'var(--bg-deep)' : 'var(--ts)',
            border: '1px solid ' + (d === days ? 'var(--gold)' : 'var(--border)'),
            borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{d} дн.</button>
        ))}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)' }}>
          {summary.period_start} → {summary.period_end}
        </span>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <Kpi label={`Расходы за ${days} дн.`}
          value={`₸${fmtKzt(summary.total_kzt)}`}
          color="var(--red)" hint={`${summary.total_count} операций`} />
        <Kpi label="Месяц to-date"
          value={`₸${fmtKzt(summary.month_to_date_kzt)}`}
          color="var(--gold)" hint={`${forecast.days_passed}/${forecast.days_in_month} дней`} />
        <Kpi label="Прогноз на месяц"
          value={`₸${fmtKzt(forecast.forecast_total_kzt)}`}
          color="var(--gold)"
          hint={`avg ₸${fmtKzt(forecast.avg_per_day_kzt)}/день`} />
        <Kpi label="Тренд vs прошлый мес."
          value={`${forecast.trend_percent_vs_prev > 0 ? '+' : ''}${forecast.trend_percent_vs_prev}%`}
          color={forecast.trend_percent_vs_prev > 10 ? 'var(--red)' :
                 forecast.trend_percent_vs_prev > 0 ? 'var(--yellow)' :
                 'var(--green)'}
          hint={`предыдущий: ₸${fmtKzt(forecast.previous_month_kzt)}`} />
        <Kpi label="% от выручки"
          value={`${summary.expense_to_revenue_percent}%`}
          color={summary.expense_to_revenue_percent > 70 ? 'var(--red)' :
                 summary.expense_to_revenue_percent > 50 ? 'var(--yellow)' :
                 'var(--green)'}
          hint={`выручка ₸${fmtKzt(summary.revenue_kzt)}`} />
      </div>

      {/* Alerts */}
      {alerts.alerts.length > 0 && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 16,
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
            textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            ⚠️ Уведомления о бюджете ·
            <span style={{ color: 'var(--red)' }}>critical: {alerts.critical_count}</span> ·
            <span style={{ color: 'var(--yellow)' }}>warning: {alerts.warning_count}</span> ·
            <span style={{ color: 'var(--gold)' }}>info: {alerts.info_count}</span>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {alerts.alerts.map(a => (
              <div key={a.category_id} style={{
                display: 'grid', gridTemplateColumns: '40px 36px 1.5fr 110px 100px 110px 130px',
                gap: 12, alignItems: 'center', padding: '10px 14px',
                background: 'var(--bg-el)',
                border: `1px solid ${SEVERITY_COLOR[a.severity]}`,
                borderRadius: 6, fontSize: 12.5,
              }}>
                <span style={{ fontSize: 18, textAlign: 'center' }}>{SEVERITY_ICON[a.severity]}</span>
                <span style={{ fontSize: 18, textAlign: 'center' }}>{a.icon || '📁'}</span>
                <span style={{ color: 'var(--tp)', fontWeight: 600 }}>{a.category_name}</span>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
                  textAlign: 'right',
                  color: SEVERITY_COLOR[a.severity],
                }}>{a.used_percent}%</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)', textAlign: 'right' }}>
                  ₸{fmtKzt(a.fact_kzt)}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ts)', textAlign: 'right' }}>
                  / ₸{fmtKzt(a.limit_kzt)}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                  textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em',
                  color: SEVERITY_COLOR[a.severity],
                  border: `1px solid ${SEVERITY_COLOR[a.severity]}`,
                }}>{SEVERITY_LABEL[a.severity]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
        {/* Pie by category */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 16,
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
            textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12,
          }}>
            Распределение по категориям
          </div>
          {pieData.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--tm)', fontSize: 13 }}>
              Нет расходов в периоде
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="amount_kzt"
                  nameKey="category_name"
                  cx="50%" cy="50%" innerRadius={50} outerRadius={100}
                  label={(d: any) => `${d.payload?.percent_of_total ?? ''}%`}
                  labelLine={false}
                >
                  {pieData.map((d, i) => (
                    <Cell key={i} fill={d.color} stroke="var(--bg-deep)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--bg-el)', border: '1px solid var(--border-l)', borderRadius: 6 }}
                  formatter={(value: any) => [`₸${fmtKzt(Number(value))}`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          {/* Legend */}
          <div style={{ display: 'grid', gap: 4, marginTop: 12 }}>
            {pieData.map(d => (
              <div key={d.category_id} style={{
                display: 'grid', gridTemplateColumns: '20px 24px 1fr 110px 60px',
                gap: 8, alignItems: 'center', fontSize: 12,
              }}>
                <span style={{
                  width: 12, height: 12, borderRadius: 2, background: d.color, justifySelf: 'center',
                }} />
                <span style={{ fontSize: 14 }}>{d.icon || '📁'}</span>
                <span style={{ color: 'var(--tp)' }}>{d.category_name}</span>
                <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--gold)', fontWeight: 600 }}>
                  ₸{fmtKzt(d.amount_kzt)}
                </span>
                <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tm)', fontSize: 11 }}>
                  {d.percent_of_total}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Line chart of daily expenses */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 16,
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
            textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12,
          }}>
            Динамика расходов
          </div>
          {dailyData.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--tm)', fontSize: 13 }}>
              Нет данных
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dailyData}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="var(--tm)"
                  tick={{ fontSize: 10, fontFamily: 'var(--mono)' }}
                  tickFormatter={(d: string) => d?.slice(5) || ''} />
                <YAxis stroke="var(--tm)" tick={{ fontSize: 10, fontFamily: 'var(--mono)' }}
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}K`} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-el)', border: '1px solid var(--border-l)', borderRadius: 6 }}
                  formatter={(v: any) => [`₸${fmtKzt(Number(v))}`, 'Расходы']}
                />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'var(--mono)' }} />
                <Line type="monotone" dataKey="amount_kzt"
                  name="Ежедневные расходы" stroke="#ef4444"
                  strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Forecast by category */}
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
          Прогноз до конца месяца ({forecast.days_left} дней осталось)
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: '36px 1.5fr 110px 130px 130px 130px 110px',
          gap: 8, padding: '10px 16px', fontSize: 10, color: 'var(--tm)',
          fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.1em',
          borderBottom: '1px solid var(--border)',
        }}>
          <span></span>
          <span>Категория</span>
          <span style={{ textAlign: 'right' }}>Avg/день</span>
          <span style={{ textAlign: 'right' }}>MTD ₸</span>
          <span style={{ textAlign: 'right' }}>Прогноз ₸</span>
          <span style={{ textAlign: 'right' }}>Бюджет ₸</span>
          <span>Статус</span>
        </div>
        {forecast.by_category.map(c => (
          <div key={c.category_id} style={{
            display: 'grid', gridTemplateColumns: '36px 1.5fr 110px 130px 130px 130px 110px',
            gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
            borderBottom: '1px solid var(--border)',
            background: c.will_exceed ? 'rgba(248,113,113,.05)' : 'transparent',
          }}>
            <span style={{ fontSize: 18, textAlign: 'center' }}>{c.icon || '📁'}</span>
            <span style={{ color: 'var(--tp)', fontWeight: 500 }}>{c.category_name}</span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>
              {fmtKzt(c.avg_per_day_kzt)}
            </span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tp)' }}>
              {fmtKzt(c.mtd_kzt)}
            </span>
            <span style={{
              fontFamily: 'var(--mono)', textAlign: 'right', fontWeight: 600,
              color: c.will_exceed ? 'var(--red)' : 'var(--gold)',
            }}>
              {fmtKzt(c.forecast_total_kzt)}
            </span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tm)' }}>
              {c.budget_kzt > 0 ? fmtKzt(c.budget_kzt) : '—'}
            </span>
            <span>
              {c.will_exceed ? (
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                  padding: '3px 8px', borderRadius: 4,
                  color: 'var(--red)', border: '1px solid var(--red)',
                }}>
                  +₸{fmtKzt(c.over_by_kzt)}
                </span>
              ) : c.budget_kzt > 0 ? (
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                  padding: '3px 8px', borderRadius: 4,
                  color: 'var(--green)', border: '1px solid var(--green)',
                }}>OK</span>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--tm)' }}>—</span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)' }}>
        Прогноз = MTD + (avg_per_day × days_left). Категории с риском перерасхода подсвечены красным.
      </div>
    </div>
  );
}

function Kpi({ label, value, color, hint }: {
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
      <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--tp)', lineHeight: 1, marginBottom: 4 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 11, color: 'var(--ts)' }}>{hint}</div>}
    </div>
  );
}
