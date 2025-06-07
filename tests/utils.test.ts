import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { average, sleep, clamp } from '../src/utils';

describe('average', () => {
    it('calculates average of two positive numbers', () => {
        expect(average(2, 4)).toBe(3);
        expect(average(1, 3)).toBe(2);
    });

    it('calculates average of positive and negative numbers', () => {
        expect(average(-2, 4)).toBe(1);
        expect(average(-5, 5)).toBe(0);
    });

    it('calculates average of two negative numbers', () => {
        expect(average(-2, -4)).toBe(-3);
        expect(average(-1, -3)).toBe(-2);
    });

    it('handles decimal numbers', () => {
        expect(average(1.5, 2.5)).toBe(2);
        expect(average(0.1, 0.3)).toBeCloseTo(0.2);
    });
});

describe('sleep', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('resolves after specified milliseconds', async () => {
        const ms = 1000;
        const promise = sleep(ms);
        
        vi.advanceTimersByTime(ms - 1);
        expect(vi.getTimerCount()).toBe(1);
        
        vi.advanceTimersByTime(1);
        await promise;
        expect(vi.getTimerCount()).toBe(0);
    });

    it('handles zero milliseconds', async () => {
        const promise = sleep(0);
        vi.runAllTimers();
        await promise;
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe('clamp', () => {
    it('returns value when within range', () => {
        expect(clamp(5, 0, 10)).toBe(5);
        expect(clamp(3, 1, 6)).toBe(3);
    });

    it('returns minimum when value is below range', () => {
        expect(clamp(-5, 0, 10)).toBe(0);
        expect(clamp(0, 1, 6)).toBe(1);
    });

    it('returns maximum when value is above range', () => {
        expect(clamp(15, 0, 10)).toBe(10);
        expect(clamp(7, 1, 6)).toBe(6);
    });

    it('handles decimal numbers', () => {
        expect(clamp(1.5, 1, 2)).toBe(1.5);
        expect(clamp(0.5, 1, 2)).toBe(1);
        expect(clamp(2.5, 1, 2)).toBe(2);
    });

    it('works with negative ranges', () => {
        expect(clamp(0, -10, -5)).toBe(-5);
        expect(clamp(-7, -10, -5)).toBe(-7);
        expect(clamp(-15, -10, -5)).toBe(-10);
    });
}); 