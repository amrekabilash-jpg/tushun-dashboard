import { useEffect, useMemo, useState } from 'react';
import {
  api, BroadcastResult, TelegramLinkInfo, TelegramRole, TelegramStatus,
  TelegramSubscription, TelegramUser,
} from '../../../utils/api';

const ROLE_LABEL: Record<TelegramRole, string> = {
  admin: 'Админ', manager: 'Менеджер', viewer: 'Наблюдатель',
};

const ROLE_COLOR: Record<TelegramRole, string> = {
  admin:   'var(--red)',
  manager: 'var(--gold)',
  viewer:  'var(--ts)',
};

const SUB_LABEL: Record<TelegramSubscription, string> = {
  alerts:   '🚨 Алерты',
  sales:    '💰 Продажи',
  expenses: '💸 Расходы',
  daily:    '📅 Ежедневно',
};

const ALL_SUBS: TelegramSubscription[] = ['alerts', 'sales', 'expenses', 'daily'];

const COMMANDS = [
  { cmd: '/start',    desc: 'Подключение к боту + текущий статус подписок' },
  { cmd: '/status',   desc: 'KPI выручки, расходов и маржи за 7 дней' },
  { cmd: '/sales',    desc: 'Последние продажи (по дням)' },
  { cmd: '/expenses', desc: 'Расходы текущего месяца по категориям' },
  { cmd: '/alerts',   desc: 'Критичные превышения бюджета и просроченные рекламации' },
  { cmd: '/forecast', desc: 'Прогноз расходов до конца месяца' },
  { cmd: '/help',     desc: 'Справка по командам' },
];

