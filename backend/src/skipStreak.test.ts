import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeSkipStreak, manilaDayKey, type SkipStreakEvent } from './skipStreak.js';

const skip = (timestamp: string): SkipStreakEvent => ({ kind: 'skip', timestamp });
const collection = (timestamp: string): SkipStreakEvent => ({ kind: 'collection', timestamp });

describe('computeSkipStreak', () => {
  it('counts consecutive skips with streakStart of the first skip', () => {
    const r = computeSkipStreak([skip('2026-10-13T01:00:00Z'), skip('2026-10-14T01:00:00Z'), skip('2026-10-15T01:00:00Z')]);
    assert.equal(r.streak, 3);
    assert.equal(r.streakStart, '2026-10-13T01:00:00.000Z');
    assert.deepEqual(r.skippedDates, ['2026-10-15', '2026-10-14', '2026-10-13']);
  });

  it('counts same-day duplicates (or two collectors) once', () => {
    const r = computeSkipStreak([skip('2026-10-15T01:00:00Z'), skip('2026-10-15T08:00:00Z')]);
    assert.equal(r.streak, 1);
    assert.deepEqual(r.skippedDates, ['2026-10-15']);
  });

  it('splits a 23:30 UTC report from the next Manila day', () => {
    // 23:30 UTC Oct 14 = 07:30 Oct 15 in Manila (UTC+8).
    assert.equal(manilaDayKey('2026-10-14T23:30:00Z'), '2026-10-15');
    const r = computeSkipStreak([skip('2026-10-14T10:00:00Z'), skip('2026-10-14T23:30:00Z')]);
    assert.equal(r.streak, 2);
  });

  it('ignores dirty/other reports (caller filters them out)', () => {
    const r = computeSkipStreak([skip('2026-10-15T01:00:00Z')]);
    assert.equal(r.streak, 1);
  });

  it('a collection resets the streak', () => {
    const r = computeSkipStreak([
      skip('2026-10-13T01:00:00Z'),
      skip('2026-10-14T01:00:00Z'),
      collection('2026-10-15T01:00:00Z'),
      skip('2026-10-16T01:00:00Z'),
    ]);
    assert.equal(r.streak, 1);
    assert.equal(r.streakStart, '2026-10-16T01:00:00.000Z');
  });

  it('ignores dismissed reports (caller filters them out)', () => {
    const r = computeSkipStreak([]);
    assert.deepEqual(r, { streak: 0, streakStart: null, skippedDates: [] });
  });

  it('archived households give 0', () => {
    const r = computeSkipStreak([skip('2026-10-15T01:00:00Z')], { archived: true });
    assert.deepEqual(r, { streak: 0, streakStart: null, skippedDates: [] });
  });

  it('a streak ending then a new one starting uses the new start', () => {
    const r = computeSkipStreak([
      skip('2026-10-10T01:00:00Z'),
      skip('2026-10-11T01:00:00Z'),
      collection('2026-10-12T01:00:00Z'),
      skip('2026-10-13T01:00:00Z'),
      skip('2026-10-14T01:00:00Z'),
      skip('2026-10-15T01:00:00Z'),
    ]);
    assert.equal(r.streak, 3);
    assert.equal(r.streakStart, '2026-10-13T01:00:00.000Z');
  });
});
