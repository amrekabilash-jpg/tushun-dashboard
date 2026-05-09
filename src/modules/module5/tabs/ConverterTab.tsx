import { useEffect, useMemo, useState } from 'react';
import { api, ConvertResult, Currency, ExchangeRate } from '../../../utils/api';

const CURRENCY_FLAGS: Record<Currency, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', CNY: '🇨🇳', RUB: '🇷🇺', KZT: '🇰🇿',
};

const CURRENCY_NAMES: Record<Currency, string> = {
  USD: 'Доллар США', EUR: 'Евро', CNY: 'Китайский юань',
  RUB: 'Российский рубль', KZT: 'Тенге',
};

const ALL_CURRENCIES: Currency[] = ['USD', 'EUR', 'CNY', 'RUB', 'KZT'];

const fmt = (n: number, decimals = 2) =>
  n.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export default function ConverterTab() {
  const [amount, setAmount] = useState('100');
  const [fromCur, setFromCur] = useState<Currency>('USD');
  const [toCur, setToCur] = useState<Currency>('KZT');
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [allRates, setAllRates] = useState<ExchangeRate[]>([]);

  // Подгружаем rates для quick reference
  useEffect(() => {
    api.listExchangeRates({ target: 'KZT' }).then(setAllRates).catch(() => {});
  }, []);

  // Авто-конвертация при изменении
  useEffect(() => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setResult(null);
      return;
    }
    if (fromCur === toCur) {
      setResult({
        amount: amt, from: fromCur, to: toCur, rate: 1, result: amt,
        path: [fromCur],
      });
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.convertCurrency({ amount: amt, from: fromCur, to: toCur })
      .then(r => { if (!cancelled) setResult(r); })
      .catch(e => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Курс не найден');
        setResult(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [amount, fromCur, toCur]);

  const swap = () => {
    setFromCur(toCur);
    setToCur(fromCur);
  };

  // Quick conversions: amount в каждой валюте
  const quickGrid = useMemo(() => {
    if (!allRates.length) return [];
    const baseAmount = parseFloat(amount) || 1;
    // KZT эквивалент входной суммы
    let inKzt: number;
    if (fromCur === 'KZT') {
      inKzt = baseAmount;
    } else {
      const rate = allRates.find(r => r.base_currency === fromCur);
      inKzt = rate ? baseAmount * rate.rate : 0;
    }
    return ALL_CURRENCIES.map(cur => {
      if (cur === 'KZT') return { currency: cur, value: inKzt };
      if (cur === fromCur) return { currency: cur, value: baseAmount };
      const rate = allRates.find(r => r.base_currency === cur);
      return { currency: cur, value: rate && rate.rate > 0 ? inKzt / rate.rate : 0 };
    });
  }, [allRates, amount, fromCur]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Main converter */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 28,
      }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gold)',
          textTransform: 'uppercase', letterSpacing: '0.2em',
          marginBottom: 18, fontWeight: 700,
        }}>
          💱 Конвертор валют
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 1fr', gap: 14, alignItems: 'flex-end' }}>
          {/* From */}
          <div>
            <Label>Сумма ({fromCur})</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number" min="0" step="any"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                style={bigInput}
                placeholder="100"
              />
              <select
                value={fromCur}
                onChange={e => setFromCur(e.target.value as Currency)}
                style={{ ...bigInput, width: 110, fontWeight: 700 }}
              >
                {ALL_CURRENCIES.map(c => (
                  <option key={c} value={c}>{CURRENCY_FLAGS[c]} {c}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 12, color: 'var(--tm)', marginTop: 6 }}>
              {CURRENCY_NAMES[fromCur]}
            </div>
          </div>

          {/* Swap */}
          <div style={{ textAlign: 'center', paddingBottom: 26 }}>
            <button onClick={swap} style={{
              background: 'var(--bg-el)', border: '1px solid var(--gold)',
              borderRadius: 8, color: 'var(--gold)', cursor: 'pointer',
              padding: '12px 14px', fontSize: 18, fontFamily: 'inherit',
            }}>⇄</button>
          </div>

          {/* To */}
          <div>
            <Label>Получите ({toCur})</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{
                ...bigInput, flex: 1,
                background: 'var(--bg-el)',
                color: 'var(--gold)', fontWeight: 700,
                display: 'flex', alignItems: 'center',
                fontFamily: 'var(--mono)', fontSize: 22,
              }}>
                {loading ? '…' : result ? fmt(result.result) : '—'}
              </div>
              <select
                value={toCur}
                onChange={e => setToCur(e.target.value as Currency)}
                style={{ ...bigInput, width: 110, fontWeight: 700 }}
              >
                {ALL_CURRENCIES.map(c => (
                  <option key={c} value={c}>{CURRENCY_FLAGS[c]} {c}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 12, color: 'var(--tm)', marginTop: 6 }}>
              {CURRENCY_NAMES[toCur]}
            </div>
          </div>
        </div>

        {/* Conversion details */}
        {result && (
          <div style={{
            marginTop: 22, padding: 14, background: 'var(--bg-el)',
            border: '1px solid var(--border)', borderRadius: 8,
          }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10,
            }}>
              Детали расчёта
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <DetailCell
                label="Курс"
                value={`1 ${result.from} = ${fmt(result.rate, 4)} ${result.to}`}
                accent
              />
              <DetailCell
                label="Маршрут"
                value={result.path.map(c => CURRENCY_FLAGS[c] + ' ' + c).join(' → ')}
              />
              {result.rate_date && (
                <DetailCell label="Курс на дату" value={result.rate_date} mono />
              )}
              {result.path.length === 3 && result.leg_1 && result.leg_2 && (
                <DetailCell
                  label="Через KZT"
                  value={`${result.leg_1.pair} = ${fmt(result.leg_1.rate, 4)} · ${result.leg_2.pair} = ${fmt(result.leg_2.rate, 6)}`}
                  small
                />
              )}
            </div>
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 14, padding: '10px 14px',
            background: 'rgba(248,113,113,.10)', border: '1px solid var(--red)',
            borderRadius: 6, color: 'var(--red)', fontSize: 12.5,
          }}>{error}</div>
        )}
      </div>

      {/* Quick reference grid */}
      {allRates.length > 0 && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 18,
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
            textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14,
          }}>
            {amount || '1'} {CURRENCY_FLAGS[fromCur]} {fromCur} в других валютах
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {quickGrid.map(g => (
              <div
                key={g.currency}
                onClick={() => setToCur(g.currency)}
                style={{
                  background: g.currency === toCur ? 'rgba(212,175,55,.10)' : 'var(--bg-el)',
                  border: '1px solid ' + (g.currency === toCur ? 'var(--gold)' : 'var(--border)'),
                  borderRadius: 8, padding: '12px 14px', cursor: 'pointer',
                }}
              >
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
                  textTransform: 'uppercase', marginBottom: 6,
                }}>
                  {CURRENCY_FLAGS[g.currency]} {g.currency}
                </div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700,
                  color: g.currency === fromCur ? 'var(--tm)' : 'var(--gold)',
                }}>
                  {fmt(g.value)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)', marginTop: 10 }}>
            Клик по карточке → выбрать как валюту получения
          </div>
        </div>
      )}

      {/* Rate sources info */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 14,
        fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)', lineHeight: 1.7,
      }}>
        💡 Если прямой курс между валютами не задан, конвертор автоматически считает через KZT
        (USD → KZT → EUR). Курсы загружены: {allRates.map(r => r.base_currency).join(', ')} → KZT.
        Для добавления нового курса перейди во вкладку «Курсы».
      </div>
    </div>
  );
}

const bigInput: React.CSSProperties = {
  background: 'var(--bg-deep)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '14px 16px', color: 'var(--tp)',
  fontSize: 22, fontFamily: 'var(--mono)', width: '100%',
  boxSizing: 'border-box',
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
      textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

function DetailCell({ label, value, mono, accent, small }: {
  label: string; value: string; mono?: boolean; accent?: boolean; small?: boolean;
}) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--tm)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontFamily: mono ? 'var(--mono)' : 'inherit',
        fontSize: small ? 11 : 13.5,
        fontWeight: accent ? 700 : 500,
        color: accent ? 'var(--gold)' : 'var(--tp)',
      }}>{value}</div>
    </div>
  );
}
