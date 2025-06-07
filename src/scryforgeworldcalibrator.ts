// ScryforgeWorldCalibrator.ts
// TypeScript class for calibrating screen-space ArUco marker corners to world-space coordinates

import * as math from 'mathjs';
import { Point, WorldCoordinateTransformer } from './types';



export class WorldTransformerFactory implements WorldTransformerFactory {
  createTransformer(screenPoints: Point[], worldPoints: Point[]): WorldCoordinateTransformer {
    return new ScryforgeWorldCoordinateTransformer(screenPoints, worldPoints);
  }
}

export class ScryforgeWorldCoordinateTransformer implements WorldCoordinateTransformer {
  private homography: number[] | null = null;

  constructor(screenPoints: Point[], worldPoints: Point[]) {
    if (screenPoints.length !== 4 || worldPoints.length !== 4) {
      throw new Error("Calibration requires exactly 4 points");
    }

    this.homography = this.computeHomography(screenPoints, worldPoints);
  }

  /**
   * Applies the homography to convert screen to world coordinates
   * @param x - screen-space x
   * @param y - screen-space y
   * @returns world-space coordinate
   */
  transform(x: number, y: number): Point {
    if (!this.homography) throw new Error("Not calibrated yet");

    const [h11, h12, h13, h21, h22, h23, h31, h32, h33] = this.homography;
    const denom = h31 * x + h32 * y + h33;
    const xw = (h11 * x + h12 * y + h13) / denom;
    const yw = (h21 * x + h22 * y + h23) / denom;
    return { x: xw, y: yw };
  }

  /**
   * Computes the homography matrix H such that: H * screenPoint = worldPoint
   * @param screenPoints - 4 screen-space points
   * @param worldPoints - 4 corresponding world-space points
   * @returns Flattened 3x3 homography matrix as a 9-element array
   */
  private computeHomography(screenPoints: Point[], worldPoints: Point[]): number[] {
    const A: number[][] = [];
    const b: number[] = [];

    for (let i = 0; i < 4; i++) {
      const { x: x, y: y } = screenPoints[i];
      const { x: u, y: v } = worldPoints[i];

      A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
      A.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
      b.push(u, v);
    }

    // Use math.js or similar to solve the linear system A * h = b
    // h will be 8 elements, we append h33 = 1 manually
    // For now we assume math.lusolve is available globally
    const AT = math.transpose(A);
    const ATA = math.multiply(AT, A) as number[][];
    const ATb = math.multiply(AT, b) as number[];
    const h = (math.lusolve(ATA, ATb) as number[][]).flat();

    return [...h, 1];
  }
}
