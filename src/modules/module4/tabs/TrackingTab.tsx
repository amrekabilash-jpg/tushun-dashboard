import { useEffect, useState } from 'react';
import { api, BatchDetail, BatchStatus, Warehouse } from '../../../utils/api';
import { useAppStore } from '../../../store';
import { useModule4Store } from '../store';

const fmtKzt = (n: number) => Math.round(n).toLocaleString('ru-RU');
const fmtUsd = (n: number) => Math.round(n).toLocaleString('en-US');

const STATUS_LABEL: Record<BatchStatus, string> = {
  draft: 'Черновик', in_transit: 'В пути', arrived: 'Прибыл',
  completed: 'Завершён', cancelled: 'Отменён',
};

const STATUS_COLOR: Record<BatchStatus, string> = {
  draft: 'var(--tm)', in_transit: 'var(--gold)', arrived: 'var(--green)',
  completed: 'var(--blue, #5fa8ff)', cancelled: 'var(--red)',
};

const today = () => new Date().toISOString().slice(0, 10);

const NEXT_STATUSES: Record<BatchStatus, BatchStatus[]> = {
  draft:      ['in_transit', 'cancelled'],
  in_transit: ['arrived', 'cancelled'],
  arrived:    ['completed'],
  completed:  [],
  cancelled:  [],
};

