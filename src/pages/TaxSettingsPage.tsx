import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, Product, TaxHistoryRow, TaxUpdatePayload } from '../utils/api';
import { useAuthStore } from '../store/auth';

type EditableField = 'customs_duty_percent' | 'vat_import_percent' | 'vat_sale_percent' | 'kpn_percent';

const FIELDS: { key: EditableField; label: string; hint: string }[] = [
  { key: 'customs_duty_percent', label: 'Пошлина', hint: '12% по умолчанию' },
  { key: 'vat_import_percent',   label: 'НДС импорт', hint: '12%' },
  { key: 'vat_sale_percent',     label: 'НДС продажа', hint: '16%' },
  { key: 'kpn_percent',          label: 'КПН', hint: '10%' },
];

interface Props {
  onOpenImport?: () => void;
  onOpenReports?: () => void;
}

export default function TaxSettingsPage({ onOpenImport, onOpenReports }: Props) {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);

  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<EditableField, string>>({
    customs_duty_percent: '', vat_import_percent: '', vat_sale_percent: '', kpn_percent: '',
  });
  const [reason, setReason] = useState('');
  const [historyFor, setHistoryFor] = useState<Product | null>(null);
  const [history, setHistory] = useState<TaxHistoryRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [healthOk, setHealthOk] = useState<boolean | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const data = await api.listTaxSettings();
      setProducts(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить товары');
    }
  }, []);

  useEffect(() => {
    api.health().then(() => setHealthOk(true)).catch(() => setHealthOk(false));
    reload();
  }, [reload]);

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setDraft({
      customs_duty_percent: (p.customs_duty_percent * 100).toString(),
      vat_import_percent:   (p.vat_import_percent   * 100).toString(),
      vat_sale_percent:     (p.vat_sale_percent     * 100).toString(),
      kpn_percent:          (p.kpn_percent          * 100).toString(),
    });
    setReason('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setReason('');
  };

  const save = async (p: Product) => {
    setSaving(true);
    try {
      const payload: TaxUpdatePayload = {
        changed_by: user?.email ?? 'unknown',
        reason: reason || undefined,
      };
      for (const f of FIELDS) {
        const raw = draft[f.key].trim();
        if (raw === '') continue;
        const pct = parseFloat(raw);
        if (Number.isNaN(pct)) continue;
        payload[f.key] = +(pct / 100).toFixed(6);
      }
      const res = await api.updateTaxSettings(p.id, payload);
      setProducts(curr => curr?.map(x => (x.id === p.id ? res.product : x)) ?? null);
      setEditingId(null);
      setReason('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (p: Product) => {
    setHistoryFor(p);
    setHistory(null);
    try {
      const rows = await api.getTaxHistory(p.id);
      setHistory(rows);
    } catch (err) {
      setHistory([]);
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить историю');
    }
  };

  const closeHistory = () => { setHistoryFor(null); setHistory(null); };

  const totalEditableProducts = useMemo(() => products?.length ?? 0, [products]);

  return (
    <div className="tax-page">
      <header className="tax-header">
        <div>
          <div className="tax-eyebrow">МОДУЛЬ · НАЛОГОВЫЕ СТАВКИ</div>
          <h1 className="tax-title">Таможенные пошлины и налоги</h1>
          <p className="tax-sub">
            Изменение ставки пересчитывает себестоимость во всех новых партиях. История фиксируется автоматически.
          </p>
        </div>
        <div className="tax-header-right">
          <span className={`tax-health ${healthOk === false ? 'tax-health--err' : healthOk ? 'tax-health--ok' : ''}`}>
            {healthOk === null ? '…' : healthOk ? 'API · 127.0.0.1:5000 · OK' : 'API недоступен'}
          </span>
          {onOpenReports && (
            <button className="tax-btn tax-btn--ghost" onClick={onOpenReports}>📊 Отчёты</button>
          )}
          {onOpenImport && (
            <button className="tax-btn tax-btn--gold" onClick={onOpenImport}>📦 Импорт партии</button>
          )}
          <span className="tax-user">{user?.name} · {user?.role}</span>
          <button className="tax-btn tax-btn--ghost" onClick={() => { logout(); }}>Выйти</button>
        </div>
      </header>

      {error && <div className="tax-banner tax-banner--err">⚠ {error}</div>}
      {healthOk === false && (
        <div className="tax-banner tax-banner--err">
          Запустите backend: <code>cd backend && source venv/bin/activate && python run.py</code>
        </div>
      )}

      <div className="tax-card">
        <div className="tax-card-head">
          <span className="tax-card-title">Товары — {totalEditableProducts}</span>
          <button className="tax-btn tax-btn--ghost" onClick={reload}>↻ Обновить</button>
        </div>

        <div className="tax-table-wrap">
          <div className="table-scroll"><table className="tax-table">
            <thead>
              <tr>
                <th>Товар</th>
                <th>ТН ВЭД</th>
                <th>Категория</th>
                {FIELDS.map(f => <th key={f.key} className="td-right">{f.label}</th>)}
                <th className="td-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {!products && (
                <tr><td colSpan={8} className="tax-empty">Загрузка…</td></tr>
              )}
              {products && products.length === 0 && (
                <tr><td colSpan={8} className="tax-empty">Нет товаров</td></tr>
              )}
              {products?.map(p => {
                const editing = editingId === p.id;
                return (
                  <tr key={p.id} className={editing ? 'is-editing' : ''}>
                    <td className="tax-td-name">{p.name}</td>
                    <td className="tax-mono">{p.tn_ved_code ?? '—'}</td>
                    <td className="tax-mono tax-muted">{p.category}</td>
                    {FIELDS.map(f => (
                      <td key={f.key} className="td-right">
                        {editing ? (
                          <input
                            className="tax-input"
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={draft[f.key]}
                            onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                          />
                        ) : (
                          <span className="tax-pct">{(p[f.key] * 100).toFixed(1)}%</span>
                        )}
                      </td>
                    ))}
                    <td className="td-right">
                      {editing ? (
                        <div className="tax-actions">
                          <input
                            className="tax-input tax-input--reason"
                            placeholder="причина (опционально)"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                          />
                          <button className="tax-btn tax-btn--gold" disabled={saving} onClick={() => save(p)}>
                            {saving ? '…' : 'Сохранить'}
                          </button>
                          <button className="tax-btn tax-btn--ghost" disabled={saving} onClick={cancelEdit}>
                            Отмена
                          </button>
                        </div>
                      ) : (
                        <div className="tax-actions">
                          <button className="tax-btn tax-btn--ghost" onClick={() => openHistory(p)}>История</button>
                          <button className="tax-btn tax-btn--gold" onClick={() => startEdit(p)}>Изменить</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      </div>

      {historyFor && (
        <div className="tax-modal" onClick={closeHistory}>
          <div className="tax-modal-box" onClick={e => e.stopPropagation()}>
            <header className="tax-modal-head">
              <div>
                <div className="tax-eyebrow">ИСТОРИЯ</div>
                <h2 className="tax-modal-title">{historyFor.name}</h2>
              </div>
              <button className="tax-btn tax-btn--ghost" onClick={closeHistory}>Закрыть</button>
            </header>
            <div className="tax-table-wrap">
              <div className="table-scroll"><table className="tax-table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Поле</th>
                    <th className="td-right">Было</th>
                    <th className="td-right">Стало</th>
                    <th>Кто</th>
                    <th>Причина</th>
                  </tr>
                </thead>
                <tbody>
                  {!history && <tr><td colSpan={6} className="tax-empty">Загрузка…</td></tr>}
                  {history && history.length === 0 && <tr><td colSpan={6} className="tax-empty">История пуста</td></tr>}
                  {history?.map(r => (
                    <tr key={r.id}>
                      <td className="tax-mono tax-muted">{new Date(r.changed_at).toLocaleString('ru-RU')}</td>
                      <td className="tax-mono">{r.field}</td>
                      <td className="td-right tax-mono">{r.old !== null ? `${(r.old * 100).toFixed(1)}%` : '—'}</td>
                      <td className="td-right tax-mono"><strong>{(r.new * 100).toFixed(1)}%</strong></td>
                      <td className="tax-mono tax-muted">{r.changed_by ?? '—'}</td>
                      <td>{r.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
