type Percentage = number;

export interface Camera {
    captureFrame(): Promise<Blob>;
    stream(): MediaStream | null;
    destroy(): void;
}

export interface TrackedActor {
    actorId: string;
    category: Category;
}

export interface ViewPortCalibrator {
    begin(camera: Camera): AsyncGenerator<CalibrationResult>    
}

export interface WorldTransformerFactory {
    createTransformer(screenPoints: Point[], worldPoints: Point[]): WorldCoordinateTransformer;
}

export interface WorldCoordinateTransformer {
    transform(x: number, y: number): Point;
}

export interface ScryingOrb{
    scry(camera: Camera): Promise<ScryData>;
}

export interface ScryForgeServer {
    getArucoLocations(image: Blob): Promise<ScryforgeMarkers>;
    getCategoryPositions(image: Blob): Promise<CategoryPosition[]>;
}

export interface ScryforgeAuthDecorator extends ScryForgeServer {
    // Inherits all methods from ScryForgeServer
}

export interface ForgeRealmAuthServer {
    getAuthStatus(token?: string): Promise<AuthStatus>;
    refreshAuth(token: string, refreshToken: string): Promise<AuthResponse>;
    tokenAuthStart(clientName?: string): Promise<string>;
    getAuthTokenStatus(token: string): Promise<TokenStatusResult>;
    isAuthenticated(token?: string): Promise<boolean>;
    forceRefreshAuthStatus(token?: string): Promise<boolean>;
}

export interface CalibrationResult {
    status: CalibrationStatus;
    calibration: Calibration;
}

export interface Calibration {
    x: Percentage;
    y: Percentage;
    width: Percentage;
    height: Percentage;
    markers: Point[] | null;
}

export interface ActorPosition {
    actorId: string;
    x: Percentage;
    y: Percentage;
}

export interface GetCategoryPositionsResponse {
    positions: CategoryPosition[];
}

export interface ScryData {
    categoryPositions: CategoryPosition[];
    markersPoints: Point[];
}

export interface CategoryPosition {
    category: Category;
    x: Percentage;
    y: Percentage;
    width: Percentage;
    height: Percentage;
}

export interface GetCalibrationStatusResponse {
    status: CalibrationStatus;
    markers?: ScryforgeMarkers;
}

export interface SetCalibrationRequest {
    markers: ScryforgeMarkers;
}

export type Point = { x: number; y: number };

export interface ScryforgeMarkers {
    bottom_left: [number, number];
    bottom_right: [number, number];
    top_left: [number, number];
    top_right: [number, number];
}

export interface Settings {
    mode: Mode;
    scryingEyeUserId: string;
}

export enum Mode {
    TRAINING = "training",
    PRODUCTION = "production"
}

export enum Category {
    RED = "red",
    BLUE = "blue",
    GREEN = "green",
    VIOLET = "violet",
    YELLOW = "yellow",
    ORANGE = "orange",
    TURQUOISE = "turquoise",
    PINK = "pink",
    WHITE = "white",
    BLACK = "black",
    LIME_GREEN_VIOLET = "lime_green_violet",
    PINK_GREEN = "pink_green",
    YELLOW_NIGHT_BLUE = "yellow_night_blue",
    LIGHT_BLUE_ORANGE = "light_blue_orange",
    BROWN_TURQUOISE = "brown_turquoise",
    GIANT_RED_OCTOPUS = "giant_red_octopus",
    TREANT = "treant",
    ANCIENT_GOLD_DRAGON = "ancient_gold_dragon",
    ANCIENT_SILVER_DRAGON = "ancient_silver_dragon",
    ANCIENT_BLUE_DRAGON = "ancient_blue_dragon",
    ANCIENT_GREEN_DRAGON = "ancient_green_dragon",
    BLUE_DRACO_LICH = "blue_dragolich",
    ANCIENT_RED_DRAGON = "ancient_red_dragon",
    ANCIENT_WHITE_DRAGON = "ancient_white_dragon",
    ANCIENT_BLACK_DRAGON = "ancient_black_dragon",
    ANCIENT_GREY_DRAGON = "ancient_grey_dragon",
    ANCIENT_PURPLE_DRAGON = "ancient_purple_dragon"
} 

export enum CalibrationStatus {
    CALIBRATED = "Calibrated",
    CALIBRATING = "Calibrating",
    FAILED = "Failed"
}

export function markersToPoints(markers: ScryforgeMarkers): Point[] {
    return [markers.top_left, markers.top_right, markers.bottom_right, markers.bottom_left]
        .filter(x => x != undefined && x != null)
        .map(x => ({ x: x[0], y: x[1] }));
}

export interface AuthStatus {
    isAuthenticated: boolean;
    lastChecked: number;
    error?: string;
    token?: string; // JWT token for Bearer authentication
}

export interface TokenStatusResult {
    fulfilled: boolean;
    token?: string; // JWT token returned after successful authentication
    refreshToken?: string; // Refresh token returned after successful authentication
}

export interface AuthResponse {
    status: string;
    message: string;
    token: string; // JWT token for authentication
    refresh_token: string; // Refresh token for token renewal
}

// Token management interface
export interface TokenVault {
    getToken(): string | null;
    getRefreshToken(): string | null;
    setKeys(token: string, refreshToken: string): void;
    clearToken(): void;
    hasToken(): boolean;
    hasRefreshToken(): boolean;
    tokensUpdated: EventTarget;
}

// Custom error classes for different HTTP status codes
export class AuthenticationError extends Error {
    constructor(message: string = 'Authentication required') {
        super(message);
        this.name = 'AuthenticationError';
    }
}

export class RateLimitError extends Error {
    constructor(message: string = 'Rate limit exceeded') {
        super(message);
        this.name = 'RateLimitError';
    }
}

export class ServiceUnavailableError extends Error {
    constructor(message: string = 'Service unavailable') {
        super(message);
        this.name = 'ServiceUnavailableError';
    }
}

export class BadRequestError extends Error {
    constructor(message: string = 'Bad request') {
        super(message);
        this.name = 'BadRequestError';
    }
}