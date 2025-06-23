import { ForgeRealmAuthServer, AuthStatus, TokenStatusResult, AuthResponse, AuthenticationError, BadRequestError, ServiceUnavailableError } from './types';

export class HttpAuthServer implements ForgeRealmAuthServer {
    private baseUrl: string;
    private authStatus: AuthStatus = {
        isAuthenticated: false,
        lastChecked: 0
    };
    private authWindow: Window | null = null;
    private authCheckInterval: NodeJS.Timeout | null = null;
    
    // Cache settings - prevent spamming the auth server
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    private lastStatusCheck = 0;
    private cachedAuthStatus: boolean | null = null;

    constructor(baseUrl: string = 'https://theforgerealm.com') {
        this.baseUrl = baseUrl;
    }

    private isCacheValid(): boolean {
        return Date.now() - this.lastStatusCheck < this.CACHE_DURATION && this.cachedAuthStatus !== null;
    }

    private updateCache(isAuthenticated: boolean): void {
        this.cachedAuthStatus = isAuthenticated;
        this.lastStatusCheck = Date.now();
    }

    private getAuthHeaders(token: string): HeadersInit {
        return {
            'Authorization': `Bearer ${token}`
        };
    }

    public async getAuthStatus(token?: string): Promise<AuthStatus> {
        try {
            // If we have a token, try to validate it
            if (token) {
                const response = await fetch(`${this.baseUrl}/auth/status`, {
                    method: 'GET',
                    headers: this.getAuthHeaders(token)
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const isAuthenticated = data.status === 'authenticated';
                    this.authStatus = {
                        isAuthenticated,
                        lastChecked: Date.now(),
                        token: token,
                        error: data.status === 'renewal_required' ? 'Token renewal required' : undefined
                    };
                    this.updateCache(isAuthenticated);
                } else if (response.status === 401) {
                    // Token is invalid
                    this.authStatus = {
                        isAuthenticated: false,
                        lastChecked: Date.now(),
                        error: 'Token expired or invalid'
                    };
                    this.updateCache(false);
                } else {
                    throw new AuthenticationError('Failed to validate token');
                }
            } else {
                // No token available
                this.authStatus = {
                    isAuthenticated: false,
                    lastChecked: Date.now(),
                    error: 'No authentication token available'
                };
                this.updateCache(false);
            }
        } catch (error) {
            if (error instanceof AuthenticationError) {
                throw error;
            }
            this.authStatus = {
                isAuthenticated: false,
                lastChecked: Date.now(),
                error: error instanceof Error ? error.message : 'Unknown error'
            };
            this.updateCache(false);
        }
        return { ...this.authStatus };
    }

    public async refreshAuth(token: string, refreshToken: string): Promise<AuthResponse> {
        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refresh_token: refreshToken })
        });
        if (!response.ok) {
            if (response.status === 401) {
                throw new AuthenticationError('Failed to refresh authentication - token expired');
            } else if (response.status === 400) {
                throw new BadRequestError('Invalid refresh request');
            } else if (response.status >= 500) {
                throw new ServiceUnavailableError('Authentication service unavailable');
            } else {
                throw new Error('Failed to refresh authentication');
            }
        }
        
        const data = await response.json();
        return data as AuthResponse;
    }

    public async tokenAuthStart(clientName?: string): Promise<string> {
        const requestBody = clientName ? { client_name: clientName } : undefined;
        
        const response = await fetch(`${this.baseUrl}/auth/token/start`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: requestBody ? JSON.stringify(requestBody) : undefined
        });
        if (!response.ok) {
            if (response.status === 401) {
                throw new AuthenticationError('Authentication required to start token flow');
            } else if (response.status === 400) {
                throw new BadRequestError('Invalid token request');
            } else if (response.status >= 500) {
                throw new ServiceUnavailableError('Authentication service unavailable');
            } else {
                throw new Error('Failed to start token auth');
            }
        }
        const data = await response.json();
        return data.token;
    }

    public async getAuthTokenStatus(token: string): Promise<TokenStatusResult> {
        const response = await fetch(`${this.baseUrl}/auth/token/status?token=${token}`, {
            method: 'GET',
            credentials: 'include'
        });
        if (!response.ok) {
            if (response.status === 400) {
                throw new BadRequestError('Missing or invalid token');
            } else if (response.status === 404) {
                throw new BadRequestError('Invalid or expired token');
            } else if (response.status >= 500) {
                throw new ServiceUnavailableError('Authentication service unavailable');
            } else {
                throw new Error('Failed to check token status');
            }
        }
        const data = await response.json();
        
        return data;
    }

    // Legacy/compat methods for UI with caching
    public async isAuthenticated(token?: string): Promise<boolean> {
        // Return cached result if still valid
        if (this.isCacheValid()) {
            return this.cachedAuthStatus!;
        }
        
        const status = await this.getAuthStatus(token);
        return status.isAuthenticated;
    }

    // Method to force refresh the auth status (clears cache)
    public async forceRefreshAuthStatus(token?: string): Promise<boolean> {
        this.cachedAuthStatus = null;
        const status = await this.getAuthStatus(token);
        return status.isAuthenticated;
    }

    public async authenticate(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Open OAuth window
            const authUrl = `${this.baseUrl}/auth/login`;
            const width = 500;
            const height = 600;
            const left = (window.screen.width / 2) - (width / 2);
            const top = (window.screen.height / 2) - (height / 2);

            this.authWindow = window.open(
                authUrl,
                'scryforge_auth',
                `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
            );

            if (!this.authWindow) {
                reject(new Error('Failed to open authentication window. Please allow popups for this site.'));
                return;
            }

            // Add timeout to prevent infinite polling
            const timeout = setTimeout(() => {
                if (this.authCheckInterval) {
                    clearInterval(this.authCheckInterval);
                    this.authCheckInterval = null;
                }
                if (this.authWindow) {
                    this.authWindow.close();
                    this.authWindow = null;
                }
                reject(new Error('Authentication timeout - please try again.'));
            }, 5 * 60 * 1000); // 5 minute timeout

            // Check for authentication completion
            this.authCheckInterval = setInterval(async () => {
                try {
                    if (this.authWindow?.closed) {
                        clearInterval(this.authCheckInterval!);
                        clearTimeout(timeout);
                        this.authCheckInterval = null;
                        this.authWindow = null;
                        // Clear cache and check if authentication was successful
                        this.cachedAuthStatus = null;
                        const isAuth = await this.isAuthenticated();
                        if (isAuth) {
                            resolve();
                        } else {
                            reject(new Error('Authentication was cancelled or failed.'));
                        }
                    }
                } catch (error) {
                    clearInterval(this.authCheckInterval!);
                    clearTimeout(timeout);
                    this.authCheckInterval = null;
                    this.authWindow = null;
                    reject(error);
                }
            }, 1000);
        });
    }
} 