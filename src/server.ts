import { ScryForgeServer, ScryforgeMarkers, CategoryPosition, AuthenticationError, RateLimitError, ServiceUnavailableError, BadRequestError, TokenVault } from './types';

export class HttpScryForgeServer implements ScryForgeServer {
    private baseUrl: string;
    private tokenVault: TokenVault;

    constructor(baseUrl: string = 'https://theforgerealm.com/scryforge', tokenVault: TokenVault) {
        this.baseUrl = baseUrl;
        this.tokenVault = tokenVault;
    }

    private getAuthHeaders(): HeadersInit {
        const token = this.tokenVault.getToken();
        if (!token) {
            throw new AuthenticationError('No JWT token found. Please authenticate first.');
        }

        return {
            'Authorization': `Bearer ${token}`
        };
    }

    public async getArucoLocations(image: Blob): Promise<ScryforgeMarkers> {
        const formData = new FormData();
        formData.append('image', image);

        const response = await fetch(`${this.baseUrl}/api/v1/image/arucolocations`, {
            method: 'POST',
            body: formData,
            headers: this.getAuthHeaders()
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Clear invalid token
                this.tokenVault.clearToken();
                throw new AuthenticationError('Authentication required. Please authenticate with ScryForge.');
            } else if (response.status === 429) {
                throw new RateLimitError('Rate limit exceeded. Please wait before making another request.');
            } else if (response.status === 400) {
                throw new BadRequestError('Invalid request format.');
            } else {
                throw new Error(`Failed to get aruco locations: ${response.statusText}`);
            }
        }

        const data = await response.json();
        if (!data.positions) {
            throw new Error('Invalid response format from server');
        }

        return data.positions;
    }

    public async getCategoryPositions(image: Blob): Promise<CategoryPosition[]> {
        const formData = new FormData();
        formData.append('image', image);

        const response = await fetch(`${this.baseUrl}/api/v1/image/categories/positions`, {
            method: 'POST',
            body: formData,
            headers: this.getAuthHeaders()
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Clear invalid token
                this.tokenVault.clearToken();
                throw new AuthenticationError('Authentication required. Please authenticate with ScryForge.');
            } else if (response.status === 429) {
                throw new RateLimitError('Rate limit exceeded. Please wait before making another request.');
            } else if (response.status === 503) {
                throw new ServiceUnavailableError('Service unavailable. Please try again later.');
            } else if (response.status === 400) {
                throw new BadRequestError('Invalid request format.');
            } else {
                throw new Error(`Failed to get category positions: ${response.statusText}`);
            }
        }

        const data = await response.json();
        if (!data.positions) {
            throw new Error('Invalid response format from server');
        }

        return data.positions;
    }
} 