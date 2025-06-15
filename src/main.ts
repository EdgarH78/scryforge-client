console.log("MAIN MODULE STARTING");
export {};
export const __forceFoundryExecution__ = true;

/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import { ScryForge } from './scryforge';
import { SimpleScryingOrb } from './scryingorb';
import { Calibration, CalibrationStatus, Camera, Category } from './types';
import { HttpScryForgeServer } from './server';
import { AdvancedViewPortCalibrator } from './advancedviewportcalibrator';
import * as PIXI from 'pixi.js';
import { CameraSelectorApp } from './cameraselector';
import { WorldTransformerFactory } from './scryforgeworldcalibrator';
import { localize, formatCategory } from './utils/i18n';

// Add type declarations for TokenDocument
declare global {
    interface TokenDocument {
        elevation: number;
        flags: {
            levels?: {
                rangeTop?: number;
            };
        };
    }
    interface Canvas {
        tiles: {
            placeables: Array<{
                document: {
                    overhead: boolean | undefined;
                    flags: {
                        levels?: {
                            rangeTop?: number;
                        };
                    };
                };
                containsPoint(point: {x: number, y: number}): boolean;
            }>;
        };
    }
}

export {};

type ApplicationHeaderButton = {
    label: string;
    class: string;
    icon: string;
    onclick: () => void;
  };

  console.log("ScryForge main.js loaded");

// Store categories and assignments
const scryForgeServer = new HttpScryForgeServer();
const scryForge = new ScryForge(new SimpleScryingOrb(scryForgeServer), new WorldTransformerFactory());
const calibrator = new AdvancedViewPortCalibrator(scryForgeServer);
const arucoScale = 0.4;


let updateInterval: NodeJS.Timeout | null = null;
let calibrationSprites: PIXI.Sprite[] = [];

function getGame(): Game {
    return game as Game;
}

function getCanvas(): Canvas {
    return canvas as Canvas;
}

Hooks.once('init', () => {
    const game = getGame();
    
    // Register module settings
    game.settings.register('scryforge', 'categoryAssignments', {
        name: 'Category Assignments',
        scope: 'world',
        config: false,
        type: Object as any,
        default: {},
        onChange: (value: Record<string, string>) => {
            Object.entries(value).forEach(([actorId, category]) => {
                scryForge.updateActorCategory(actorId, category as Category);
            });
        }
    });

    // Add display user setting
    game.settings.register('scryforge', 'displayUser', {
        name: localize('Settings.DisplayUser'),
        hint: localize('Settings.DisplayUserHint'),
        scope: 'world',
        config: true,
        type: String,
        default: ''
    });

    // Add hooks for scene/viewport changes
    Hooks.on('canvasReady', () => {
        clearCalibrationSprites();
        scryForge.setCalibration(null);
    });

    Hooks.on('canvasPan', async () => {
        const calibration = scryForge.getCalibration();
        if (calibration) {
            await displayCalibrationSprites(calibration);
        }
    });
});

// Helper function to check if current user is display user
function isDisplayUser(): boolean {
    const displayUsername = (game as Game).settings.get('scryforge', 'displayUser');
    return (getGame().user as User).name === displayUsername;
}

Hooks.once('ready', async () => {
    clearCalibrationSprites();  // Clean up any leftover sprites
    // Load saved assignments
    const game = getGame();
    const saved = game.settings.get('scryforge', 'categoryAssignments') as Record<string, string>;
    Object.entries(saved).forEach(([actorId, category]) => {
        scryForge.updateActorCategory(actorId, category as Category);
    });
    
    // Start in the correct mode if display user
    if (isDisplayUser()) {
        const cameraSelector = CameraSelectorApp.instance();
        cameraSelector.onCameraSelected((c) => {
            scryForge.setCamera(c);                     
            cameraSelector.close();
            calibrate(c);
          });
        startUpdateInterval();
    }
});

// Update other functions to check for display user instead of GM
Hooks.on('getActorSheetHeaderButtons', (sheet: ActorSheet, buttons: ApplicationHeaderButton[]) => {
    const game = getGame();
    if (game.user?.isGM) {  // Keep this as GM only for configuration
        buttons.unshift({
            label: 'Assign Category',
            icon: 'fas fa-map-marker',
            class: 'assign-category',
            onclick: () => showBaseAssignmentDialog(sheet.actor)
        });
    }
});

