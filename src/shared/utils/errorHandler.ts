import { Notice } from 'obsidian';
import { ERROR_MESSAGES } from '../../core/constants';

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
    let message = ERROR_MESSAGES.UNEXPECTED_ERROR;
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
        new Notice(`${ERROR_MESSAGES.PLUGIN_PREFIX}: ${context} ${ERROR_MESSAGES.PARSE_FAILED}. ${message}`);
    }
}

/**
 * Validates that a required API method exists.
 * Returns a fallback if the method doesn't exist.
 */
export function validateApiMethod<T>(
    obj: Record<string, unknown> | null | undefined,
    methodName: string,
    fallback: (...args: unknown[]) => T
): (...args: unknown[]) => T {
    const candidate = obj?.[methodName];
    if (typeof candidate === 'function') {
        return (...args: unknown[]) => (candidate as (...innerArgs: unknown[]) => T).apply(obj, args);
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
        target: object,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value as (...args: unknown[]) => unknown;
        
        descriptor.value = function (...args: unknown[]) {
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
