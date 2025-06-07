import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScryForge } from '../src/scryforge';
import { Camera, Category, ScryingOrb, WorldCoordinateTransformer, WorldTransformerFactory, Point, CategoryPosition } from '../src/types';

interface ScryData {
    categoryPositions: CategoryPosition[];
    markersPoints: Point[];
}

describe('ScryForge', () => {
    let mockScryingOrb: ScryingOrb;
    let mockCamera: Camera;
    let mockWorldTransformerFactory: WorldTransformerFactory;
    let mockWorldTransformer: WorldCoordinateTransformer;
    let scryForge: ScryForge;

    beforeEach(() => {
        // Mock the world transformer
        mockWorldTransformer = {
            transform: vi.fn((x: number, y: number) => ({ x: x * 2, y: y * 2 }))
        };

        // Mock the world transformer factory
        mockWorldTransformerFactory = {
            createTransformer: vi.fn().mockReturnValue(mockWorldTransformer)
        };

        // Mock the scrying orb
        mockScryingOrb = {
            scry: vi.fn()
        };

        // Mock camera
        mockCamera = {
            captureFrame: vi.fn(),
            stream: vi.fn(),
            destroy: vi.fn()
        };

        scryForge = new ScryForge(mockScryingOrb, mockWorldTransformerFactory);
        scryForge.setCamera(mockCamera);
    });

    describe('updateActorCategory', () => {
        it('should update actor category', () => {
            const actorId = 'test-actor-1';
            const category = Category.RED;

            scryForge.updateActorCategory(actorId, category);
            const trackedActor = scryForge.getTrackedActor(actorId);

            expect(trackedActor).toBeDefined();
            expect(trackedActor?.category).toBe(category);
        });

        it('should handle multiple actors', () => {
            scryForge.updateActorCategory('actor1', Category.RED);
            scryForge.updateActorCategory('actor2', Category.BLUE);

            expect(scryForge.getTrackedActor('actor1')?.category).toBe(Category.RED);
            expect(scryForge.getTrackedActor('actor2')?.category).toBe(Category.BLUE);
        });
    });

    describe('scry()', () => {
        it('should throw error if camera is not set', async () => {
            scryForge.setCamera(null as unknown as Camera);
            const corners = [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 }
            ];

            await expect(scryForge.scry(corners)).rejects.toThrow('Camera not set');
        });

        it('should return empty array if no markers are detected', async () => {
            const mockScryData: ScryData = {
                categoryPositions: [],
                markersPoints: []
            };
            (mockScryingOrb.scry as any).mockResolvedValue(mockScryData);

            const corners = [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 }
            ];

            const result = await scryForge.scry(corners);
            expect(result).toEqual([]);
        });

        it('should transform and return positions for tracked actors', async () => {
            // Set up tracked actors
            scryForge.updateActorCategory('actor1', Category.RED);
            scryForge.updateActorCategory('actor2', Category.BLUE);

            const mockScryData: ScryData = {
                categoryPositions: [
                    {
                        category: Category.RED,
                        x: 50,
                        y: 50,
                        width: 10,
                        height: 10
                    },
                    {
                        category: Category.BLUE,
                        x: 75,
                        y: 75,
                        width: 10,
                        height: 10
                    },
                    {
                        category: Category.GREEN, // Untracked category
                        x: 25,
                        y: 25,
                        width: 10,
                        height: 10
                    }
                ],
                markersPoints: [
                    { x: 0, y: 0 },
                    { x: 100, y: 0 },
                    { x: 100, y: 100 },
                    { x: 0, y: 100 }
                ]
            };
            (mockScryingOrb.scry as any).mockResolvedValue(mockScryData);

            const corners = [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 }
            ];

            const result = await scryForge.scry(corners);

            // Verify transformer was created with correct points
            expect(mockWorldTransformerFactory.createTransformer).toHaveBeenCalledWith(
                mockScryData.markersPoints,
                corners
            );

            // Verify positions were transformed
            expect(mockWorldTransformer.transform).toHaveBeenCalledWith(50, 50);
            expect(mockWorldTransformer.transform).toHaveBeenCalledWith(75, 75);

            // Verify final result
            expect(result).toEqual([
                { actorId: 'actor1', x: 100, y: 100 }, // 50 * 2, 50 * 2
                { actorId: 'actor2', x: 150, y: 150 }  // 75 * 2, 75 * 2
            ]);
        });

        it('should handle edge cases in marker positions', async () => {
            scryForge.updateActorCategory('actor1', Category.RED);

            const mockScryData: ScryData = {
                categoryPositions: [
                    {
                        category: Category.RED,
                        x: 0,
                        y: 0,
                        width: 10,
                        height: 10
                    }
                ],
                markersPoints: [
                    { x: -100, y: -100 },
                    { x: 100, y: -100 },
                    { x: 100, y: 100 },
                    { x: -100, y: 100 }
                ]
            };
            (mockScryingOrb.scry as any).mockResolvedValue(mockScryData);

            const corners = [
                { x: 0, y: 0 },
                { x: 1000, y: 0 },
                { x: 1000, y: 1000 },
                { x: 0, y: 1000 }
            ];

            const result = await scryForge.scry(corners);
            expect(result).toHaveLength(1);
            expect(result[0].actorId).toBe('actor1');
        });

        it('should handle scrying orb errors gracefully', async () => {
            (mockScryingOrb.scry as any).mockRejectedValue(new Error('Scrying failed'));

            const corners = [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 }
            ];

            await expect(scryForge.scry(corners)).rejects.toThrow('Scrying failed');
        });
    });

    // Add more test suites here for other ScryForge methods
}); 