/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { ActorPosition, Calibration, Camera, Category, ScryingOrb, TrackedActor, WorldTransformerFactory, ViewPortCalibrator, ForgeRealmAuthServer, TokenVault, AuthenticationError } from './types';
import { ScryforgeAuthManager } from './scryforgeauthmanager';

export class ScryForge {
    private scryingOrb: ScryingOrb;
    private trackedActors: Map<Category, TrackedActor>;
    private camera: Camera | null = null;
    private calibration: Calibration | null = null;
    private worldTransformerFactory: WorldTransformerFactory;
    private isScrying: boolean = false;
    private calibrator: ViewPortCalibrator;
    private authServer: ForgeRealmAuthServer;
    private tokenVault: TokenVault;
    private authManager: ScryforgeAuthManager;

    constructor(
        scryingOrb: ScryingOrb, 
        worldTransformerFactory: WorldTransformerFactory,
        calibrator: ViewPortCalibrator,
        authServer: ForgeRealmAuthServer,
        tokenVault: TokenVault
    ) {
        this.scryingOrb = scryingOrb;
        this.trackedActors = new Map();
        this.worldTransformerFactory = worldTransformerFactory;
        this.calibrator = calibrator;
        this.authServer = authServer;
        this.tokenVault = tokenVault;
        this.authManager = new ScryforgeAuthManager(this);
    }

    public getCalibrator(): ViewPortCalibrator {
        return this.calibrator;
    }

    public async authenticate(): Promise<void> {
        await this.authManager.authenticate();
    }

    public async isAuthenticated(): Promise<boolean> {
        return this.tokenVault.hasToken();
    }

    public async setTokens(token: string, refreshToken?: string): Promise<void> {
        // Verify tokens are valid
        try {
            const authStatus = await this.authServer.getAuthStatus(token);
            if (!authStatus.isAuthenticated) {
                throw new AuthenticationError('Invalid token provided');
            }
            
            if (refreshToken) {
                this.tokenVault.setKeys(token, refreshToken);
            } else {
                // If no refresh token provided, keep the existing one
                const existingRefreshToken = this.tokenVault.getRefreshToken();
                this.tokenVault.setKeys(token, existingRefreshToken || '');
            }
        } catch (error) {
            // If token is invalid, try to refresh if we have a refresh token
            const currentRefreshToken = this.tokenVault.getRefreshToken();
            if (currentRefreshToken) {
                try {
                    const authResponse = await this.authServer.refreshAuth(token, currentRefreshToken);
                    // Set the new tokens from the response
                    this.tokenVault.setKeys(authResponse.token, authResponse.refresh_token);
                } catch (refreshError) {
                    this.tokenVault.clearToken();
                    throw new AuthenticationError('Token refresh failed');
                }
            } else {
                this.tokenVault.clearToken();
                throw new AuthenticationError('Invalid token and no refresh token available');
            }
        }
    }

    public clearTokens(): void {
        this.tokenVault.clearToken();
    }

    public async startTokenAuth(clientName?: string): Promise<string> {
        return await this.authServer.tokenAuthStart(clientName);
    }

    public async checkTokenStatus(token: string): Promise<any> {
        return await this.authServer.getAuthTokenStatus(token);
    }

    public async scry(corners: {x: number, y: number}[]): Promise<ActorPosition[]> {
        if (!this.camera) {
            throw new Error("Camera not set");
        }

        // Return empty array if already scrying
        if (this.isScrying) {
            return [];
        }

        try {
            this.isScrying = true;
            let scryData = await this.scryingOrb.scry(this.camera);
            
            if (!scryData.markersPoints || scryData.markersPoints.length < 4) {
                return [];
            }
            const worldCoordinateTransformer = this.worldTransformerFactory.createTransformer(scryData.markersPoints, corners);    
            return scryData.categoryPositions.map(position => {
                const worldPosition = worldCoordinateTransformer.transform(position.x, position.y);
                return {
                    actorId: this.trackedActors.get(position.category)?.actorId ?? "",            
                    x: worldPosition.x,
                    y: worldPosition.y
                }
            }).filter(position => position.actorId !== "");
        } catch (error) {
            throw error;
        } finally {
            this.isScrying = false;
        }
    }

    public canScry(): boolean {
        return this.camera !== null;
    }
    
    public updateActorCategory(actorId: string, category: Category): void {
        this.trackedActors.set(category, { actorId, category });
    }

    public removeActorCategory(actorId: string): void { 
        this.trackedActors.forEach((trackedActor, category) => {
            if (trackedActor.actorId === actorId) {
                this.trackedActors.delete(category);
            }
        });
    }

    public getTrackedActor(actorId: string): TrackedActor | undefined {
        return  this.getTrackedActors().find(trackedActor => trackedActor.actorId === actorId);
    }

    public getTrackedActors(): TrackedActor[] {
        return Array.from(this.trackedActors.values());
    }

    public getAvailableCategories(): Category[] {
        return Array.from(this.trackedActors.keys());
    }  

    public setCamera(camera: Camera): void {
        this.camera = camera;
    }

    public getCamera(): Camera | null {
        return this.camera;
    }

    public setCalibration(calibration: Calibration | null): void {
        this.calibration = calibration;
    }

    public getCalibration(): Calibration | null {
        return this.calibration;
    }

    public getTokensUpdatedEvent(): EventTarget {
        return this.tokenVault.tokensUpdated;
    }

    public getCurrentToken(): string | null {
        return this.tokenVault.getToken();
    }

    public getCurrentRefreshToken(): string | null {
        return this.tokenVault.getRefreshToken();
    }
} 