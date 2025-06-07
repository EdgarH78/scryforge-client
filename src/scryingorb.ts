import { ScryForgeServer, ScryingOrb, Camera, markersToPoints, ScryData } from './types';

export class SimpleScryingOrb implements ScryingOrb {
    constructor(private server: ScryForgeServer) {}

    public async scry(camera: Camera): Promise<ScryData> {
        const image = await camera.captureFrame();
        const markers = await this.server.getArucoLocations(image);
        const positions = await this.server.getCategoryPositions(image);

        return {
            categoryPositions: positions,
            markersPoints: markersToPoints(markers)
        };
    }
} 