import { ScryForge } from "./scryforge";

export class ScryforgeAuthManager {
    constructor(private scryForge: ScryForge) {}
  
    public async authenticate(): Promise<void> {
        await this.authenticateViaToken();
    }
  
    private isElectron(): boolean {
        return navigator.userAgent.toLowerCase().includes("electron");
    }
  
    private async authenticateViaToken(): Promise<void> {
        const token = await this.scryForge.startTokenAuth("ScryForge Client");
        const authUrl = `https://theforgerealm.com/auth/login?token=${token}`;
        
        if (this.isElectron()) {
            // On Electron, open in external browser
            window.open(authUrl, '_blank');
        } else {
            // On regular browser, open in popup
            await this.openAuthPopup(authUrl);
        }
        
        const fulfilled = await this.pollTokenStatus(token);
        if (!fulfilled) throw new Error("Authentication timeout or cancelled");
    }
  
    private async openAuthPopup(authUrl: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const width = 500;
            const height = 600;
            const left = (window.screen.width / 2) - (width / 2);
            const top = (window.screen.height / 2) - (height / 2);

            const authWindow = window.open(
                authUrl,
                'scryforge_auth',
                `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
            );

            if (!authWindow) {
                reject(new Error('Failed to open authentication window. Please allow popups for this site.'));
                return;
            }

            // Add timeout to prevent infinite polling
            const timeout = setTimeout(() => {
                clearInterval(authCheckInterval);
                authWindow.close();
                reject(new Error('Authentication timeout - please try again.'));
            }, 5 * 60 * 1000); // 5 minute timeout

            // Check for authentication completion and close popup
            const authCheckInterval = setInterval(async () => {
                try {
                    // Check if window was manually closed
                    if (authWindow?.closed) {
                        clearInterval(authCheckInterval);
                        clearTimeout(timeout);
                        resolve();
                        return;
                    }

                    // Check if authentication completed using ScryForge
                    const isAuthenticated = await this.scryForge.isAuthenticated();
                    if (isAuthenticated) {
                        // Authentication completed, close popup and resolve
                        clearInterval(authCheckInterval);
                        clearTimeout(timeout);
                        authWindow.close();
                        resolve();
                    }
                } catch (error) {
                    clearInterval(authCheckInterval);
                    clearTimeout(timeout);
                    authWindow.close();
                    reject(error);
                }
            }, 1000);
        });
    }
  
    private async pollTokenStatus(token: string): Promise<boolean> {
        const timeout = 5 * 60 * 1000; // 5 min
        const interval = 3000; // 3 sec
        const start = Date.now();
  
        while (Date.now() - start < timeout) {
            const result = await this.scryForge.checkTokenStatus(token);
            if (result.fulfilled) {
                // Token is fulfilled, check if we got a JWT token
                if (result.token) {
                    await this.scryForge.setTokens(result.token, result.refreshToken);
                }
                return true;
            }
            await new Promise((r) => setTimeout(r, interval));
        }
        return false;
    }
}
  