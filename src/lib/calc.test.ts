import { describe, expect, it } from 'vitest';
import { calculateBreakEvenROI, calculateMetrics, calculateProratedOtherCosts, formatLocalDate, getQuickRange } from './calc';

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
  it('prorates monthly non-product costs across partial ranges', () => {
    const cost = { year: 2026, month: 1, labor: 310, productCost: 0 } as any;
    expect(calculateProratedOtherCosts([cost], '2026-01-01', '2026-01-10')).toBeCloseTo(100, 5);
  });

  it('keeps full monthly costs and handles cross-month ranges', () => {
    const costs = [
      { year: 2026, month: 1, labor: 310, productCost: 0 },
      { year: 2026, month: 2, labor: 280, productCost: 0 },
    ] as any;
    expect(calculateProratedOtherCosts(costs, '2026-01-01', '2026-01-31')).toBeCloseTo(310, 5);
    expect(calculateProratedOtherCosts(costs, '2026-01-27', '2026-02-05')).toBeCloseTo(100, 5);
  });

  it('uses leap-year calendar days when prorating', () => {
    const cost = { year: 2028, month: 2, labor: 290, productCost: 0 } as any;
    expect(calculateProratedOtherCosts([cost], '2028-02-01', '2028-02-10')).toBeCloseTo(100, 5);
  });

  it('calculates gross-sales break-even ROI from pre-refund margin and refund rate', () => {
    expect(calculateBreakEvenROI(35, 53.35)).toBeCloseTo(6.125, 2);
  });

  it('uses promotion details when no daily metrics exist', () => {
    const result = calculateMetrics([], [{
      id: 'promo-1', userId: 'u', shopId: 's', productId: null, date: '2026-07-18',
      productSitePromo: 10, keywordPromo: 0, audiencePromo: 0, storeDirect: 0,
      contentMarketing: 0, taobaoKe: 0, otherPromo: 0, total: 10,
      isTotalOverridden: false, dataSource: 'manual', createdAt: '', updatedAt: '',
    }], []);
    expect(result.promoTotal).toBe(10);
  });

  it('uses promotion details when metric rows exist but their promotion total is zero', () => {
    const metric = {
      id: 'm1', userId: 'u', shopId: 's', productId: null, date: '2026-07-18',
      salesAmount: 100, orderCount: 1, soldQuantity: 1, refundQuantity: 0,
      refundAmount: 0, promotionCost: 0, visitorCount: 10, dataSource: 'manual', createdAt: '', updatedAt: '',
    } as any;
    const promotion = {
      id: 'p1', userId: 'u', shopId: 's', productId: null, date: '2026-07-18',
      productSitePromo: 10, keywordPromo: 0, audiencePromo: 0, storeDirect: 0,
      contentMarketing: 0, taobaoKe: 0, otherPromo: 0, total: 10,
      isTotalOverridden: false, dataSource: 'manual', createdAt: '', updatedAt: '',
    } as any;
    expect(calculateMetrics([metric], [promotion], []).promoTotal).toBe(10);
  });
});
