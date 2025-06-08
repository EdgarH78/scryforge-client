/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

declare const game: {
    i18n: {
        format(stringId: string, data?: Record<string, unknown>): string;
        localize(stringId: string): string;
    };
};

/**
 * Helper function to get localized strings
 * @param key The localization key
 * @param data Optional data to format the string with
 * @returns The localized string
 */
export function localize(key: string, data?: Record<string, unknown>): string {
    const fullKey = `SCRYFORGE.${key}`;
    return data ? game.i18n.format(fullKey, data) : game.i18n.localize(fullKey);
}

/**
 * Helper function to format a category name for display
 * @param category The category enum value
 * @returns The localized category name
 */
export function formatCategory(category: string): string {
    return localize(`Categories.${category}`);
} 