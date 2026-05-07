interface Tab {
  id: string;
  label: string;
}

interface Props {
  moduleId: number;
  eyebrow: string;
  title: string;
  description: string;
  tabs: Tab[];
}

export default function PlaceholderModule({ moduleId, eyebrow, title, description, tabs }: Props) {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">{eyebrow}</div>
          <div className="page-title">{title}</div>
        </div>
        <div className="header-actions">
          <span className="card-badge badge-gold">PHASE 2 · IN PROGRESS</span>
        </div>
      </div>

      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
        padding: 28, marginTop: 4,
      }}>
        <div style={{ color: 'var(--ts)', fontSize: 14, lineHeight: 1.7, marginBottom: 22, maxWidth: 720 }}>
          {description}
        </div>

        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.2em',
          color: 'var(--tm)', textTransform: 'uppercase', marginBottom: 12,
        }}>
          Запланированные подэкраны (модуль {String(moduleId).padStart(2, '0')})
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {tabs.map(tab => (
            <div key={tab.id} style={{
              background: 'var(--bg-el)', border: '1px solid var(--border)', borderRadius: 8,
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--tm)', flexShrink: 0,
              }} />
              <div style={{ fontSize: 12.5, color: 'var(--tp)', fontWeight: 500 }}>{tab.label}</div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)',
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tm)', lineHeight: 1.6,
        }}>
          📌 Phase 1 готов: Налоговые ставки, Импорт партии, P&L отчёты — в боковом меню «Инструменты».<br />
          Этот модуль будет переведён на реальный backend в одной из следующих сессий.
        </div>
      </div>
    </>
  );
}