export default function TrackingTab() {
  const selectedBatchId = useModule4Store(s => s.selectedBatchId);
  const setSelectedBatch = useModule4Store(s => s.setSelectedBatch);
  const setTab = useAppStore(s => s.setTab);

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Edit form
  const [editingTracking, setEditingTracking] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [etaDate, setEtaDate] = useState('');
  const [destWarehouse, setDestWarehouse] = useState<number | ''>('');

  // Status change form
  const [showStatusForm, setShowStatusForm] = useState<BatchStatus | null>(null);
  const [arrivalDate, setArrivalDate] = useState(today());
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    if (!selectedBatchId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getBatch(selectedBatchId);
      setBatch(data);
      setTrackingNumber(data.tracking_number || '');
      setEtaDate(data.eta_date || '');
      setDestWarehouse(data.destination_warehouse_id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.listWarehouses().then(setWarehouses).catch(() => {});
  }, []);

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [selectedBatchId]);

  if (!selectedBatchId) {
    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 32, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>🚚</div>
        <div style={{ fontSize: 14, color: 'var(--ts)', marginBottom: 14 }}>
          Партия не выбрана
        </div>
        <button className="btn btn-outline" onClick={() => setTab(4, 'm4-invoices')}>
          Перейти к списку партий
        </button>
      </div>
    );
  }

  if (loading && !batch) return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка…</div>;
  if (error)   return <div style={{ padding: 24, color: 'var(--red)' }}>Ошибка: {error}</div>;
  if (!batch) return null;

  const saveTracking = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.updateBatch(batch.id, {
        tracking_number: trackingNumber || undefined,
        eta_date: etaDate || undefined,
        destination_warehouse_id: destWarehouse === '' ? null : destWarehouse,
      });
      setEditingTracking(false);
      await refresh();
      setInfo('Tracking-данные обновлены');
      setTimeout(() => setInfo(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = async (newStatus: BatchStatus) => {
    setSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      const payload: Parameters<typeof api.updateBatchStatus>[1] = { status: newStatus };
      if (newStatus === 'arrived') {
        payload.arrival_date = arrivalDate;
        if (destWarehouse !== '') payload.destination_warehouse_id = destWarehouse;
      }
      const res = await api.updateBatchStatus(batch.id, payload);
      setShowStatusForm(null);
      await refresh();
      if (res.stock_movements_created > 0) {
        setInfo(`✓ Статус изменён. Создано ${res.stock_movements_created} движений на складе (auto stock-in).`);
      } else {
        setInfo('✓ Статус изменён.');
      }
      setTimeout(() => setInfo(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  const closeBatch = () => {
    setSelectedBatch(null);
    setTab(4, 'm4-invoices');
  };

  const breakdown = {
    fob: batch.total_fob_usd,
    customs: batch.total_customs_duty_usd,
    vat: batch.total_vat_import_usd,
    other: Math.max(0, batch.total_cost_usd - batch.total_fob_usd - batch.total_customs_duty_usd - batch.total_vat_import_usd),
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Header */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
              letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6,
            }}>
              Партия импорта · ID #{batch.id}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.02em' }}>
              {batch.batch_number}
            </div>
            <div style={{ fontSize: 14, color: 'var(--tp)', marginTop: 6 }}>
              <strong>{batch.supplier_name || '—'}</strong>
              {batch.invoice_number && (
                <span style={{ marginLeft: 12, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ts)' }}>
                  Инвойс: {batch.invoice_number}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
              padding: '5px 12px', borderRadius: 5,
              color: STATUS_COLOR[batch.status],
              border: '1px solid ' + STATUS_COLOR[batch.status],
              letterSpacing: '0.05em',
            }}>{STATUS_LABEL[batch.status]}</span>
            <button onClick={closeBatch} className="btn btn-outline" style={{ fontSize: 11 }}>
              ← К списку
            </button>
          </div>
        </div>

        {/* KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <KpiCell label="Импорт" value={batch.import_date || '—'} mono />
          <KpiCell label="ETA" value={batch.eta_date || '—'} mono
                   color={batch.status === 'in_transit' ? 'var(--gold)' : undefined} />
          <KpiCell label="Прибытие" value={batch.arrival_date || '—'} mono
                   color={batch.status === 'arrived' || batch.status === 'completed' ? 'var(--green)' : undefined} />
          <KpiCell label="Курс USD→KZT" value={batch.exchange_rate.toFixed(2)} mono accent />
        </div>

        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <KpiCell label="FOB всего" value={`$${fmtUsd(batch.total_fob_usd)}`} accent mono />
          <KpiCell label="Себест USD" value={`$${fmtUsd(batch.total_cost_usd)}`} accent mono />
          <KpiCell label="Себест KZT" value={`₸${fmtKzt(batch.total_cost_kzt)}`} color="var(--gold)" mono />
          <KpiCell
            label="Склад назначения"
            value={batch.destination_warehouse_name || '—'}
            color={batch.stock_in_created ? 'var(--green)' : undefined}
          />
        </div>

        {batch.stock_in_created && (
          <div style={{
            marginTop: 12, padding: '10px 14px', background: 'rgba(52,211,153,.08)',
            border: '1px solid var(--green)', borderRadius: 6,
            fontSize: 12, color: 'var(--green)',
          }}>
            ✓ Auto stock-in выполнен — товар зачислен на склад {batch.destination_warehouse_name}.
            См. вкладку «Движение» в Module 02.
          </div>
        )}

        {info && (
          <div style={{
            marginTop: 12, padding: '10px 14px', background: 'rgba(52,211,153,.10)',
            border: '1px solid var(--green)', borderRadius: 6,
            fontSize: 12.5, color: 'var(--green)',
          }}>{info}</div>
        )}
        {error && (
          <div style={{
            marginTop: 12, background: 'rgba(248,113,113,.10)', border: '1px solid var(--red)',
            borderRadius: 6, padding: '10px 14px', color: 'var(--red)', fontSize: 12.5,
          }}>{error}</div>
        )}

        {/* Status transitions */}
        {NEXT_STATUSES[batch.status].length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {NEXT_STATUSES[batch.status].map(next => (
              <button
                key={next}
                onClick={() => {
                  if (next === 'arrived') {
                    setArrivalDate(today());
                    setShowStatusForm('arrived');
                  } else {
                    changeStatus(next);
                  }
                }}
                disabled={submitting}
                className="btn btn-gold"
                style={{
                  background: next === 'cancelled' ? 'transparent' : undefined,
                  color: next === 'cancelled' ? 'var(--red)' : undefined,
                  border: next === 'cancelled' ? '1px solid var(--red)' : undefined,
                }}
              >
                {next === 'arrived' ? '📦 Прибыл (auto stock-in)' :
                 next === 'completed' ? '✓ Завершить' :
                 next === 'in_transit' ? '🚚 В путь' :
                 next === 'cancelled' ? '✕ Отменить' : STATUS_LABEL[next]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Arrived form */}
      {showStatusForm === 'arrived' && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--green)',
          borderRadius: 10, padding: 18,
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--green)',
            textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14,
          }}>
            Регистрация прибытия + auto stock-in
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Field label="Дата прибытия" required>
              <input type="date" value={arrivalDate} onChange={e => setArrivalDate(e.target.value)} />
            </Field>
            <Field label="Склад назначения" required>
              <select value={destWarehouse}
                onChange={e => setDestWarehouse(e.target.value === '' ? '' : parseInt(e.target.value))}>
                <option value="">— выбрать —</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>[{w.code}] {w.name}</option>)}
              </select>
            </Field>
          </div>
          <div style={{
            marginTop: 12, padding: '10px 14px', background: 'rgba(52,211,153,.06)',
            border: '1px solid var(--border)', borderRadius: 6,
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ts)', lineHeight: 1.6,
          }}>
            При подтверждении на склад поступит {batch.items.length} позиций
            (всего {batch.items.reduce((acc, i) => acc + i.quantity, 0)} ед.).
            Stock movements типа «Приход» будут автоматически созданы — увидеть их можно в Module 02 → Движение.
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button className="btn btn-gold" onClick={() => changeStatus('arrived')} disabled={submitting}>
              {submitting ? 'Обработка…' : '✓ Зарегистрировать прибытие'}
            </button>
            <button className="btn btn-outline" onClick={() => setShowStatusForm(null)}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Tracking edit */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 16px', background: 'var(--bg-el)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)',
            textTransform: 'uppercase', letterSpacing: '0.15em',
          }}>Отслеживание груза</span>
          <button onClick={() => setEditingTracking(e => !e)} style={{
            background: 'transparent', color: 'var(--gold)',
            border: '1px solid var(--gold)', borderRadius: 5,
            padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {editingTracking ? '✕ Отмена' : 'Редактировать'}
          </button>
        </div>
        {editingTracking ? (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <Field label="Tracking номер">
                <input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)}
                  placeholder="CH123456 или waybill" />
              </Field>
              <Field label="ETA">
                <input type="date" value={etaDate} onChange={e => setEtaDate(e.target.value)} />
              </Field>
              <Field label="Склад назначения">
                <select value={destWarehouse}
                  onChange={e => setDestWarehouse(e.target.value === '' ? '' : parseInt(e.target.value))}>
                  <option value="">— не указан —</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>[{w.code}] {w.name}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-gold" onClick={saveTracking} disabled={submitting}>
                {submitting ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            <Info label="Tracking" value={batch.tracking_number || '—'} mono />
            <Info label="ETA" value={batch.eta_date || '—'} mono />
            <Info label="Склад назначения" value={batch.destination_warehouse_name || '—'} />
          </div>
        )}
      </div>

      {/* Cost breakdown */}
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
          Структура себестоимости (USD)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, padding: 4 }}>
          <CostBox label="FOB" value={breakdown.fob} total={batch.total_cost_usd} color="var(--green)" />
          <CostBox label="Пошлина" value={breakdown.customs} total={batch.total_cost_usd} color="var(--gold)" />
          <CostBox label="НДС импорт" value={breakdown.vat} total={batch.total_cost_usd} color="var(--yellow)" />
          <CostBox label="Доставка/проч." value={breakdown.other} total={batch.total_cost_usd} color="var(--tm)" />
        </div>
      </div>

      {/* Items */}
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
          Позиции партии · {batch.items.length}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 2.4fr 70px 90px 90px 100px 100px 110px',
          gap: 8, padding: '10px 16px',
          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          borderBottom: '1px solid var(--border)',
        }}>
          <span>#</span>
          <span>Товар</span>
          <span style={{ textAlign: 'right' }}>Кол-во</span>
          <span style={{ textAlign: 'right' }}>$/шт</span>
          <span style={{ textAlign: 'right' }}>FOB $</span>
          <span style={{ textAlign: 'right' }}>Пошл $</span>
          <span style={{ textAlign: 'right' }}>НДС $</span>
          <span style={{ textAlign: 'right' }}>₸/шт</span>
        </div>
        {batch.items.map((it, idx) => (
          <div key={it.id} style={{
            display: 'grid',
            gridTemplateColumns: '40px 2.4fr 70px 90px 90px 100px 100px 110px',
            gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--tm)' }}>{idx + 1}</span>
            <span style={{ color: 'var(--tp)' }}>{it.product_name}</span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>{it.quantity}</span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>
              {it.price_per_unit_usd.toFixed(2)}
            </span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ts)' }}>
              {fmtUsd(it.fob_usd)}
            </span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tm)' }}>
              {fmtUsd(it.customs_duty_usd)}
            </span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--tm)' }}>
              {fmtUsd(it.vat_import_usd)}
            </span>
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--gold)', fontWeight: 600 }}>
              {fmtKzt(it.unit_cost_kzt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiCell({ label, value, mono, accent, color }: {
  label: string; value: string; mono?: boolean; accent?: boolean; color?: string;
}) {
  return (
    <div style={{
      background: 'var(--bg-el)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px',
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontFamily: mono ? 'var(--mono)' : 'inherit',
        fontSize: 16, fontWeight: 600,
        color: color || (accent ? 'var(--gold)' : 'var(--tp)'),
      }}>{value}</div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4,
      }}>{label}</div>
      <div style={{ fontFamily: mono ? 'var(--mono)' : 'inherit', fontSize: 14, color: 'var(--tp)', fontWeight: 500 }}>
        {value}
      </div>
    </div>
  );
}

function CostBox({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round(value / total * 100) : 0;
  return (
    <div style={{ padding: 14 }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
      }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, marginBottom: 6 }}>${fmtUsd(value)}</div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color }} />
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)', marginTop: 4 }}>{pct}%</div>
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
