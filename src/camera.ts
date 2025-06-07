import { Camera } from "./types";

export class SimpleCamera implements Camera {
    private deviceId: string;
    private videoEl: HTMLVideoElement;
    private streamObj: MediaStream | null = null;
  
    constructor(deviceId: string) {
      this.deviceId = deviceId;
  
      this.videoEl = document.createElement("video");
      this.videoEl.autoplay = true;
      this.videoEl.playsInline = true;
      this.videoEl.style.display = "none";
      document.body.appendChild(this.videoEl);
    }
  
    async init(): Promise<void> {
      this.streamObj = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: this.deviceId } }
      });
  
      this.videoEl.srcObject = this.streamObj;
      await this.videoEl.play();
    }
  
    async captureFrame(): Promise<Blob> {
      if (!this.streamObj) await this.init();
  
      const canvas = document.createElement("canvas");
      canvas.width = this.videoEl.videoWidth;
      canvas.height = this.videoEl.videoHeight;
  
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get canvas context");
  
      ctx.drawImage(this.videoEl, 0, 0);
      return new Promise((resolve) =>
        canvas.toBlob((blob) => blob && resolve(blob), "image/jpeg", 0.95)
      );
    }
  
    stream(): MediaStream | null {
      return this.streamObj;
    }
  
    destroy(): void {
      this.streamObj?.getTracks().forEach(track => track.stop());
      this.videoEl.remove();
    }
  }
  
  // mock-camera.ts

export class MockCamera implements Camera {
  async captureFrame(): Promise<Blob> {
    console.log("MockCamera: captureFrame() called");
    // Return a dummy blob
    return new Blob([], { type: "image/png" });
  }

  stream(): MediaStream | null {
    console.log("MockCamera: stream() called");
    return null;
  }

  destroy(): void {
    console.log("MockCamera: destroy() called");
  }
}