export default function TelegramTab() {
  const [link, setLink] = useState<TelegramLinkInfo | null>(null);
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Broadcast form
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastRole, setBroadcastRole] = useState<TelegramRole | ''>('');
  const [broadcastSub, setBroadcastSub] = useState<TelegramSubscription | ''>('');
  const [broadcastResult, setBroadcastResult] = useState<BroadcastResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Simulate command
  const [simUserId, setSimUserId] = useState('');
  const [simCommand, setSimCommand] = useState('/status');
  const [simResult, setSimResult] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [l, s] = await Promise.all([
        api.getTelegramLink(),
        api.getTelegramStatus(),
      ]);
      setLink(l);
      setStatus(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const updateUser = async (user: TelegramUser, patch: Partial<{
    role: TelegramRole; subscriptions: TelegramSubscription[]; is_active: boolean;
  }>) => {
    try {
      await api.subscribeTelegram({ tg_user_id: user.tg_user_id, ...patch });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const removeUser = async (id: number) => {
    if (!confirm('Удалить подписчика?')) return;
    try {
      await api.deleteTelegramUser(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastText.trim()) {
      setError('Текст сообщения обязателен');
      return;
    }
    setSubmitting(true);
    setError(null);
    setBroadcastResult(null);
    try {
      const res = await api.broadcastTelegram({
        text: broadcastText.trim(),
        filter_role: broadcastRole || undefined,
        filter_subscription: broadcastSub || undefined,
      });
      setBroadcastResult(res);
      setBroadcastText('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  const simulateCommand = async () => {
    const id = parseInt(simUserId);
    if (!id) {
      setError('Укажи tg_user_id');
      return;
    }
    setSimResult(null);
    try {
      const res = await api.simulateTelegramCommand({
        tg_user_id: id,
        username: 'test_simulator',
        first_name: 'Test',
        text: simCommand,
      });
      setSimResult(res.response_text);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const totalSubs = useMemo(() => {
    if (!status) return 0;
    return Object.values(status.by_subscription).reduce((a, b) => a + b, 0);
  }, [status]);

  if (loading) return <div style={{ padding: 24, color: 'var(--ts)' }}>Загрузка…</div>;
  // Без данных показываем причину: иначе на месте модуля оставался пустой экран
  if (!link || !status) return (
    <div style={{
      background: 'rgba(248,113,113,.10)', border: '1px solid var(--red)',
      borderRadius: 6, padding: '10px 14px', color: 'var(--red)', fontSize: 12.5,
    }}>⚠ {error ?? 'Сервер не вернул данные бота'}</div>
  );

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Banner: bot status */}
      <div style={{
        background: link.has_token ? 'rgba(52,211,153,.06)' : 'rgba(251,191,36,.06)',
        border: `1px solid ${link.has_token ? 'var(--green)' : 'var(--yellow)'}`,
        borderRadius: 10, padding: '14px 18px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11,
            color: link.has_token ? 'var(--green)' : 'var(--yellow)',
            textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700,
            marginBottom: 4,
          }}>
            {link.has_token ? '✓ Бот подключён' : '⚠ Demo-режим (без TELEGRAM_BOT_TOKEN)'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--tp)' }}>
            Бот: <span style={{ fontFamily: 'var(--mono)', color: 'var(--gold)' }}>@{link.bot_username}</span>
            {!link.has_token && (
              <span style={{ marginLeft: 12, fontSize: 11.5, color: 'var(--tm)' }}>
                · Сообщения логируются, но не отправляются в Telegram
              </span>
            )}
          </div>
        </div>
      </div>

      {/* QR + Connection card */}
      <div style={{
        display: 'grid', gridTemplateColumns: '280px 1fr', gap: 18,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 18,
      }}>
        {/* QR */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: '#fff', padding: 12, borderRadius: 8,
            border: '1px solid var(--border)',
          }}>
            <img src={link.qr_url} alt="QR код" width={240} height={240}
              style={{ display: 'block' }} />
          </div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            Сканируй камерой телефона
          </div>
        </div>

        {/* Instructions */}
        <div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gold)',
            textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14,
            fontWeight: 700,
          }}>
            🚀 Подключение к боту
          </div>
          <div style={{ display: 'grid', gap: 10, fontSize: 13, color: 'var(--tp)', lineHeight: 1.6 }}>
            <Step n={1}>
              Открой Telegram на телефоне и наведи камеру на QR-код слева<br />
              <span style={{ fontSize: 11.5, color: 'var(--tm)' }}>
                (или просто кликни по ссылке ниже на устройстве с Telegram)
              </span>
            </Step>
            <Step n={2}>
              В открывшемся чате с ботом нажми кнопку <strong>«Start»</strong> или отправь команду <code style={cd}>/start</code>
            </Step>
            <Step n={3}>
              Получи приветствие и роль <strong>viewer</strong>. Подписки: <code style={cd}>alerts</code>
            </Step>
            <Step n={4}>
              Управляй подписками и ролями отсюда (таблица ниже) или через команды бота
            </Step>
          </div>

          <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-el)',
                        border: '1px solid var(--border)', borderRadius: 6 }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
            }}>Прямая ссылка</div>
            <a href={link.deep_link} target="_blank" rel="noreferrer" style={{
              fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--gold)',
              wordBreak: 'break-all', textDecoration: 'none',
            }}>{link.deep_link} ↗</a>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <Kpi label="Подписчиков всего" value={String(status.users_count)} hint={`${status.active_users_count} активных`} />
        <Kpi label="Админов" value={String(status.by_role.admin)} color="var(--red)" />
        <Kpi label="Менеджеров" value={String(status.by_role.manager)} color="var(--gold)" />
        <Kpi label="Подписок (всего)" value={String(totalSubs)} hint="alerts/sales/expenses/daily" />
      </div>

      {error && (
        <div style={{
          background: 'rgba(248,113,113,.10)', border: '1px solid var(--red)',
          borderRadius: 6, padding: '10px 14px', color: 'var(--red)', fontSize: 12.5,
        }}>{error}</div>
      )}

      {/* Users table */}
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
          Подписчики · {status.users.length}
        </div>
        {status.users.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--tm)', fontSize: 13 }}>
            Подписчиков пока нет. Сканируй QR-код выше для подключения.
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1.6fr 130px 1.4fr 130px 110px 60px',
              gap: 8, padding: '10px 16px', fontSize: 10, color: 'var(--tm)',
              fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.1em',
              borderBottom: '1px solid var(--border)',
            }}>
              <span>Username</span>
              <span>Имя</span>
              <span>Роль</span>
              <span>Подписки</span>
              <span>Послед. команда</span>
              <span>Активен</span>
              <span></span>
            </div>
            {status.users.map(u => (
              <div key={u.id} style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr 1.6fr 130px 1.4fr 130px 110px 60px',
                gap: 8, padding: '11px 16px', alignItems: 'center', fontSize: 12.5,
                borderBottom: '1px solid var(--border)',
                opacity: u.is_active ? 1 : 0.55,
              }}>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--gold)', fontWeight: 600 }}>
                  @{u.username || `id${u.tg_user_id}`}
                </span>
                <span style={{ color: 'var(--tp)' }}>{u.full_name || '—'}</span>
                <select value={u.role}
                  onChange={e => updateUser(u, { role: e.target.value as TelegramRole })}
                  style={{
                    background: 'var(--bg-el)', border: '1px solid ' + ROLE_COLOR[u.role],
                    borderRadius: 4, padding: '3px 8px',
                    color: ROLE_COLOR[u.role], fontSize: 11, fontWeight: 600,
                    fontFamily: 'inherit',
                  }}>
                  <option value="admin">{ROLE_LABEL.admin}</option>
                  <option value="manager">{ROLE_LABEL.manager}</option>
                  <option value="viewer">{ROLE_LABEL.viewer}</option>
                </select>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {ALL_SUBS.map(sub => {
                    const has = u.subscriptions.includes(sub);
                    return (
                      <button key={sub}
                        onClick={() => {
                          const newSubs = has
                            ? u.subscriptions.filter(s => s !== sub)
                            : [...u.subscriptions, sub];
                          updateUser(u, { subscriptions: newSubs });
                        }}
                        style={{
                          background: has ? 'var(--gold)' : 'transparent',
                          color: has ? 'var(--bg-deep)' : 'var(--tm)',
                          border: '1px solid ' + (has ? 'var(--gold)' : 'var(--border)'),
                          borderRadius: 4, padding: '2px 6px', fontSize: 10,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                        title={SUB_LABEL[sub]}
                      >
                        {SUB_LABEL[sub].split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ts)' }}>
                  {u.last_command || '—'}
                </span>
                <button
                  onClick={() => updateUser(u, { is_active: !u.is_active })}
                  style={{
                    fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
                    padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                    background: 'transparent',
                    color: u.is_active ? 'var(--green)' : 'var(--tm)',
                    border: '1px solid ' + (u.is_active ? 'var(--green)' : 'var(--tm)'),
                  }}>{u.is_active ? '✓ ON' : '✕ OFF'}</button>
                <button onClick={() => removeUser(u.id)} style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--red)', cursor: 'pointer', borderRadius: 4,
                  padding: '3px 8px', fontSize: 13, fontFamily: 'inherit',
                }}>×</button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Two-column: Broadcast + Simulate */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 18 }}>
        {/* Broadcast */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 18,
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gold)',
            textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14,
            fontWeight: 700,
          }}>📢 Broadcast — отправить всем подписчикам</div>

          <textarea
            value={broadcastText}
            onChange={e => setBroadcastText(e.target.value)}
            placeholder="Текст сообщения (поддерживается Markdown: *bold*, `code`, [link](url))"
            style={{
              width: '100%', minHeight: 100,
              background: 'var(--bg-el)', border: '1px solid var(--border)',
              borderRadius: 6, padding: 10, color: 'var(--tp)',
              fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <Field label="Фильтр по роли">
              <select value={broadcastRole}
                onChange={e => setBroadcastRole(e.target.value as TelegramRole | '')}>
                <option value="">— все роли —</option>
                <option value="admin">Админы</option>
                <option value="manager">Менеджеры</option>
                <option value="viewer">Наблюдатели</option>
              </select>
            </Field>
            <Field label="Фильтр по подписке">
              <select value={broadcastSub}
                onChange={e => setBroadcastSub(e.target.value as TelegramSubscription | '')}>
                <option value="">— все подписки —</option>
                {ALL_SUBS.map(s => <option key={s} value={s}>{SUB_LABEL[s]}</option>)}
              </select>
            </Field>
          </div>

          <button onClick={sendBroadcast} disabled={submitting || !broadcastText.trim()}
            className="btn btn-gold" style={{ marginTop: 12, width: '100%' }}>
            {submitting ? 'Отправка…' : '🚀 Отправить'}
          </button>

          {broadcastResult && (
            <div style={{
              marginTop: 12, padding: 12,
              background: 'rgba(52,211,153,.05)',
              border: '1px solid var(--green)', borderRadius: 6,
              fontSize: 12.5,
            }}>
              <div style={{ color: 'var(--green)', fontWeight: 700, marginBottom: 6 }}>
                ✓ Отправлено: {broadcastResult.targets_count} получателей
              </div>
              <div style={{ color: 'var(--ts)', fontSize: 11.5 }}>
                Реально доставлено: {broadcastResult.sent_real} ·
                Dry-run (без токена): {broadcastResult.dry_run}
              </div>
              {broadcastResult.note && (
                <div style={{ color: 'var(--yellow)', fontSize: 11.5, marginTop: 6 }}>
                  ⚠ {broadcastResult.note}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Simulate command */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 18,
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gold)',
            textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14,
            fontWeight: 700,
          }}>🧪 Симуляция команды (без реального Telegram)</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 10, marginBottom: 10 }}>
            <Field label="TG User ID">
              <input value={simUserId}
                onChange={e => setSimUserId(e.target.value)}
                placeholder="например 123456789" />
            </Field>
            <Field label="Команда">
              <select value={simCommand} onChange={e => setSimCommand(e.target.value)}>
                {COMMANDS.map(c => (
                  <option key={c.cmd} value={c.cmd}>{c.cmd} — {c.desc.slice(0, 40)}</option>
                ))}
              </select>
            </Field>
          </div>

          <button onClick={simulateCommand} className="btn btn-outline" style={{ width: '100%' }}>
            ▶ Выполнить
          </button>

          {simResult && (
            <div style={{
              marginTop: 12, padding: 12,
              background: 'var(--bg-el)', border: '1px solid var(--border)', borderRadius: 6,
              fontFamily: 'var(--mono)', fontSize: 11.5,
              whiteSpace: 'pre-wrap', color: 'var(--tp)', lineHeight: 1.6,
            }}>{simResult}</div>
          )}
        </div>
      </div>

      {/* Available commands */}
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
          📖 Команды бота
        </div>
        {COMMANDS.map(c => (
          <div key={c.cmd} style={{
            display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12,
            padding: '10px 16px', borderBottom: '1px solid var(--border)',
            alignItems: 'center', fontSize: 12.5,
          }}>
            <code style={{
              fontFamily: 'var(--mono)', color: 'var(--gold)', fontWeight: 600,
              padding: '2px 8px', background: 'var(--bg-el)', borderRadius: 4,
              border: '1px solid var(--border)', textAlign: 'center',
            }}>{c.cmd}</code>
            <span style={{ color: 'var(--ts)' }}>{c.desc}</span>
          </div>
        ))}
      </div>

      {/* Recent notifications log */}
      {status.recent_notifications.length > 0 && (
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
            🔔 Последние уведомления · {status.recent_notifications.length}
          </div>
          {status.recent_notifications.map((n, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '160px 100px 70px 1fr',
              gap: 8, padding: '10px 16px',
              borderBottom: '1px solid var(--border)',
              fontSize: 11.5, alignItems: 'center',
            }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)' }}>
                {n.sent_at?.slice(0, 19).replace('T', ' ')}
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--gold)' }}>
                chat: {n.chat_id}
              </span>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                padding: '2px 6px', borderRadius: 3, textAlign: 'center',
                color: n.real ? 'var(--green)' : 'var(--yellow)',
                border: '1px solid ' + (n.real ? 'var(--green)' : 'var(--yellow)'),
              }}>{n.real ? 'SENT' : 'DRY'}</span>
              <span style={{ color: 'var(--ts)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {n.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const cd: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--gold)',
  background: 'var(--bg-el)', padding: '1px 6px', borderRadius: 3,
  border: '1px solid var(--border)',
};

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{
        flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
        background: 'var(--gold)', color: 'var(--bg-deep)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 13,
      }}>{n}</span>
      <div style={{ paddingTop: 4 }}>{children}</div>
    </div>
  );
}

function Kpi({ label, value, color, hint }: { label: string; value: string; color?: string; hint?: string }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '14px 16px',
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
      }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || 'var(--tp)', lineHeight: 1, marginBottom: 4 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 11, color: 'var(--ts)' }}>{hint}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tm)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
      }}>{label}</span>
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
