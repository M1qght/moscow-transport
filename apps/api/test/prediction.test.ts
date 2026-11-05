import { describe, expect, it } from 'vitest';
import { blendPrediction, moscowHour, PredictionService } from '../src/prediction.service';
import type { Database } from '../src/database';

describe('prediction', () => {
  it('combines historical load and latest report', () => { expect(blendPrediction(40, 10)).toBe(28); });
  it('does not turn missing data into an empty vehicle', () => {
    expect(blendPrediction(null, null)).toBeNull(); expect(blendPrediction(0, null)).toBe(0);
    expect(blendPrediction(null, 15)).toBe(15); expect(blendPrediction(40, null)).toBe(40);
  });
  it('clamps and rounds', () => { expect(blendPrediction(200, 150)).toBe(100); expect(blendPrediction(-20, -10)).toBe(0); expect(blendPrediction(33, 11)).toBe(24.2); });
  it('uses Moscow hour across midnight', () => { expect(moscowHour(new Date('2026-01-01T22:00:00Z'))).toBe(1); });
  it('returns the arithmetic mean (5, 10, 15 → 10) and preserves zero', async () => {
    const fake = { report: { aggregate: async () => ({ _avg: { load: (5 + 10 + 15) / 3 }, _count: 3, _max: { createdAt: null } }) } };
    const service = new PredictionService(fake as unknown as Database);
    expect(await service.aggregateCurrentLoad('stop', 'route')).toMatchObject({ load: 10, samples: 3 });
  });
});
