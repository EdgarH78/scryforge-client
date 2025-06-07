import { MockCamera, SimpleCamera } from "./camera";
import { Camera } from "./types";

export class CameraSelectorApp extends Application {
    private stream: MediaStream | null = null;
    private videoEl!: HTMLVideoElement;
    private onCameraSelectedCallback: ((camera: Camera) => void) | null = null;
    private deviceId: string = "";

    private static _instance: CameraSelectorApp | null = null;

    static instance(): CameraSelectorApp {
      if (!this._instance) this._instance = new CameraSelectorApp();
      return this._instance;
    }

    static get defaultOptions() {
      return {
        ...super.defaultOptions,
        id: "camera-selector",
        title: "Scryforge Camera",
        template: "modules/scryforge/templates/camera-selector.html",
        width: 600,
        height: "auto" as "auto",
        resizable: true
      };
    }
    
  
    async getData() {
      await this.unlockCameraPermissions(); // prompt permission
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        cameras: devices.filter(d => d.kind === "videoinput")
      };
    }

    async unlockCameraPermissions(): Promise<void> {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
    }    
  
    activateListeners(html: JQuery) {
        super.activateListeners(html);
      
        const select = html.find("#camera-select");
        const videoContainer = html.find("#video-preview")[0];
        const confirmBtn = html.find("#confirm-camera");
      
        this.videoEl = document.createElement("video");
        this.videoEl.autoplay = true;
        this.videoEl.playsInline = true;
        this.videoEl.style.width = "100%";
        videoContainer.appendChild(this.videoEl);
      
        select.on("change", async (e) => {
          const deviceId = (e.target as HTMLSelectElement).value;
          if (deviceId) {
            await this.startStream(deviceId); // live preview
            this.deviceId = deviceId;
          }
        });
      
        confirmBtn.on("click", () => {
          if (this.deviceId && this.onCameraSelectedCallback) {
            const camera = new SimpleCamera(this.deviceId);
            this.onCameraSelectedCallback(camera);
          }
        });
      
        const firstDeviceId = select.find("option").first().val() as string;
        if (firstDeviceId) {
          select.val(firstDeviceId).trigger("change");
        }
      }
      
      

      onCameraSelected(callback: (camera: Camera) => void) {
        this.onCameraSelectedCallback = callback;
      }
      
  
    async startStream(deviceId: string) {
      if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
      }
  
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } }
      });
  
      this.videoEl.srcObject = this.stream;
      await this.videoEl.play();
    }
  
    close(options = {}) {
      if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
      }
      return super.close(options);
    }
  }
  