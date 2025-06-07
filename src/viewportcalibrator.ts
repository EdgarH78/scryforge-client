import { ViewPortCalibrator, Calibration, ScryForgeServer, CalibrationResult, CalibrationStatus, ScryforgeMarkers, Camera, markersToPoints } from './types';
import { average, sleep, clamp } from './utils';

export interface ViewPort {
    x: number;
    y: number;
    width: number;
    height: number;
}


export class SimpleViewPortCalibrator implements ViewPortCalibrator {
    constructor(private server: ScryForgeServer) {}

    begin(camera: Camera): AsyncGenerator<CalibrationResult> {
        return new Iterator(this.server, camera);
    }
}

class Iterator implements AsyncGenerator<CalibrationResult> {
    private lastCalibrationResult: CalibrationResult | null = null;
    private sucessCaseFound = false;
    
    //  start with the full screen
    private knownMax: Calibration = {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        markers: null
    };

    //  start in the center of the screen, this is the smallest it can be
    private knownMin: Calibration = {
        x: .5,
        y: .5,
        width: 0,
        height: 0,
        markers: null
    };

    constructor(private server: ScryForgeServer, private camera: Camera) {}

    public async calibrate(): Promise<CalibrationResult> {
        if (!this.lastCalibrationResult) {
            this.lastCalibrationResult = {
                status: CalibrationStatus.CALIBRATING,
                calibration: {
                    x: 0.05,
                    y: 0.05,
                    width: 0.8,
                    height: 0.8,
                    markers: null
                },                
            };
            return this.lastCalibrationResult;
        }
        
        try {         
            const maxAttempts = 10;
            let calibrationStatus = CalibrationStatus.CALIBRATING;
            let markers: ScryforgeMarkers | null = null;
            for (let i = 0; i < maxAttempts; i++) {
                const image = await this.camera.captureFrame();
                const result = await this.server.getArucoLocations(image);
                if (result) {
                    markers = result;
                    calibrationStatus = CalibrationStatus.CALIBRATED;
                    this.lastCalibrationResult.calibration.markers = markersToPoints(markers);
                    break;
                }
                await sleep(500);
            }

            this.lastCalibrationResult = this.binarySearchCalibration(calibrationStatus);
            return this.lastCalibrationResult;
        } catch (error) {
            this.lastCalibrationResult = {
                status: CalibrationStatus.FAILED,
                calibration: this.lastCalibrationResult.calibration
            };
            return this.lastCalibrationResult;
        }
    }

    private binarySearchCalibration(calibrationStatus: CalibrationStatus): CalibrationResult {
        if (!this.lastCalibrationResult) {
            return {
                status: CalibrationStatus.FAILED,
                calibration: this.knownMin
            };
        }

        const TOLERANCE = 0.10;
        if (calibrationStatus === CalibrationStatus.CALIBRATED) {
            this.sucessCaseFound = true;
            console.log("Calibrated", this.lastCalibrationResult.calibration);
            // Check if the newly calibrated region is meaningfully smaller than our known max
            if ((this.knownMax.width - this.lastCalibrationResult.calibration.width) > TOLERANCE &&
                (this.knownMax.height - this.lastCalibrationResult.calibration.height) > TOLERANCE) {
                // Go bigger
                console.log("Go bigger", this.lastCalibrationResult.calibration);
                this.knownMin = this.lastCalibrationResult.calibration;
                return {
                    status: CalibrationStatus.CALIBRATING,
                    calibration: {
                        x: clamp(average(this.lastCalibrationResult.calibration.x, this.knownMax.x), 0, 1),
                        y: clamp(average(this.lastCalibrationResult.calibration.y, this.knownMax.y), 0, 1),
                        width: clamp(average(this.lastCalibrationResult.calibration.width, this.knownMax.width), 0, 1),
                        height: clamp(average(this.lastCalibrationResult.calibration.height, this.knownMax.height), 0, 1),
                        markers: null
                    }
                };
            }
            console.log("We're close enough to the largest miss");
            const PADDING = 0.05;
            return {
                status: CalibrationStatus.CALIBRATED,
                // bring the tokens in 5 percent of the screen
                calibration: {
                    x: clamp(this.lastCalibrationResult.calibration.x + PADDING, 0, 1),
                    y: clamp(this.lastCalibrationResult.calibration.y + PADDING, 0, 1),
                    width: clamp(this.lastCalibrationResult.calibration.width - (4  * PADDING), 0, 1),
                    height: clamp(this.lastCalibrationResult.calibration.height - (4 * PADDING), 0, 1),
                    markers: null
                }
            };
        }

        this.knownMax = this.lastCalibrationResult.calibration;
        if ((this.lastCalibrationResult.calibration.width - this.knownMin.width) > TOLERANCE &&
            (this.lastCalibrationResult.calibration.height - this.knownMin.height) > TOLERANCE) {
            // go smaller
            console.log("Go smaller", this.lastCalibrationResult.calibration);
            return {
                status: CalibrationStatus.CALIBRATING,
                calibration: {
                    x: clamp(average(this.lastCalibrationResult.calibration.x, this.knownMin.x), 0, 1),
                    y: clamp(average(this.lastCalibrationResult.calibration.y, this.knownMin.y), 0, 1),
                    width: clamp(average(this.lastCalibrationResult.calibration.width, this.knownMin.width), 0, 1),
                    height: clamp(average(this.lastCalibrationResult.calibration.height, this.knownMin.height), 0, 1),
                    markers: null
                }
            };
        }
        
        if (this.sucessCaseFound) {

            return {
                status: CalibrationStatus.CALIBRATED,
                calibration: this.knownMin
            };
        }
        
        return {
            status: CalibrationStatus.FAILED,
            calibration: this.knownMin
        };
    }

    [Symbol.asyncIterator]() {
        return this;
    }

    async next(): Promise<IteratorResult<CalibrationResult>> {
        const last_status = this.lastCalibrationResult?.status ?? CalibrationStatus.CALIBRATING;
        const result = await this.calibrate();
        return {
            value: result,
            done: last_status !== CalibrationStatus.CALIBRATING
        };
    }

    async return(): Promise<IteratorResult<CalibrationResult>> {
        return { value: null, done: true };
    }

    async throw(error: any): Promise<IteratorResult<CalibrationResult>> {
        throw error;
    }
}