// Dialog for base assignment
function showBaseAssignmentDialog(actor: Actor): void {
    if (!actor.id) return;
    const trackedActor = scryForge.getTrackedActor(actor.id);
    const currentCategory = trackedActor?.category || '';
    
    // Get all possible categories from the enum
    const allCategories = Object.values(Category);
    
    const content = `
        <form>
            <div class="form-group">
                <label>${localize('Dialog.CategoryLabel')}:</label>
                <select name="category">
                    <option value="">${localize('Categories.None')}</option>
                    ${allCategories.map(category => `
                        <option value="${category}" ${currentCategory === category ? 'selected' : ''}>
                            ${formatCategory(category)}
                        </option>
                    `).join('')}
                </select>
            </div>
        </form>
    `;

    new Dialog({
        title: localize('Dialog.SelectCategory'),
        content,
        buttons: {
            assign: {
                icon: '<i class="fas fa-check"></i>',
                label: localize('CameraSelector.Assign'),
                callback: async (html: HTMLElement | JQuery<HTMLElement>) => {
                    const $html = html instanceof HTMLElement ? $(html) : html;
                    const category = $html.find('[name="category"]').val() as string;
                    
                    if (category && actor.id) {
                        scryForge.updateActorCategory(actor.id, category as Category);
                    } else if (actor.id) {
                        scryForge.removeActorCategory(actor.id);
                    }
                
                    await getGame().settings.set(
                        'scryforge', 
                        'categoryAssignments', 
                        Object.fromEntries(
                            scryForge.getTrackedActors().map(actor => [
                                actor.actorId, 
                                String(actor.category)
                            ])
                        )
                    );
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: localize('CameraSelector.Cancel')
            }
        },
        default: 'assign'
    }).render(true);
}

async function calibrate(camera: Camera): Promise<void> {
    console.log("Starting calibration...");
    const canvas = getCanvas();
    if (!canvas.scene) return;    

    const gen = calibrator.begin(camera);
    for await (const result of gen) {
        console.log("Calibration step:", result.status);

        
        if (result.status === CalibrationStatus.CALIBRATED) {
            scryForge.setCalibration(result.calibration);
            console.log('ScryForge: Calibration successful');
            await displayCalibrationSprites(result.calibration);
            break;
        }
        if (result.status === CalibrationStatus.FAILED) {
            console.error('ScryForge: Calibration failed');
            break;
        }

        if (result.status === CalibrationStatus.CALIBRATING) {
            if (!canvas.stage) return;
            await displayCalibrationSprites(result.calibration);
        }
    }
}

async function displayCalibrationSprites(calibration: Calibration): Promise<void> {
    clearCalibrationSprites();
    
    const viewport = getViewportRect();
    const canvas = getCanvas();
    if (!canvas.stage) return;
    console.log("Viewport Rect:", viewport);
    const positions = [
        { x: viewport.x + calibration.x * viewport.width, y: viewport.y + calibration.y * viewport.height, coner: "upper_left" },
        { x: viewport.x + (calibration.x + calibration.width) * viewport.width, y: viewport.y + calibration.y * viewport.height, coner: "upper_right" },
        { x: viewport.x + (calibration.x + calibration.width) * viewport.width, y: viewport.y + (calibration.y + calibration.height) * viewport.height, coner: "lower_right" },
        { x: viewport.x + calibration.x * viewport.width, y: viewport.y + (calibration.y + calibration.height) * viewport.height, coner: "lower_left" }
    ];

    const images = ['aruco_zero.png', 'aruco_one.png', 'aruco_two.png', 'aruco_three.png'];               
    calibrationSprites = positions.map((pos, i) => {                
        const sprite = PIXI.Sprite.from(`modules/scryforge/assets/${images[i]}`);
        if (pos.coner === "upper_right") {
            sprite.x = pos.x - sprite.width;
            sprite.y = pos.y;
        } else if (pos.coner === "lower_right") {
            sprite.x = pos.x - sprite.width;
            sprite.y = pos.y - sprite.height;   
        } else if (pos.coner === "lower_left") {
            sprite.x = pos.x;
            sprite.y = pos.y - sprite.height;
        } else if (pos.coner === "upper_left") {
            sprite.x = pos.x;
            sprite.y = pos.y;
        }
        if (!canvas.stage) return sprite;
        sprite.scale.set(arucoScale / canvas.stage.scale.x);
        canvas.stage.addChild(sprite);
        return sprite;
    });
    // Wait for render
    await new Promise(resolve => setTimeout(resolve, 100));
}

function clearCalibrationSprites(): void {
    const canvas = getCanvas();
    if (!canvas.stage) return;

    calibrationSprites.forEach(sprite => {
        if (sprite) {
            sprite.destroy();
            canvas.stage?.removeChild(sprite);
        }
    });
    calibrationSprites = [];
}

function startUpdateInterval(): void {
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(updateTokenPositions, 1000);
}

// Update base locations from ScryForge
async function updateTokenPositions(): Promise<void> {
    const canvas = getCanvas();
    const game = getGame();
    if (!canvas.scene) return;

    const scCamera = scryForge.getCamera();
    if (!scCamera) return;

    const calibration = scryForge.getCalibration();
    if (!calibration) {
        // Avoid breaking Foundry UI with Dialog.confirm
        if (!ui.notifications?.active.find(n => $(n).text().includes(game.i18n.localize("SCRYFORGE.Notifications.NoCalibration")))) {
            ui.notifications?.info(localize("Notifications.NoCalibration"));
        }
        return;
    }

    if (game.paused) return;
    if (!scryForge.canScry()) return;

    try {        
        // Calculate corner positions from calibration and current viewport
        const corner_points = calibrationSprites.map(sprite => {
            const width = sprite.width * sprite.scale.x;
            const height = sprite.height * sprite.scale.y;
            return {
                x: sprite.x + width / 2,
                y: sprite.y + height / 2
            }
        });
        
        const positions = await scryForge.scry(corner_points);
        for (const position of positions) {
            const actor = game.actors?.get(position.actorId);
            if (!actor) continue;

            const token = canvas.tokens?.placeables.find(t => t.actor?.id === position.actorId);
            if (!token) continue;

            await token.document.update({
                x: position.x,
                y: position.y
            });
        }
    } catch (error) {
        console.error('Error in ScryForge token positions:', error);
    }
}

function getViewportRect() {
    const canvas = getCanvas();
    if (!canvas) return { x: 0, y: 0, width: 0, height: 0 };
    if (!canvas.stage) return { x: 0, y: 0, width: 0, height: 0 };
    if (!canvas.app) return { x: 0, y: 0, width: 0, height: 0 };

    const vp = (canvas.scene?._viewPosition as any);
    if (!vp) return { x: 0, y: 0, width: 0, height: 0 };
    const width = canvas.app.renderer.view.width / vp.scale;
    const height = canvas.app.renderer.view.height / vp.scale;
    return {
        x: vp.x - width / 2,
        y: vp.y - height / 2,
        width: width,
        height: height
    };
}

Hooks.on('getSceneControlButtons', (controls: SceneControl[]) => {
    if (!isDisplayUser()) return;
  
    const scryforgeControls = {
      name: 'scryforge',
      title: localize('Controls.Title'),
      icon: 'fas fa-eye',
      layer: 'controls',
      visible: true,
      activeTool: 'calibrate',
      tools: [
        {
          name: 'calibrate',
          title: localize('Controls.Calibrate.Title'),
          icon: 'fas fa-crosshairs',
          visible: true,
          button: true,
          onClick: () => {
            const scCamera = scryForge.getCamera();
            if (!scCamera) {
              ui.notifications?.warn(localize('Controls.Calibrate.NoCamera'));
              return;
            }
            calibrate(scCamera);
          }
        },
        {
          name: 'camera',
          title: localize('Controls.Camera.Title'),
          icon: 'fas fa-video',
          visible: true,
          button: true,
          onClick: () => {
            const cameraSelector = CameraSelectorApp.instance();
            cameraSelector.render(true);
          }
        }
      ]
    };
  
    controls.push(scryforgeControls);
});




