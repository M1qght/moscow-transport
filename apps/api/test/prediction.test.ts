import { describe, expect, it } from 'vitest';
import { blendPrediction, moscowHour } from '../src/prediction.service';

describe('prediction', () => {
  it('combines historical load and latest report', () => {
    expect(blendPrediction(40, 10)).toBe(28);
  });
  it('does not turn missing data into an empty vehicle', () => {
    expect(blendPrediction(null, null)).toBeNull();
    expect(blendPrediction(0, null)).toBe(0);
    expect(blendPrediction(null, 15)).toBe(15);
    expect(blendPrediction(40, null)).toBe(40);
  });
  it('clamps and rounds', () => {
    expect(blendPrediction(200, 150)).toBe(100);
    expect(blendPrediction(-20, -10)).toBe(0);
    expect(blendPrediction(33, 11)).toBe(24.2);
  });
  it('uses Moscow hour across midnight', () => {
    expect(moscowHour(new Date('2026-01-01T22:00:00Z'))).toBe(1);
  });
});
