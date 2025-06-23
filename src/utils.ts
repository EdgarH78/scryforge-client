import { TokenVault } from './types';

export function average(a: number, b: number): number {
    return (a + b) / 2;
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

// In-memory token storage
export class InMemoryTokenManager implements TokenVault {
    private token: string | null = null;
    private refreshToken: string | null = null;
    public tokensUpdated: EventTarget = new EventTarget();

    getToken(): string | null {
        return this.token;
    }

    getRefreshToken(): string | null {
        return this.refreshToken;
    }

    setKeys(token: string, refreshToken: string): void {
        this.token = token;
        this.refreshToken = refreshToken;
        this.tokensUpdated.dispatchEvent(new Event('tokensUpdated'));
    }

    clearToken(): void {
        this.token = null;
        this.refreshToken = null;
        this.tokensUpdated.dispatchEvent(new Event('tokensUpdated'));
    }

    hasToken(): boolean {
        return this.token !== null;
    }

    hasRefreshToken(): boolean {
        return this.refreshToken !== null;
    }
}