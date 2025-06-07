import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SimpleScryingOrb } from '../src/scryingorb';
import { Camera, CategoryPosition, ScryforgeMarkers, Category, ScryForgeServer } from '../src/types';

describe('SimpleScryingOrb', () => {
    let scryingOrb: SimpleScryingOrb;
    let mockServer: ScryForgeServer;
    let mockCamera: Camera;
    let emptyMarkers: ScryforgeMarkers;

    beforeEach(() => {
        emptyMarkers = {
            top_left: [0, 0],
            top_right: [0, 0],
            bottom_right: [0, 0],
            bottom_left: [0, 0]
        };

        // Mock the server
        const getArucoLocations = vi.fn().mockResolvedValue(emptyMarkers);
        const getCategoryPositions = vi.fn().mockResolvedValue([]);
        mockServer = {
            getArucoLocations,
            getCategoryPositions
        };

        // Mock the camera
        mockCamera = {
            captureFrame: vi.fn().mockResolvedValue(new Blob()),
            stream: vi.fn().mockReturnValue(null),
            destroy: vi.fn()
        };

        scryingOrb = new SimpleScryingOrb(mockServer);
    });

    describe('scry', () => {
        it('should handle case with no detected positions', async () => {
            const result = await scryingOrb.scry(mockCamera);

            expect(result.categoryPositions).toEqual([]);
            expect(result.markersPoints).toHaveLength(4); // Empty markers still produce 4 points
            expect(mockCamera.captureFrame).toHaveBeenCalled();
            expect(mockServer.getArucoLocations).toHaveBeenCalled();
            expect(mockServer.getCategoryPositions).toHaveBeenCalled();
        });

        it('should return category positions and marker points', async () => {
            // Setup
            const mockMarkers: ScryforgeMarkers = {
                top_left: [0, 0],
                top_right: [1, 0],
                bottom_right: [1, 1],
                bottom_left: [0, 1]
            };

            const mockPositions: CategoryPosition[] = [
                { category: Category.RED, x: 0.5, y: 0.5, width: 0.1, height: 0.1 }
            ];

            (mockServer.getArucoLocations as any).mockResolvedValue(mockMarkers);
            (mockServer.getCategoryPositions as any).mockResolvedValue(mockPositions);

            // Act
            const result = await scryingOrb.scry(mockCamera);

            // Assert
            expect(result.categoryPositions).toEqual(mockPositions);
            expect(result.markersPoints).toHaveLength(4);
            expect(mockCamera.captureFrame).toHaveBeenCalled();
            expect(mockServer.getArucoLocations).toHaveBeenCalled();
            expect(mockServer.getCategoryPositions).toHaveBeenCalled();
        });
    });
}); 