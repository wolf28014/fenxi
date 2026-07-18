import { describe, expect, it } from 'vitest';
import { calculateMetrics, formatLocalDate, getQuickRange } from './calc';

describe('date ranges', () => {
  it('formats local calendar dates without UTC rollover', () => {
    expect(formatLocalDate(new Date(2026, 6, 18, 0, 30))).toBe('2026-07-18');
  });

  it('returns an inclusive 31-calendar-day last30Days window', () => {
    const range = getQuickRange('last30Days');
    const start = new Date(`${range.start}T00:00:00`);
    const end = new Date(`${range.end}T00:00:00`);
    expect(Math.round((end.getTime() - start.getTime()) / 86400000)).toBe(30);
  });
});

describe('metrics', () => {
  it('uses promotion details when no daily metrics exist', () => {
    const result = calculateMetrics([], [{
      id: 'promo-1', userId: 'u', shopId: 's', productId: null, date: '2026-07-18',
      productSitePromo: 10, keywordPromo: 0, audiencePromo: 0, storeDirect: 0,
      contentMarketing: 0, taobaoKe: 0, otherPromo: 0, total: 10,
      isTotalOverridden: false, dataSource: 'manual', createdAt: '', updatedAt: '',
    }], []);
    expect(result.promoTotal).toBe(10);
  });
});
