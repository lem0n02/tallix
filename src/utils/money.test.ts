import { describe, it, expect } from 'vitest';
import {
  toPaisa,
  fromPaisa,
  parseExactMoney,
  formatExactMoney,
  splitExactAmount,
  sumExactAmounts,
  subtractExactAmounts,
} from './money';

describe('Money Precision Engine', () => {
  it('preserves exact user-entered integers without float drift', () => {
    const testCases = [44, 57, 99, 100, 120, 125, 130, 999, 1000];
    for (const val of testCases) {
      expect(parseExactMoney(val)).toBe(val);
      expect(toPaisa(val)).toBe(val * 100);
      expect(fromPaisa(toPaisa(val))).toBe(val);
    }
  });

  it('formats exact amounts without converting 120 to 119.98 or 130 to 129.98', () => {
    expect(formatExactMoney(120)).toBe('120.00');
    expect(formatExactMoney('120')).toBe('120.00');
    expect(formatExactMoney(130)).toBe('130.00');
    expect(formatExactMoney('130')).toBe('130.00');
    expect(formatExactMoney(44)).toBe('44.00');
    expect(formatExactMoney(57)).toBe('57.00');
    expect(formatExactMoney(99)).toBe('99.00');
    expect(formatExactMoney(100)).toBe('100.00');
    expect(formatExactMoney(125)).toBe('125.00');
    expect(formatExactMoney(999)).toBe('999.00');
    expect(formatExactMoney(1000)).toBe('1,000.00');
  });

  it('handles arbitrary decimal amounts with precision', () => {
    expect(formatExactMoney(12.34)).toBe('12.34');
    expect(formatExactMoney(100.5)).toBe('100.50');
    expect(formatExactMoney('100.50')).toBe('100.50');
    expect(formatExactMoney(1.14)).toBe('1.14');
    expect(formatExactMoney(1.15)).toBe('1.15');
  });

  it('splits amounts across members with zero loss of cents', () => {
    // 120 split among 3 members
    const splits120 = splitExactAmount(120, 3);
    expect(splits120).toEqual([40, 40, 40]);
    expect(sumExactAmounts(splits120)).toBe(120);

    // 120 split among 7 members
    const splits120_7 = splitExactAmount(120, 7);
    expect(sumExactAmounts(splits120_7)).toBe(120);

    // 130 split among 3 members
    const splits130 = splitExactAmount(130, 3);
    expect(splits130).toEqual([43.34, 43.33, 43.33]);
    expect(sumExactAmounts(splits130)).toBe(130);

    // 44 split among 3 members
    const splits44 = splitExactAmount(44, 3);
    expect(splits44).toEqual([14.67, 14.67, 14.66]);
    expect(sumExactAmounts(splits44)).toBe(44);

    // 57 split among 3 members
    const splits57 = splitExactAmount(57, 3);
    expect(splits57).toEqual([19, 19, 19]);
    expect(sumExactAmounts(splits57)).toBe(57);
  });

  it('preserves user original transaction amounts and never mutates them', () => {
    const transactions = [
      { name: 'Person A', amount: 125, originalAmount: 125 },
      { name: 'Person B', amount: 125, originalAmount: 125 },
      { name: 'Person C', amount: 125, originalAmount: 125 },
    ];

    const total = sumExactAmounts(transactions.map((t) => t.amount));
    expect(total).toBe(375);

    const share = splitExactAmount(total, transactions.length);
    expect(share).toEqual([125, 125, 125]);

    // Original transaction records must remain 125.00
    for (const t of transactions) {
      expect(t.originalAmount).toBe(125);
      expect(formatExactMoney(t.originalAmount)).toBe('125.00');
    }
  });
});
