import { ScryForgeServer,ScryforgeMarkers, CategoryPosition } from './types';

export class HttpScryForgeServer implements ScryForgeServer {
    private baseUrl: string;

    constructor(baseUrl: string = 'http://127.0.0.1:5000') {
        this.baseUrl = baseUrl;
    }

    public async getArucoLocations(image: Blob): Promise<ScryforgeMarkers> {
        const formData = new FormData();
        formData.append('image', image);

        const response = await fetch(`${this.baseUrl}/image/arucolocations`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (!response.ok || !data.positions) {
            throw new Error('Failed to get aruco locations');
        }

        return data.positions;
    }

    public async getCategoryPositions(image: Blob): Promise<CategoryPosition[]> {
        const formData = new FormData();
        formData.append('image', image);

        const response = await fetch(`${this.baseUrl}/image/categories/positions`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Failed to get category positions');
        }

        const data = await response.json();
        return data.positions;
    }
} 