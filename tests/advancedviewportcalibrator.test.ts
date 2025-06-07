import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdvancedViewPortCalibrator } from '../src/advancedviewportcalibrator';
import { ScryForgeServer, Camera, CalibrationStatus, ScryforgeMarkers } from '../src/types';

describe('AdvancedViewPortCalibrator', () => {
    let mockServer: ScryForgeServer;
    let calibrator: AdvancedViewPortCalibrator;
    let mockCamera: Camera;

    beforeEach(() => {
        // Mock the server
        mockServer = {
            getArucoLocations: vi.fn<[Blob], Promise<ScryforgeMarkers>>(),
            getCategoryPositions: vi.fn()
        };

        // Mock camera
        mockCamera = {
            captureFrame: vi.fn(),
            stream: vi.fn(),
            destroy: vi.fn()
        };

        calibrator = new AdvancedViewPortCalibrator(mockServer);
    });

    describe('begin()', () => {
        it('should start in CALIBRATING state', async () => {
            const iterator = calibrator.begin(mockCamera);
            const result = await iterator.next();
            
            expect(result.done).toBe(false);
            expect(result.value.status).toBe(CalibrationStatus.CALIBRATING);
            expect(result.value.calibration).toBeDefined();
        });

        it('should handle successful marker detection', async () => {
            const mockMarkers: ScryforgeMarkers = {
                top_left: [0, 0],
                top_right: [100, 0],
                bottom_left: [0, 100],
                bottom_right: [100, 100]
            };

            (mockServer.getArucoLocations as any).mockResolvedValue(mockMarkers);
            
            const iterator = calibrator.begin(mockCamera);
            
            // Initial state
            let result = await iterator.next();
            expect(result.value.status).toBe(CalibrationStatus.CALIBRATING);
            
            // Should eventually reach CALIBRATED state after multiple iterations
            let iterations = 0;
            const MAX_ITERATIONS = 100;
            
            while (iterations < MAX_ITERATIONS && result.value.status === CalibrationStatus.CALIBRATING) {
                result = await iterator.next();
                iterations++;
            }
            
            expect(result.value.status).toBe(CalibrationStatus.CALIBRATED);
            expect(result.value.calibration).toBeDefined();
            expect(result.value.calibration.x).toBeGreaterThanOrEqual(0);
            expect(result.value.calibration.y).toBeGreaterThanOrEqual(0);
            expect(result.value.calibration.width).toBeLessThanOrEqual(1);
            expect(result.value.calibration.height).toBeLessThanOrEqual(1);
        });

        it('should handle failed marker detection', async () => {
            // Mock missing markers
            const mockMarkers: ScryforgeMarkers = {
                top_left: [0, 0],
                top_right: undefined as unknown as [number, number],
                bottom_left: undefined as unknown as [number, number],
                bottom_right: undefined as unknown as [number, number]
            };

            (mockServer.getArucoLocations as any).mockResolvedValue(mockMarkers);
            
            const iterator = calibrator.begin(mockCamera);
            
            // Initial state
            let result = await iterator.next();
            expect(result.value.status).toBe(CalibrationStatus.CALIBRATING);
            
            // Should eventually reach FAILED state after max iterations
            let iterations = 0;
            const MAX_ITERATIONS = 100;
            
            while (iterations < MAX_ITERATIONS && result.value.status === CalibrationStatus.CALIBRATING) {
                result = await iterator.next();
                iterations++;
            }
            
            expect(result.value.status).toBe(CalibrationStatus.FAILED);
        });

        it('should handle server errors gracefully', async () => {
            (mockServer.getArucoLocations as any).mockRejectedValue(new Error('Server error'));
            
            const iterator = calibrator.begin(mockCamera);
            
            // Initial state
            let result = await iterator.next();
            expect(result.value.status).toBe(CalibrationStatus.CALIBRATING);
            
            // Should reach FAILED state after error
            result = await iterator.next();
            expect(result.value.status).toBe(CalibrationStatus.FAILED);
        });

        it('should handle calibration stages correctly', async () => {
            // Mock markers for vertical expansion
            const verticalMarkers: ScryforgeMarkers = {
                top_left: [0, 0],
                top_right: [100, 0],
                bottom_left: [0, 50],
                bottom_right: [100, 50]
            };

            // Mock markers for horizontal expansion
            const horizontalMarkers: ScryforgeMarkers = {
                top_left: [0, 0],
                top_right: [50, 0],
                bottom_left: [0, 100],
                bottom_right: [50, 100]
            };

            // Mock markers for fine tuning
            const finalMarkers: ScryforgeMarkers = {
                top_left: [0, 0],
                top_right: [100, 0],
                bottom_left: [0, 100],
                bottom_right: [100, 100]
            };

            let stage = 0;
            (mockServer.getArucoLocations as any).mockImplementation(() => {
                stage++;
                if (stage <= 10) return Promise.resolve(verticalMarkers);
                if (stage <= 20) return Promise.resolve(horizontalMarkers);
                return Promise.resolve(finalMarkers);
            });

            const iterator = calibrator.begin(mockCamera);
            let result = await iterator.next();
            
            // Run through calibration stages
            let iterations = 0;
            const MAX_ITERATIONS = 100;
            
            while (iterations < MAX_ITERATIONS && result.value.status === CalibrationStatus.CALIBRATING) {
                result = await iterator.next();
                iterations++;
            }

            expect(result.value.status).toBe(CalibrationStatus.CALIBRATED);
            expect(stage).toBeGreaterThan(20); // Should have gone through all stages
        });

        it('should handle edge case marker positions', async () => {
            // Test extreme marker positions
            const edgeMarkers: ScryforgeMarkers = {
                top_left: [0, 0],
                top_right: [1000, 0],
                bottom_left: [0, 1000],
                bottom_right: [1000, 1000]
            };

            (mockServer.getArucoLocations as any).mockResolvedValue(edgeMarkers);
            
            const iterator = calibrator.begin(mockCamera);
            let result = await iterator.next();
            
            let iterations = 0;
            const MAX_ITERATIONS = 100;
            
            while (iterations < MAX_ITERATIONS && result.value.status === CalibrationStatus.CALIBRATING) {
                result = await iterator.next();
                iterations++;
            }

            expect(result.value.status).toBe(CalibrationStatus.CALIBRATED);
            expect(result.value.calibration.width).toBeLessThanOrEqual(1);
            expect(result.value.calibration.height).toBeLessThanOrEqual(1);
        });

        it('should handle return and throw methods', async () => {
            const iterator = calibrator.begin(mockCamera);
            
            // Test return method
            const returnResult = await iterator.return('test');
            expect(returnResult.done).toBe(true);
            expect(returnResult.value).toBe('test');
            
            // Test throw method
            const error = new Error('Test error');
            await expect(iterator.throw(error)).rejects.toThrow('Test error');
        });

        it('should handle marker loss during vertical expansion', async () => {
            let iteration = 0;
            (mockServer.getArucoLocations as any).mockImplementation(() => {
                iteration++;
                if (iteration === 1) return Promise.resolve({
                    top_left: [0, 0],
                    top_right: [100, 0],
                    bottom_left: [0, 100],
                    bottom_right: [100, 100]
                });
                if (iteration === 2) return Promise.resolve({
                    top_left: [0, 0],
                    bottom_left: [0, 100],
                    // Right markers lost
                    top_right: undefined as unknown as [number, number],
                    bottom_right: undefined as unknown as [number, number]
                });
                return Promise.resolve({
                    top_left: [0, 0],
                    top_right: [100, 0],
                    bottom_left: [0, 100],
                    bottom_right: [100, 100]
                });
            });

            const iterator = calibrator.begin(mockCamera);
            let result = await iterator.next();
            expect(result.value.status).toBe(CalibrationStatus.CALIBRATING);

            // Run a few iterations to test marker loss handling
            result = await iterator.next();
            expect(result.value.status).toBe(CalibrationStatus.CALIBRATING);
            expect(result.value.calibration.width).toBeLessThan(1);
        });

        it('should handle marker loss during horizontal expansion', async () => {
            let iteration = 0;
            (mockServer.getArucoLocations as any).mockImplementation(() => {
                iteration++;
                if (iteration === 1) return Promise.resolve({
                    top_left: [0, 0],
                    top_right: [100, 0],
                    bottom_left: [0, 100],
                    bottom_right: [100, 100]
                });
                if (iteration === 2) return Promise.resolve({
                    top_left: [0, 0],
                    top_right: [100, 0],
                    // Bottom markers lost
                    bottom_left: undefined as unknown as [number, number],
                    bottom_right: undefined as unknown as [number, number]
                });
                return Promise.resolve({
                    top_left: [0, 0],
                    top_right: [100, 0],
                    bottom_left: [0, 100],
                    bottom_right: [100, 100]
                });
            });

            const iterator = calibrator.begin(mockCamera);
            let result = await iterator.next();
            expect(result.value.status).toBe(CalibrationStatus.CALIBRATING);

            // Run a few iterations to test marker loss handling
            result = await iterator.next();
            expect(result.value.status).toBe(CalibrationStatus.CALIBRATING);
            expect(result.value.calibration.height).toBeLessThan(1);
        });

        it('should handle fine tuning adjustments', async () => {
            let iteration = 0;
            (mockServer.getArucoLocations as any).mockImplementation(() => {
                iteration++;
                // Start with all markers visible
                if (iteration <= 5) return Promise.resolve({
                    top_left: [0, 0],
                    top_right: [100, 0],
                    bottom_left: [0, 100],
                    bottom_right: [100, 100]
                });
                // Then lose one marker temporarily
                if (iteration === 6) return Promise.resolve({
                    top_left: undefined as unknown as [number, number],
                    top_right: [100, 0],
                    bottom_left: [0, 100],
                    bottom_right: [100, 100]
                });
                // Then all markers visible again for consecutive successes
                return Promise.resolve({
                    top_left: [0, 0],
                    top_right: [100, 0],
                    bottom_left: [0, 100],
                    bottom_right: [100, 100]
                });
            });

            const iterator = calibrator.begin(mockCamera);
            let result = await iterator.next();
            expect(result.value.status).toBe(CalibrationStatus.CALIBRATING);

            // Run iterations until we reach CALIBRATED state
            let iterations = 0;
            const MAX_ITERATIONS = 100;
            
            while (iterations < MAX_ITERATIONS && result.value.status === CalibrationStatus.CALIBRATING) {
                result = await iterator.next();
                iterations++;
            }

            expect(result.value.status).toBe(CalibrationStatus.CALIBRATED);
            expect(iterations).toBeGreaterThan(10); // Should have gone through fine tuning
        });

        it('should handle maximum expansion limits', async () => {
            // Always return visible markers to test maximum expansion
            (mockServer.getArucoLocations as any).mockResolvedValue({
                top_left: [0, 0],
                top_right: [100, 0],
                bottom_left: [0, 100],
                bottom_right: [100, 100]
            });

            const iterator = calibrator.begin(mockCamera);
            let result = await iterator.next();
            expect(result.value.status).toBe(CalibrationStatus.CALIBRATING);

            // Run iterations until we reach CALIBRATED state
            let iterations = 0;
            const MAX_ITERATIONS = 100;
            
            while (iterations < MAX_ITERATIONS && result.value.status === CalibrationStatus.CALIBRATING) {
                result = await iterator.next();
                iterations++;
            }

            expect(result.value.status).toBe(CalibrationStatus.CALIBRATED);
            expect(result.value.calibration.width).toBeLessThanOrEqual(0.9); // Max width is 90%
            expect(result.value.calibration.height).toBeLessThanOrEqual(0.9); // Max height is 90%
        });

        it('should handle maximum stage iterations', async () => {
            // Mock markers that will cause the calibration to get stuck
            const mockMarkers: ScryforgeMarkers = {
                top_left: [0, 0],
                top_right: [100, 0],
                bottom_left: undefined as unknown as [number, number],
                bottom_right: undefined as unknown as [number, number]
            };

            (mockServer.getArucoLocations as any).mockResolvedValue(mockMarkers);
            
            const iterator = calibrator.begin(mockCamera);
            let result = await iterator.next();
            
            // Run for more than MAX_STAGE_ITERATIONS
            let iterations = 0;
            const MAX_ITERATIONS = 100;
            
            while (iterations < MAX_ITERATIONS && result.value.status === CalibrationStatus.CALIBRATING) {
                result = await iterator.next();
                iterations++;
            }
            
            expect(result.value.status).toBe(CalibrationStatus.FAILED);
            expect(iterations).toBeGreaterThan(50); // MAX_STAGE_ITERATIONS is 50
        });

        it('should handle alternating marker visibility', async () => {
            let iteration = 0;
            (mockServer.getArucoLocations as any).mockImplementation(() => {
                iteration++;
                // Alternate between all markers visible and some missing
                if (iteration % 2 === 0) {
                    return Promise.resolve({
                        top_left: [0, 0],
                        top_right: [100, 0],
                        bottom_left: [0, 100],
                        bottom_right: [100, 100]
                    });
                } else {
                    return Promise.resolve({
                        top_left: [0, 0],
                        top_right: undefined as unknown as [number, number],
                        bottom_left: [0, 100],
                        bottom_right: [100, 100]
                    });
                }
            });

            const iterator = calibrator.begin(mockCamera);
            let result = await iterator.next();
            
            // Run several iterations to test recovery behavior
            let iterations = 0;
            const MAX_ITERATIONS = 20;
            
            while (iterations < MAX_ITERATIONS && result.value.status === CalibrationStatus.CALIBRATING) {
                result = await iterator.next();
                iterations++;
            }
            
            expect(result.value.status).toBe(CalibrationStatus.CALIBRATING);
            expect(result.value.calibration.width).toBeLessThan(1);
            expect(result.value.calibration.height).toBeLessThan(1);
        });

        it('should handle camera errors during calibration', async () => {
            let callCount = 0;
            (mockCamera.captureFrame as any).mockImplementation(() => {
                callCount++;
                if (callCount === 2) {
                    throw new Error('Camera error');
                }
                return Promise.resolve(new Blob());
            });

            const iterator = calibrator.begin(mockCamera);
            let result = await iterator.next();
            expect(result.value.status).toBe(CalibrationStatus.CALIBRATING);

            result = await iterator.next();
            expect(result.value.status).toBe(CalibrationStatus.FAILED);
        });

        it('should handle minimum size constraints', async () => {
            let iteration = 0;
            (mockServer.getArucoLocations as any).mockImplementation(() => {
                iteration++;
                if (iteration <= 3) {
                    // Start with all markers visible
                    return Promise.resolve({
                        top_left: [0, 0],
                        top_right: [100, 0],
                        bottom_left: [0, 100],
                        bottom_right: [100, 100]
                    });
                } else {
                    // Then lose markers to force contraction
                    return Promise.resolve({
                        top_left: undefined as unknown as [number, number],
                        top_right: undefined as unknown as [number, number],
                        bottom_left: undefined as unknown as [number, number],
                        bottom_right: undefined as unknown as [number, number]
                    });
                }
            });

            const iterator = calibrator.begin(mockCamera);
            let result = await iterator.next();
            
            // Run several iterations to test minimum size enforcement
            let iterations = 0;
            const MAX_ITERATIONS = 20;
            
            while (iterations < MAX_ITERATIONS && result.value.status === CalibrationStatus.CALIBRATING) {
                result = await iterator.next();
                iterations++;
                
                // Check that dimensions never go below minimum
                expect(result.value.calibration.width * 100).toBeGreaterThanOrEqual(25); // MIN_SIZE is 25
                expect(result.value.calibration.height * 100).toBeGreaterThanOrEqual(25);
            }
        });
    });
}); 