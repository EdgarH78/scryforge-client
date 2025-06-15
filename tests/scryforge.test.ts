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

    describe('removeActorCategory', () => {
        it('should remove actor category', () => {
            // Add two actors
            scryForge.updateActorCategory('actor1', Category.RED);
            scryForge.updateActorCategory('actor2', Category.BLUE);

            // Remove one actor
            scryForge.removeActorCategory('actor1');

            // Verify actor1 was removed but actor2 remains
            expect(scryForge.getTrackedActor('actor1')).toBeUndefined();
            expect(scryForge.getTrackedActor('actor2')).toBeDefined();
        });

        it('should handle removing non-existent actor', () => {
            scryForge.updateActorCategory('actor1', Category.RED);
            scryForge.removeActorCategory('non-existent');
            expect(scryForge.getTrackedActor('actor1')).toBeDefined();
        });

        it('should handle removing actor with multiple categories', () => {
            // Add same actor with different categories
            scryForge.updateActorCategory('actor1', Category.RED);
            scryForge.updateActorCategory('actor1', Category.BLUE);
            
            scryForge.removeActorCategory('actor1');
            
            expect(scryForge.getTrackedActor('actor1')).toBeUndefined();
            expect(scryForge.getTrackedActors()).toHaveLength(0);
        });
    });

    describe('getTrackedActors', () => {
        it('should return empty array when no actors are tracked', () => {
            expect(scryForge.getTrackedActors()).toEqual([]);
        });

        it('should return all tracked actors', () => {
            scryForge.updateActorCategory('actor1', Category.RED);
            scryForge.updateActorCategory('actor2', Category.BLUE);

            const trackedActors = scryForge.getTrackedActors();
            expect(trackedActors).toHaveLength(2);
            expect(trackedActors).toEqual(
                expect.arrayContaining([
                    { actorId: 'actor1', category: Category.RED },
                    { actorId: 'actor2', category: Category.BLUE }
                ])
            );
        });
    });

    describe('getAvailableCategories', () => {
        it('should return empty array when no categories are used', () => {
            expect(scryForge.getAvailableCategories()).toEqual([]);
        });

        it('should return all used categories', () => {
            scryForge.updateActorCategory('actor1', Category.RED);
            scryForge.updateActorCategory('actor2', Category.BLUE);

            const categories = scryForge.getAvailableCategories();
            expect(categories).toHaveLength(2);
            expect(categories).toEqual(expect.arrayContaining([Category.RED, Category.BLUE]));
        });

        it('should update categories when actors are removed', () => {
            scryForge.updateActorCategory('actor1', Category.RED);
            scryForge.updateActorCategory('actor2', Category.BLUE);
            scryForge.removeActorCategory('actor1');

            const categories = scryForge.getAvailableCategories();
            expect(categories).toHaveLength(1);
            expect(categories).toEqual([Category.BLUE]);
        });
    });

    describe('canScry', () => {
        it('should return false when camera is not set', () => {
            scryForge.setCamera(null as unknown as Camera);
            expect(scryForge.canScry()).toBe(false);
        });

        it('should return true when camera is set', () => {
            expect(scryForge.canScry()).toBe(true);
        });
    });

    describe('calibration', () => {
        it('should handle setting and getting calibration', () => {
            const mockCalibration = {
                x: 10,
                y: 20,
                width: 80,
                height: 60,
                markers: [
                    { x: 0, y: 0 },
                    { x: 100, y: 0 },
                    { x: 100, y: 100 },
                    { x: 0, y: 100 }
                ]
            };

            expect(scryForge.getCalibration()).toBeNull();
            
            scryForge.setCalibration(mockCalibration);
            expect(scryForge.getCalibration()).toEqual(mockCalibration);
            
            scryForge.setCalibration(null);
            expect(scryForge.getCalibration()).toBeNull();
        });
    });

    describe('concurrent scrying', () => {
        it('should prevent concurrent scry calls by returning empty array', async () => {
            // Set up tracked actors
            scryForge.updateActorCategory('actor1', Category.RED);

            let scryCallCount = 0;
            const mockScryData: ScryData = {
                categoryPositions: [
                    {
                        category: Category.RED,
                        x: 50,
                        y: 50,
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

            // Make scry take some time to complete and track calls
            (mockScryingOrb.scry as any).mockImplementation(async () => {
                scryCallCount++;
                await new Promise(resolve => setTimeout(resolve, 100));
                return mockScryData;
            });

            const corners = [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 }
            ];

            // Start first scry call
            const firstCall = scryForge.scry(corners);
            // Immediately start second scry call
            const secondCall = scryForge.scry(corners);

            // Second call should resolve immediately with empty array
            const secondResult = await secondCall;
            expect(secondResult).toEqual([]);
            // At this point, only one call to the scrying orb should have happened
            expect(scryCallCount).toBe(1);

            // First call should complete normally
            const firstResult = await firstCall;
            expect(firstResult).toHaveLength(1);
            expect(firstResult[0].actorId).toBe('actor1');
            // Still only one call should have happened
            expect(scryCallCount).toBe(1);
        });

        it('should reset scrying state when error occurs', async () => {
            let scryCallCount = 0;
            // First call will fail
            (mockScryingOrb.scry as any).mockImplementation(async () => {
                scryCallCount++;
                throw new Error('Scrying failed');
            });

            const corners = [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 }
            ];

            // First call should throw
            await expect(scryForge.scry(corners)).rejects.toThrow('Scrying failed');
            expect(scryCallCount).toBe(1);

            // Set up success data for second call
            const mockScryData: ScryData = {
                categoryPositions: [],
                markersPoints: [
                    { x: 0, y: 0 },
                    { x: 100, y: 0 },
                    { x: 100, y: 100 },
                    { x: 0, y: 100 }
                ]
            };
            (mockScryingOrb.scry as any).mockImplementation(async () => {
                scryCallCount++;
                return mockScryData;
            });

            // Second call should succeed (not blocked by failed first call)
            const result = await scryForge.scry(corners);
            expect(result).toEqual([]);
            expect(scryCallCount).toBe(2); // Should have made a second call
        });
    });

    // Add more test suites here for other ScryForge methods
}); 