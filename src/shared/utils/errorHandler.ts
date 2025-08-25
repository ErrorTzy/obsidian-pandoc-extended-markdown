import { Notice } from 'obsidian';

/**
 * Custom error class for the Pandoc Extended Markdown plugin.
 */
export class PluginError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly recoverable: boolean = true
    ) {
        super(message);
        this.name = 'PandocExtendedMarkdownPluginError';
    }
}

/**
 * Error codes for different types of errors.
 */
export const ERROR_CODES = {
    PARSE_ERROR: 'PARSE_ERROR',
    RENDER_ERROR: 'RENDER_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    API_ERROR: 'API_ERROR',
    SETTINGS_ERROR: 'SETTINGS_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

/**
 * Wraps a function with error handling.
 * Returns a fallback value if the function throws an error.
 */
export function withErrorBoundary<T>(
    fn: () => T,
    fallback: T,
    context: string
): T {
    try {
        return fn();
    } catch (error) {
        handleError(error, context);
        return fallback;
    }
}

/**
 * Wraps an async function with error handling.
 */
export async function withAsyncErrorBoundary<T>(
    fn: () => Promise<T>,
    fallback: T,
    context: string
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        handleError(error, context);
        return fallback;
    }
}

/**
 * Central error handler for the plugin.
 */
export function handleError(error: unknown, context: string): void {
    // Determine error type and message
    let message = 'An unexpected error occurred';
    let showNotice = true;
    
    if (error instanceof PluginError) {
        message = error.message;
        showNotice = error.recoverable;
        
        // Re-throw non-recoverable errors
        if (!error.recoverable) {
            throw error;
        }
    } else if (error instanceof Error) {
        message = error.message;
    } else if (typeof error === 'string') {
        message = error;
    }
    
    // Show user-friendly notice for recoverable errors
    if (showNotice) {
        new Notice(`Pandoc Extended Markdown: ${context} failed. ${message}`);
    }
}

/**
 * Validates that a required API method exists.
 * Returns a fallback if the method doesn't exist.
 */
export function validateApiMethod<T>(
    obj: any,
    methodName: string,
    fallback: T
): T {
    if (obj && typeof obj[methodName] === 'function') {
        return obj[methodName].bind(obj);
    }
    
    return fallback;
}

/**
 * Safe wrapper for parsing operations.
 */
export function safeParse<T>(
    parser: () => T,
    defaultValue: T,
    context: string
): T {
    return withErrorBoundary(
        parser,
        defaultValue,
        `Parsing ${context}`
    );
}

/**
 * Safe wrapper for rendering operations.
 */
export function safeRender<T>(
    renderer: () => T,
    defaultValue: T,
    context: string
): T {
    return withErrorBoundary(
        renderer,
        defaultValue,
        `Rendering ${context}`
    );
}

/**
 * Decorator for methods that should have error handling.
 */
export function errorHandler(context: string) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        
        descriptor.value = function (...args: any[]) {
            try {
                const result = originalMethod.apply(this, args);
                
                // Handle async methods
                if (result instanceof Promise) {
                    return result.catch((error: unknown) => {
                        handleError(error, `${context}.${propertyKey}`);
                        return null;
                    });
                }
                
                return result;
            } catch (error) {
                handleError(error, `${context}.${propertyKey}`);
                return null;
            }
        };
        
        return descriptor;
    };
}