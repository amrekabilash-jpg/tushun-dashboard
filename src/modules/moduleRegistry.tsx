import { ReactElement } from 'react';
import { ModuleId } from '../types';
import Module1 from './module1/Module1';
import PlaceholderModule from './PlaceholderModule';

const MODULES: Record<ModuleId, () => ReactElement> = {
  1: Module1,
  2: () => (
    <PlaceholderModule
      moduleId={2}
      eyebrow="Модуль 02"
      title="ТОВАРНЫЙ УЧЁТ"
      description="Справочник 1000+ товаров (фильтры/патрубки), остатки на складах Алматы и Астана, движение товара (приход/отпуск), история операций, прогноз закупок."
      tabs={[
        { id: 'm2-overview', label: 'Обзор' },
        { id: 'm2-catalog', label: 'Справочник товаров' },
        { id: 'm2-stock', label: 'Остатки' },
        { id: 'm2-movement', label: 'Движение' },
        { id: 'm2-forecast', label: 'Прогноз' },
      ]}
    />
  ),
  3: () => (
    <PlaceholderModule
      moduleId={3}
      eyebrow="Модуль 03"
      title="ПРОДАЖИ И КЛИЕНТЫ"
      description="Счета-фактуры, база клиентов с реквизитами и скидками, дебиторская задолженность с aging-анализом, история сделок."
      tabs={[
        { id: 'm3-overview', label: 'Обзор' },
        { id: 'm3-invoices', label: 'Счета-фактуры' },
        { id: 'm3-clients', label: 'Клиенты' },
        { id: 'm3-debts', label: 'Дебиторка' },
      ]}
    />
  ),
  4: () => (
    <PlaceholderModule
      moduleId={4}
      eyebrow="Модуль 04"
      title="ПОСТАВКИ"
      description="Расширение текущей формы импорта: инвойсы Tushun (USD→KZT), детальная себестоимость с таможней и фрахтом, отслеживание грузов от FOB до прихода на склад."
      tabs={[
        { id: 'm4-overview', label: 'Обзор' },
        { id: 'm4-invoices', label: 'Инвойсы' },
        { id: 'm4-cost', label: 'Себестоимость' },
        { id: 'm4-tracking', label: 'Отслеживание' },
      ]}
    />
  ),
  5: () => (
    <PlaceholderModule
      moduleId={5}
      eyebrow="Модуль 05"
      title="АНАЛИЗ КОНКУРЕНТОВ"
      description="Мониторинг цен конкурентов на рынке, ценовая позиция Tushun, рекомендации по ценообразованию."
      tabs={[
        { id: 'm5-overview', label: 'Обзор' },
        { id: 'm5-prices', label: 'Мониторинг цен' },
        { id: 'm5-pricing', label: 'Ценообразование' },
        { id: 'm5-market', label: 'Позиция на рынке' },
      ]}
    />
  ),
  6: () => (
    <PlaceholderModule
      moduleId={6}
      eyebrow="Модуль 06"
      title="ГАРАНТИЙНЫЙ УЧЁТ"
      description="Регистрация рекламаций, обработка возвратов, статистика по причинам возвратов, процент возврата по товарам."
      tabs={[
        { id: 'm6-overview', label: 'Обзор' },
        { id: 'm6-claims', label: 'Рекламации' },
        { id: 'm6-returns', label: 'Возвраты' },
        { id: 'm6-stats', label: 'Статистика' },
      ]}
    />
  ),
  7: () => (
    <PlaceholderModule
      moduleId={7}
      eyebrow="Модуль 07"
      title="РАСХОДЫ"
      description="Операционные расходы (зарплаты, аренда, коммуналка), закупки и логистика (таможня, фрахт), маркетинг и прочее."
      tabs={[
        { id: 'm7-overview', label: 'Сводка' },
        { id: 'm7-opex', label: 'Операционные' },
        { id: 'm7-cogs', label: 'Закупки / Логистика' },
        { id: 'm7-other', label: 'Маркетинг и прочее' },
      ]}
    />
  ),
  8: () => (
    <PlaceholderModule
      moduleId={8}
      eyebrow="Модуль 08"
      title="TELEGRAM BOT"
      description="Загрузка документов через Telegram, OCR-распознавание (Tesseract), автоматическое заполнение модулей 1–7. Phase 5 в плане разработки."
      tabs={[
        { id: 'm8-overview', label: 'Обзор' },
        { id: 'm8-documents', label: 'Документы' },
        { id: 'm8-ocr', label: 'OCR Аналитика' },
        { id: 'm8-settings', label: 'Настройки' },
      ]}
    />
  ),
};

export function getModuleComponent(id: ModuleId) {
  return MODULES[id];
}
