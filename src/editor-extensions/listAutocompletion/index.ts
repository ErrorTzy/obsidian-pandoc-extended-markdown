import { KeyBinding } from '@codemirror/view';
import { SettingsProvider } from './types';
import { createEnterHandler } from './handlers/enterHandler';
import { createTabHandler, createShiftTabHandler } from './handlers/tabHandler';
import { createShiftEnterHandler } from './handlers/shiftHandlers';

/**
 * Factory function to create keybindings for list autocompletion with settings.
 * This is the main export that combines all list autocompletion handlers.
 *
 * @param settings - Plugin settings or a provider for current settings
 * @returns Array of KeyBindings for list autocompletion
 */
export function createListAutocompletionKeymap(settings: SettingsProvider): KeyBinding[] {
    return [
        createEnterHandler(settings),
        createShiftEnterHandler(settings),
        createTabHandler(settings),
        createShiftTabHandler(settings)
    ];
}

// Re-export types for external use if needed
export * from './types';
