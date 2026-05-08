import TelegramTab from './tabs/TelegramTab';

export default function Module8() {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Модуль 08</div>
          <div className="page-title">TELEGRAM BOT</div>
        </div>
        <div className="header-actions">
          <span className="card-badge badge-green">PHASE 2 · LIVE</span>
        </div>
      </div>

      <div className="section active">
        <TelegramTab />
      </div>
    </>
  );
}
