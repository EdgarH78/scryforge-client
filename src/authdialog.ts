import { localize } from './utils/i18n';
import { ScryForge } from './scryforge';

export class AuthDialog extends Application {
    private scryForge: ScryForge;
    private authStatus: 'checking' | 'authenticated' | 'not_authenticated' | 'error' = 'checking';
    private statusMessage: string = '';
    private isInitialized: boolean = false; // Prevent recursive auth checks

    constructor(scryForge: ScryForge) {
        super();
        this.scryForge = scryForge;
    }

    static get defaultOptions(): ApplicationOptions {
        return mergeObject(super.defaultOptions, {
            id: 'scryforge-auth-dialog',
            template: 'modules/scryforge/templates/auth-dialog.html',
            title: localize('Auth.Title'),
            width: 400,
            height: 300,
            resizable: false,
            popOut: true
        });
    }

    getData(): any {
        return {
            status: this.authStatus,
            statusMessage: this.statusMessage,
            isAuthenticated: this.authStatus === 'authenticated',
            isChecking: this.authStatus === 'checking',
            isError: this.authStatus === 'error'
        };
    }

    async activateListeners(html: JQuery): Promise<void> {
        super.activateListeners(html);

        const loginButton = html.find('#login-button');
        const refreshButton = html.find('#refresh-status');

        loginButton.on('click', async () => {
            await this.handleLogin();
        });

        refreshButton.on('click', async () => {
            await this.checkAuthStatus();
        });

        // Only check initial auth status once when dialog is first opened
        if (!this.isInitialized) {
            this.isInitialized = true;
            await this.checkAuthStatus();
        }
    }

    private async checkAuthStatus(): Promise<void> {
        // Prevent concurrent auth status checks
        if (this.authStatus === 'checking') {
            return;
        }

        this.authStatus = 'checking';
        this.statusMessage = localize('Auth.Status.Checking');
        this.render(true);

        try {
            const isAuthenticated = await this.scryForge.isAuthenticated();
            this.authStatus = isAuthenticated ? 'authenticated' : 'not_authenticated';
            this.statusMessage = isAuthenticated 
                ? localize('Auth.Status.Authenticated')
                : localize('Auth.Status.NotAuthenticated');
        } catch (error) {
            this.authStatus = 'error';
            this.statusMessage = localize('Auth.Status.Error');
            console.error('Error checking authentication status:', error);
        }

        this.render(true);
    }

    private async handleLogin(): Promise<void> {
        try {
            this.authStatus = 'checking';
            this.statusMessage = localize('Auth.Status.Checking');
            this.render(true);

            // Use ScryForge's authentication method
            await this.scryForge.authenticate();
            
            this.authStatus = 'authenticated';
            this.statusMessage = localize('Auth.Status.Authenticated');
            ui.notifications?.info(localize('Notifications.AuthSuccess'));
            
            // Close dialog after successful authentication
            setTimeout(() => {
                this.close();
            }, 2000);

        } catch (error) {
            this.authStatus = 'error';
            this.statusMessage = error instanceof Error ? error.message : localize('Notifications.AuthFailed');
            
            if (error instanceof Error && error.message.includes('popup')) {
                ui.notifications?.warn(localize('Auth.PopupBlocked'));
            } else {
                ui.notifications?.error(localize('Notifications.AuthFailed'));
            }
        }

        this.render(true);
    }
} 