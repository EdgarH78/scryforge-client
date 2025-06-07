/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { Settings, Mode } from './types';

export class ScryForgeSettings implements Settings {
    mode: Mode;
    scryingEyeUserId: string;

    constructor(mode: Mode, scryingEyeUserId: string) {
        this.mode = mode;
        this.scryingEyeUserId = scryingEyeUserId;
    }
} 