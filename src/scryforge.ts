/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { ActorPosition, Calibration, Camera, Category, ScryingOrb, TrackedActor, WorldTransformerFactory } from './types';

export class ScryForge {
    private scryingOrb: ScryingOrb;
    private trackedActors: Map<Category, TrackedActor>;
    private camera: Camera | null = null;
    private calibration: Calibration | null = null;
    private worldTransformerFactory: WorldTransformerFactory;
    private isScrying: boolean = false;

    constructor(scryingOrb: ScryingOrb, worldTransformerFactory: WorldTransformerFactory) {
        this.scryingOrb = scryingOrb;
        this.trackedActors = new Map();
        this.worldTransformerFactory = worldTransformerFactory;
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
} 