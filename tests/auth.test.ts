import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpAuthServer } from '../src/authserver';
import { HttpScryForgeServer } from '../src/server';

// Mock fetch globally
global.fetch = vi.fn();

// Create mock tokenManager
const tokenManager = {
    getToken: vi.fn(),
    setKeys: vi.fn(),
    clearToken: vi.fn(),
    hasToken: vi.fn(),
    getRefreshToken: vi.fn(),
    hasRefreshToken: vi.fn(),
    tokensUpdated: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
    }
};

describe('HttpAuthServer', () => {
    let authServer: HttpAuthServer;

    beforeEach(() => {
        authServer = new HttpAuthServer();
        vi.clearAllMocks();
    });

    it('should check authentication status correctly', async () => {
        // Mock token manager to return a token
        (tokenManager.hasToken as any).mockReturnValue(true);
        (tokenManager.getToken as any).mockReturnValue('test-jwt-token-123');
        
        const mockResponse = {
            ok: true,
            json: vi.fn().mockResolvedValue({ status: 'authenticated' })
        };
        (fetch as any).mockResolvedValue(mockResponse);

        const result = await authServer.isAuthenticated('test-jwt-token-123');
        
        expect(result).toBe(true);
        expect(fetch).toHaveBeenCalledWith(
            'https://theforgerealm.com/auth/status',
            expect.objectContaining({
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer test-jwt-token-123'
                }
            })
        );
    });

    it('should handle authentication failure', async () => {
        // Mock token manager to return a token
        (tokenManager.hasToken as any).mockReturnValue(true);
        (tokenManager.getToken as any).mockReturnValue('test-jwt-token-123');
        
        const mockResponse = {
            ok: true,
            json: vi.fn().mockResolvedValue({ status: 'unauthenticated' })
        };
        (fetch as any).mockResolvedValue(mockResponse);

        const result = await authServer.isAuthenticated('test-jwt-token-123');
        
        expect(result).toBe(false);
    });

    it('should handle network errors gracefully', async () => {
        // Mock token manager to return a token
        (tokenManager.hasToken as any).mockReturnValue(true);
        (tokenManager.getToken as any).mockReturnValue('test-jwt-token-123');
        
        (fetch as any).mockRejectedValue(new Error('Network error'));

        const result = await authServer.isAuthenticated('test-jwt-token-123');
        
        expect(result).toBe(false);
    });

    it('should return auth status', async () => {
        // Mock token manager to return a token
        (tokenManager.hasToken as any).mockReturnValue(true);
        (tokenManager.getToken as any).mockReturnValue('test-jwt-token-123');
        
        const mockResponse = {
            ok: true,
            json: vi.fn().mockResolvedValue({ status: 'authenticated' })
        };
        (fetch as any).mockResolvedValue(mockResponse);

        const status = await authServer.getAuthStatus('test-jwt-token-123');
        
        expect(status).toHaveProperty('isAuthenticated');
        expect(status).toHaveProperty('lastChecked');
        expect(status).toHaveProperty('token');
        expect(typeof status.isAuthenticated).toBe('boolean');
        expect(typeof status.lastChecked).toBe('number');
        expect(status.token).toBe('test-jwt-token-123');
    });

    it('should start token auth flow', async () => {
        const mockResponse = {
            ok: true,
            json: vi.fn().mockResolvedValue({ token: 'test-token-123' })
        };
        (fetch as any).mockResolvedValue(mockResponse);

        const token = await authServer.tokenAuthStart('Test Client');
        
        expect(token).toBe('test-token-123');
        expect(fetch).toHaveBeenCalledWith(
            'https://theforgerealm.com/auth/token/start',
            expect.objectContaining({
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ client_name: 'Test Client' })
            })
        );
    });

    it('should check token status', async () => {
        const mockResponse = {
            ok: true,
            json: vi.fn().mockResolvedValue({ fulfilled: true, token: 'new-jwt-token', refreshToken: 'new-refresh-token' })
        };
        (fetch as any).mockResolvedValue(mockResponse);

        const result = await authServer.getAuthTokenStatus('test-token-123');
        
        expect(result.fulfilled).toBe(true);
        expect(result.token).toBe('new-jwt-token');
        expect(result.refreshToken).toBe('new-refresh-token');
        expect(fetch).toHaveBeenCalledWith(
            'https://theforgerealm.com/auth/token/status?token=test-token-123',
            expect.objectContaining({
                method: 'GET',
                credentials: 'include'
            })
        );
    });
});

describe('HttpScryForgeServer', () => {
    let scryForgeServer: HttpScryForgeServer;

    beforeEach(() => {
        scryForgeServer = new HttpScryForgeServer('https://theforgerealm.com/scryforge', tokenManager);
        vi.clearAllMocks();
    });

    it('should make authenticated requests with credentials', async () => {
        // Mock token manager to return a token
        (tokenManager.getToken as any).mockReturnValue('test-jwt-token-123');
        
        const mockResponse = {
            ok: true,
            json: vi.fn().mockResolvedValue({ positions: [] })
        };
        (fetch as any).mockResolvedValue(mockResponse);

        const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
        await scryForgeServer.getArucoLocations(mockBlob);
        
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/scryforge/api/v1/image/arucolocations'),
            expect.objectContaining({
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer test-jwt-token-123'
                },
                body: expect.any(FormData)
            })
        );
    });

    it('should handle 401 responses as authentication errors', async () => {
        // Mock token manager to return a token
        (tokenManager.getToken as any).mockReturnValue('test-jwt-token-123');
        
        const mockResponse = {
            ok: false,
            status: 401,
            json: vi.fn().mockResolvedValue({ error: 'Unauthorized' })
        };
        (fetch as any).mockResolvedValue(mockResponse);

        const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
        
        await expect(scryForgeServer.getArucoLocations(mockBlob)).rejects.toThrow('Authentication required. Please authenticate with ScryForge.');
        expect(tokenManager.clearToken).toHaveBeenCalled();
    });

    it('should get category positions with credentials', async () => {
        // Mock token manager to return a token
        (tokenManager.getToken as any).mockReturnValue('test-jwt-token-123');
        
        const mockResponse = {
            ok: true,
            json: vi.fn().mockResolvedValue({ positions: [] })
        };
        (fetch as any).mockResolvedValue(mockResponse);

        const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
        await scryForgeServer.getCategoryPositions(mockBlob);
        
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/scryforge/api/v1/image/categories/positions'),
            expect.objectContaining({
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer test-jwt-token-123'
                },
                body: expect.any(FormData)
            })
        );
    });

    it('should throw authentication error when no JWT token is found', async () => {
        // Mock token manager to return no token
        (tokenManager.getToken as any).mockReturnValue(null);

        const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
        
        await expect(scryForgeServer.getArucoLocations(mockBlob)).rejects.toThrow('No JWT token found. Please authenticate first.');
    });
}); 