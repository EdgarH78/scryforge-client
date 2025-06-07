import { ViewPortCalibrator, Calibration, ScryForgeServer, CalibrationResult, CalibrationStatus, ScryforgeMarkers, Camera, markersToPoints, Point } from './types';
import { sleep, clamp } from './utils';

interface CartesianPoint {
    x: number;  // 0-100 range
    y: number;  // 0-100 range
}

// Define which markers make up each pair
type MarkerPair = ['top_left' | 'top_right' | 'bottom_left' | 'bottom_right', 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right'];

interface TokenPair {
    first: CartesianPoint;
    second: CartesianPoint;
    markers: MarkerPair;  // which markers make up this pair
}

interface CalibrationState {
    status: CalibrationStatus;
    center: CartesianPoint;
    width: number;   // in cartesian units (0-100)
    height: number;  // in cartesian units (0-100)
}

interface CartesianState {
    center: {
        x: number;
        y: number;
    };
    width: number;
    height: number;
}

export class AdvancedViewPortCalibrator implements ViewPortCalibrator {
    constructor(private server: ScryForgeServer) {}

    begin(camera: Camera): AsyncGenerator<CalibrationResult> {
        return new CalibrationIterator(this.server, camera);
    }
}

class CalibrationIterator implements AsyncGenerator<CalibrationResult> {
    private stage: 'init' | 'vertical' | 'vertical_fine_tune' | 'horizontal' | 'horizontal_fine_tune' | 'done' = 'init';
    private lastResult: CalibrationResult | null = null;
    private lastSuccessfulCalibration: CartesianState | null = null;
    private expansionStep = 5; // cartesian units per step
    private readonly MIN_SIZE = 25;  // Absolute minimum size we'll allow
    private readonly BUFFER = 5;     // Buffer to pull back from maximum expansion
    private readonly FINAL_BUFFER = 5; // Larger buffer for final calibration to handle camera movement
    private stageIterationCount = 0;
    private readonly MAX_STAGE_ITERATIONS = 50; // Maximum iterations per stage before considering it stuck
    private consecutiveSuccesses = 0;
    private readonly REQUIRED_CONSECUTIVE_SUCCESSES = 10;

    // Track last seen state for each pair
    private leftPairLastSeen = false;
    private rightPairLastSeen = false;
    private topPairLastSeen = false;
    private bottomPairLastSeen = false;

    // Current state in cartesian coordinates (0-100)
    private state: CalibrationState = {
        status: CalibrationStatus.CALIBRATING,
        center: { x: 50, y: 50 },
        width: 50,
        height: 50
    };

    // Token pairs for tracking with their corresponding ArUco markers
    private leftPair: TokenPair = {
        first: { x: 25, y: 25 },
        second: { x: 25, y: 75 },
        markers: ['top_left', 'bottom_left']
    };
    private rightPair: TokenPair = {
        first: { x: 75, y: 25 },
        second: { x: 75, y: 75 },
        markers: ['top_right', 'bottom_right']
    };
    private topPair: TokenPair = {
        first: { x: 25, y: 25 },
        second: { x: 75, y: 25 },
        markers: ['top_left', 'top_right']
    };
    private bottomPair: TokenPair = {
        first: { x: 25, y: 75 },
        second: { x: 75, y: 75 },
        markers: ['bottom_left', 'bottom_right']
    };

    constructor(private server: ScryForgeServer, private camera: Camera) {}

    async next(): Promise<IteratorResult<CalibrationResult>> {
        if (this.lastResult?.status === CalibrationStatus.CALIBRATED) {
            return { value: this.lastResult, done: true };
        }
        
        const result = await this.calibrate();
        this.lastResult = result;
        return { value: result, done: false };
    }

    return(value?: any): Promise<IteratorResult<CalibrationResult>> {
        return Promise.resolve({ value, done: true });
    }

    throw(e?: any): Promise<IteratorResult<CalibrationResult>> {
        return Promise.reject(e);
    }

    [Symbol.asyncIterator](): AsyncGenerator<CalibrationResult> {
        return this;
    }

    private cartesianToCalibration(state: CalibrationState): Calibration {
        return {
            x: clamp((state.center.x - state.width/2) / 100, 0, 1),
            y: clamp((state.center.y - state.height/2) / 100, 0, 1),
            width: clamp(state.width / 100, 0, 1),
            height: clamp(state.height / 100, 0, 1),
            markers: null
        };
    }

    private updateTokenPairs(): void {
        const halfWidth = this.state.width / 2;
        const halfHeight = this.state.height / 2;
        
        this.leftPair = {
            first: { x: this.state.center.x - halfWidth, y: this.state.center.y - halfHeight },
            second: { x: this.state.center.x - halfWidth, y: this.state.center.y + halfHeight },
            markers: ['top_left', 'bottom_left']
        };
        
        this.rightPair = {
            first: { x: this.state.center.x + halfWidth, y: this.state.center.y - halfHeight },
            second: { x: this.state.center.x + halfWidth, y: this.state.center.y + halfHeight },
            markers: ['top_right', 'bottom_right']
        };

        this.topPair = {
            first: { x: this.state.center.x - halfWidth, y: this.state.center.y - halfHeight },
            second: { x: this.state.center.x + halfWidth, y: this.state.center.y - halfHeight },
            markers: ['top_left', 'top_right']
        };
        
        this.bottomPair = {
            first: { x: this.state.center.x - halfWidth, y: this.state.center.y + halfHeight },
            second: { x: this.state.center.x + halfWidth, y: this.state.center.y + halfHeight },
            markers: ['bottom_left', 'bottom_right']
        };
    }

    private async calibrate(): Promise<CalibrationResult> {
        console.log('Calibrating...', this.stage, 'iteration:', this.stageIterationCount);
        
        // Check for infinite loop
        this.stageIterationCount++;
        if (this.stageIterationCount > this.MAX_STAGE_ITERATIONS) {
            console.log('Calibration appears stuck, failing', {
                stage: this.stage,
                iterations: this.stageIterationCount,
                consecutiveSuccesses: this.consecutiveSuccesses,
                state: this.state
            });
            return {
                status: CalibrationStatus.FAILED,
                calibration: this.cartesianToCalibration(this.state)
            };
        }

        if (this.stage === 'init') {
            this.stage = 'vertical';
            this.stageIterationCount = 0;
            this.consecutiveSuccesses = 0;
            return {
                status: CalibrationStatus.CALIBRATING,
                calibration: this.cartesianToCalibration(this.state)
            };
        }

        try {
            const markers = await this.captureAndDetectMarkers();

            // Check if we see all markers
            if (markers.top_left && markers.top_right && 
                markers.bottom_left && markers.bottom_right) {
                this.lastSuccessfulCalibration = this.state;
            }

            switch (this.stage) {
                case 'vertical':
                    if (this.processVerticalExpansion(markers)) {
                        this.stage = 'vertical_fine_tune';
                        this.stageIterationCount = 0;
                        this.consecutiveSuccesses = 0;
                    }
                    break;
                case 'vertical_fine_tune':
                    if (this.processFineTuning(markers)) {
                        this.stage = 'horizontal';
                        this.stageIterationCount = 0;
                        this.consecutiveSuccesses = 0;
                    }
                    break;
                case 'horizontal':
                    if (this.processHorizontalExpansion(markers)) {
                        this.stage = 'horizontal_fine_tune';
                        this.stageIterationCount = 0;
                        this.consecutiveSuccesses = 0;
                    }
                    break;
                case 'horizontal_fine_tune':
                    if (this.processFineTuning(markers)) {
                        this.stage = 'done';
                        return {
                            status: CalibrationStatus.CALIBRATED,
                            calibration: this.cartesianToCalibration(this.state)
                        };
                    }
                    break;
            }

            return {
                status: CalibrationStatus.CALIBRATING,
                calibration: this.cartesianToCalibration(this.state)
            };

        } catch (error) {
            console.error('Calibration error:', error);
            return {
                status: CalibrationStatus.FAILED,
                calibration: this.cartesianToCalibration(this.state)
            };
        }
    }

    private async captureAndDetectMarkers(): Promise<ScryforgeMarkers> {
        const image = await this.camera.captureFrame();
        const result = await this.server.getArucoLocations(image);
        return result;
    }

    private isPairVisible(markers: ScryforgeMarkers, pair: TokenPair): boolean {
        const [first, second] = pair.markers;
        return markers[first] !== undefined && markers[second] !== undefined;
    }

    private processVerticalExpansion(markers: ScryforgeMarkers): boolean {
        console.log('Processing vertical expansion:', {
            width: this.state.width,
            center: this.state.center,
            leftVisible: this.isPairVisible(markers, this.leftPair),
            rightVisible: this.isPairVisible(markers, this.rightPair),
            leftLastSeen: this.leftPairLastSeen,
            rightLastSeen: this.rightPairLastSeen
        });

        const leftVisible = this.isPairVisible(markers, this.leftPair);
        const rightVisible = this.isPairVisible(markers, this.rightPair);

        const leftLost = !leftVisible && this.leftPairLastSeen;
        const rightLost = !rightVisible && this.rightPairLastSeen;

        this.leftPairLastSeen = leftVisible;
        this.rightPairLastSeen = rightVisible;

        if (leftLost || rightLost) {
            const widthAdjustment = this.expansionStep;
            const newWidth = Math.max(this.MIN_SIZE, this.state.width - widthAdjustment);
            
            if (leftLost && !rightLost) {
                // Move center right by half the expansion step
                this.state.center.x += this.expansionStep;
                this.state.width = newWidth;
            } else if (rightLost && !leftLost) {
                // Move center left by half the expansion step
                this.state.center.x -= this.expansionStep;
                this.state.width = newWidth;
            } else {
                this.state = {
                    ...this.state,
                    width: this.state.width - this.BUFFER
                }
                this.updateTokenPairs();
                return true;                             
            }

            this.updateTokenPairs();
            return false;
        }

        if (leftVisible && rightVisible) {
            const oldWidth = this.state.width;
            this.state.width = Math.min(90, this.state.width + this.expansionStep);
            
            // If width didn't change, we've hit the maximum
            if (oldWidth === this.state.width) {
                console.log('Vertical expansion complete - hit maximum width');
                this.state.width -= this.BUFFER;
                this.updateTokenPairs();
                return true;
            }
            
            this.updateTokenPairs();
            
            // If we've reached maximum expansion, pull back by buffer
            if (this.state.width >= 85) {
                this.state.width -= this.BUFFER;
                this.updateTokenPairs();
                return true;
            }
        }

        return false;
    }

    private processHorizontalExpansion(markers: ScryforgeMarkers): boolean {
        const topVisible = this.isPairVisible(markers, this.topPair);
        const bottomVisible = this.isPairVisible(markers, this.bottomPair);

        const topLost = !topVisible && this.topPairLastSeen;
        const bottomLost = !bottomVisible && this.bottomPairLastSeen;

        this.topPairLastSeen = topVisible;
        this.bottomPairLastSeen = bottomVisible;

        if (topLost || bottomLost) {
            const heightAdjustment = this.expansionStep;
            const newHeight = Math.max(this.MIN_SIZE, this.state.height - heightAdjustment);
            
            if (topLost && !bottomLost) {
                // Move center down by half the expansion step
                this.state.center.y += this.expansionStep;
                this.state.height = newHeight;
            } else if (bottomLost && !topLost) {
                // Move center up by half the expansion step
                this.state.center.y -= this.expansionStep;
                this.state.height = newHeight;
            } else {
                this.state = {
                    ...this.state,
                    height: this.state.height - this.BUFFER
                }
                this.updateTokenPairs();
                return true;
            }            

            return false;
        }

        if (topVisible && bottomVisible) {
            this.state.height = Math.min(90, this.state.height + this.expansionStep);
            this.updateTokenPairs();
            
            // If we've reached maximum expansion, pull back by buffer
            if (this.state.height >= 85) {
                this.state.height -= this.BUFFER;
                this.updateTokenPairs();
                return true;
            }
        }

        return false;
    }

    private processFineTuning(markers: ScryforgeMarkers): boolean {
        console.log('Fine tuning - checking marker visibility:', {
            stage: this.stage,
            topLeft: !!markers.top_left,
            topRight: !!markers.top_right,
            bottomLeft: !!markers.bottom_left,
            bottomRight: !!markers.bottom_right,
            width: this.state.width,
            height: this.state.height,
            consecutiveSuccesses: this.consecutiveSuccesses
        });

        // If any marker is missing, contract both dimensions slightly
        if (!markers.top_left || !markers.top_right || 
            !markers.bottom_left || !markers.bottom_right) {
            
            console.log('Fine tuning - missing markers, contracting and resetting consecutive successes');
            this.consecutiveSuccesses = 0;
            
            // Only adjust the dimension we're currently working on
            if (this.stage === 'vertical_fine_tune') {
                this.state = {
                    ...this.state,
                    width: Math.max(this.MIN_SIZE, this.state.width - this.BUFFER)
                };
            } else if (this.stage === 'horizontal_fine_tune') {
                this.state = {
                    ...this.state,
                    height: Math.max(this.MIN_SIZE, this.state.height - this.BUFFER)
                };
            }
            
            this.updateTokenPairs();
            return false;
        }

        // Increment consecutive successes when all markers are visible
        this.consecutiveSuccesses++;
        console.log(`Fine tuning - all markers visible, consecutive successes: ${this.consecutiveSuccesses}`);

        // If we've seen all markers in their current positions enough consecutive times,
        // we can consider the calibration stable
        if (this.consecutiveSuccesses >= this.REQUIRED_CONSECUTIVE_SUCCESSES) {
            console.log('Fine tuning complete - stable configuration found after required consecutive successes');
            // Only apply final buffer on the last fine-tuning stage
            if (this.stage === 'horizontal_fine_tune') {
                this.state = {
                    ...this.state,
                    width: Math.max(this.MIN_SIZE, this.state.width - this.FINAL_BUFFER),
                    height: Math.max(this.MIN_SIZE, this.state.height - this.FINAL_BUFFER)
                };
            }
            this.updateTokenPairs();
            return true;
        }

        return false;
    }
} 