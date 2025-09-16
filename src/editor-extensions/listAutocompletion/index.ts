import { KeyBinding } from '@codemirror/view';
import { PandocExtendedMarkdownSettings } from '../../core/settings';
import { createEnterHandler } from './handlers/enterHandler';
import { createTabHandler, createShiftTabHandler } from './handlers/tabHandler';
import { createShiftEnterHandler } from './handlers/shiftHandlers';

/**
 * Factory function to create keybindings for list autocompletion with settings.
 * This is the main export that combines all list autocompletion handlers.
 *
 * @param settings - Plugin settings for list autocompletion behavior
 * @returns Array of KeyBindings for list autocompletion
 */
export function createListAutocompletionKeymap(settings: PandocExtendedMarkdownSettings): KeyBinding[] {
    return [
        createEnterHandler(settings),
        createShiftEnterHandler(),
        createTabHandler(),
        createShiftTabHandler()
    ];
}

// Re-export types for external use if needed
export * from './types';