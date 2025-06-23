import { ScryForgeServer, ForgeRealmAuthServer, TokenVault, AuthenticationError } from './types';

export class ScryforgeAuthDecorator implements ScryForgeServer {
    constructor(
        private scryForgeServer: ScryForgeServer,
        private authServer: ForgeRealmAuthServer,
        private tokenVault: TokenVault
    ) {}

    public async getArucoLocations(image: Blob): Promise<any> {
        try {
            return await this.scryForgeServer.getArucoLocations(image);
        } catch (error) {
            if (error instanceof AuthenticationError) {
                return await this.handleAuthError(() => 
                    this.scryForgeServer.getArucoLocations(image)
                );
            }
            throw error;
        }
    }

    public async getCategoryPositions(image: Blob): Promise<any> {
        try {
            return await this.scryForgeServer.getCategoryPositions(image);
        } catch (error) {
            if (error instanceof AuthenticationError) {
                return await this.handleAuthError(() => 
                    this.scryForgeServer.getCategoryPositions(image)
                );
            }
            throw error;
        }
    }

    private async handleAuthError<T>(retryOperation: () => Promise<T>): Promise<T> {
        try {
            // Get tokens from vault
            const token = this.tokenVault.getToken();
            const refreshToken = this.tokenVault.getRefreshToken();
            
            if (!token || !refreshToken) {
                throw new Error('No token or refresh token available');
            }
            
            // Attempt to refresh the token
            const authResponse = await this.authServer.refreshAuth(token, refreshToken);
            
            // Update tokens in vault with new tokens from response
            this.tokenVault.setKeys(authResponse.token, authResponse.refresh_token);
            
            // If refresh succeeds, retry the original operation
            return await retryOperation();
        } catch (refreshError) {
            // If refresh fails, clear the token vault and throw the original error
            this.tokenVault.clearToken();
            throw new AuthenticationError('Authentication failed and token refresh unsuccessful');
        }
    }
}
