import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScryforgeAuthDecorator } from '../src/scryforgeauthdecorator';
import { AuthenticationError } from '../src/types';

const makeMocks = () => {
  const scryForgeServer = {
    getArucoLocations: vi.fn(),
    getCategoryPositions: vi.fn(),
  };
  const authServer = {
    refreshAuth: vi.fn(),
    getAuthStatus: vi.fn(),
    tokenAuthStart: vi.fn(),
    getAuthTokenStatus: vi.fn(),
    isAuthenticated: vi.fn(),
    forceRefreshAuthStatus: vi.fn()
  };
  const tokenVault = {
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
  return { scryForgeServer, authServer, tokenVault };
};

describe('ScryforgeAuthDecorator', () => {
  let scryForgeServer: any, authServer: any, tokenVault: any, decorator: any;

  beforeEach(() => {
    ({ scryForgeServer, authServer, tokenVault } = makeMocks());
    decorator = new ScryforgeAuthDecorator(scryForgeServer, authServer, tokenVault);
    vi.clearAllMocks();
  });

  it('should forward successful requests', async () => {
    const mockResult = { positions: [] };
    scryForgeServer.getArucoLocations.mockResolvedValue(mockResult);

    const result = await decorator.getArucoLocations(new Blob());

    expect(result).toEqual(mockResult);
    expect(scryForgeServer.getArucoLocations).toHaveBeenCalledOnce();
  });

  it('should attempt token refresh on authentication error', async () => {
    const mockResult = { positions: [] };
    scryForgeServer.getArucoLocations
      .mockRejectedValueOnce(new AuthenticationError('Auth failed'))
      .mockResolvedValueOnce(mockResult);
    
    authServer.refreshAuth.mockResolvedValue({
      status: 'ok',
      message: 'authenticated',
      token: 'new-access-token',
      refresh_token: 'new-refresh-token'
    });
    
    tokenVault.getToken.mockReturnValue('access');
    tokenVault.getRefreshToken.mockReturnValue('refresh');

    const result = await decorator.getArucoLocations(new Blob());

    expect(result).toEqual(mockResult);
    expect(authServer.refreshAuth).toHaveBeenCalledWith('access', 'refresh');
    expect(tokenVault.setKeys).toHaveBeenCalledWith('new-access-token', 'new-refresh-token');
    expect(scryForgeServer.getArucoLocations).toHaveBeenCalledTimes(2);
  });

  it('should clear tokens and throw error on failed refresh', async () => {
    scryForgeServer.getArucoLocations.mockRejectedValue(new AuthenticationError('Auth failed'));
    authServer.refreshAuth.mockRejectedValue(new Error('refresh failed'));
    
    tokenVault.getToken.mockReturnValue('access');
    tokenVault.getRefreshToken.mockReturnValue('refresh');

    await expect(decorator.getArucoLocations(new Blob())).rejects.toThrow('Authentication failed and token refresh unsuccessful');
    
    expect(tokenVault.clearToken).toHaveBeenCalled();
  });
}); 