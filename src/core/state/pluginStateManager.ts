/**
 * Unified Plugin State Manager
 * 
 * Single source of truth for all plugin state including:
 * - Document-specific counters and data
 * - View mode tracking per leaf
 * - Mode transition detection
 */

// External libraries
import { WorkspaceLeaf, MarkdownView } from 'obsidian';

// Types
import { ViewMode, DocumentCounters, ViewState, ModeChangeEvent } from '../../shared/types/settingsTypes';

// Constants
import { UI_CONSTANTS } from '../constants';

// Utils
import { PlaceholderContext } from '../../shared/utils/placeholderProcessor';

type ModeChangeCallback = (event: ModeChangeEvent) => void;

export class PluginStateManager {
    // Document-specific counters
    private documentCounters = new Map<string, DocumentCounters>();
    
    // View state tracking per leaf
    private viewStates = new Map<string, ViewState>();
    
    // Mode change listeners
    private modeChangeListeners: Set<ModeChangeCallback> = new Set();
    
    // Track processed elements to prevent duplicate counter increments
    private processedElements = new WeakMap<Element, Map<string, unknown>>();
    
    // Track which documents need element reprocessing
    private documentsNeedingReprocess = new Set<string>();

    /**
     * Get or create counters for a document
     */
    getDocumentCounters(docPath: string): DocumentCounters {
        if (!this.documentCounters.has(docPath)) {
            this.documentCounters.set(docPath, this.createEmptyCounters());
        }
        return this.documentCounters.get(docPath)!;
    }

    /**
     * Reset counters for a specific document
     */
    resetDocumentCounters(docPath: string): void {
        if (this.documentCounters.has(docPath)) {
            const counters = this.documentCounters.get(docPath)!;
            counters.exampleCounter = 0;
            counters.exampleMap.clear();
            counters.exampleContent.clear();
            counters.hashCounter = 0;
            counters.placeholderContext.reset();
        }
        // Mark that this document needs reprocessing
        this.documentsNeedingReprocess.add(docPath);
    }

    /**
     * Clear counters for a document (remove from memory)
     */
    clearDocumentCounters(docPath: string): void {
        this.documentCounters.delete(docPath);
        // Also clean up the reprocess flag when document is closed
        this.documentsNeedingReprocess.delete(docPath);
    }

    /**
     * Update view state and detect mode/document changes
     */
    updateViewState(leaf: WorkspaceLeaf): ModeChangeEvent | null {
        const leafId = this.getLeafId(leaf);
        const view = leaf.view as MarkdownView;
        
        const currentMode = this.detectViewMode(view);
        const currentPath = view.file?.path || null;
        
        const previous = this.viewStates.get(leafId);
        const previousMode = previous?.mode || null;
        const previousPath = previous?.filePath || null;
        
        // Update state
        this.viewStates.set(leafId, {
            mode: currentMode,
            filePath: currentPath
        });
        
        // Check for changes
        const modeChanged = previousMode !== currentMode;
        const pathChanged = previousPath !== currentPath;
        
        if (modeChanged || pathChanged) {
            const event: ModeChangeEvent = {
                leafId,
                previousMode,
                currentMode,
                previousPath,
                currentPath
            };
            
            // Handle state transitions
            this.handleStateTransition(event);
            
            // Notify listeners
            this.notifyModeChange(event);
            
            return event;
        }
        
        return null;
    }

    /**
     * Handle state transitions (e.g., reset counters)
     */
    private handleStateTransition(event: ModeChangeEvent): void {
        // Don't reset placeholder context on mode transitions
        // Let the scanner handle resets based on actual content changes
        
        // Reset OTHER counters (not placeholder) when exiting reading mode
        if (event.previousMode === "reading" && event.currentMode !== "reading") {
            if (event.previousPath) {
                // Only reset non-placeholder counters
                if (this.documentCounters.has(event.previousPath)) {
                    const counters = this.documentCounters.get(event.previousPath)!;
                    counters.exampleCounter = 0;
                    counters.exampleMap.clear();
                    counters.exampleContent.clear();
                    counters.hashCounter = 0;
                    // DON'T reset placeholderContext
                }
                // Mark that this document needs reprocessing
                this.documentsNeedingReprocess.add(event.previousPath);
            }
        }
        
        // Reset counters when switching documents
        if (event.previousPath && 
            event.currentPath && 
            event.previousPath !== event.currentPath) {
            // When switching documents, reset the new document's counters
            this.resetDocumentCounters(event.currentPath);
        }
        
        // Clear reprocess flag when entering reading mode
        if (event.currentMode === "reading" && event.currentPath) {
            // Give a small delay to ensure all elements are ready
            setTimeout(() => {
                this.clearReprocessFlag(event.currentPath!);
            }, UI_CONSTANTS.STATE_TRANSITION_DELAY_MS);
        }
    }

    /**
     * Register a mode change listener
     */
    onModeChange(callback: ModeChangeCallback): () => void {
        this.modeChangeListeners.add(callback);
        // Return unsubscribe function
        return () => {
            this.modeChangeListeners.delete(callback);
        };
    }

    /**
     * Notify all mode change listeners
     */
    private notifyModeChange(event: ModeChangeEvent): void {
        this.modeChangeListeners.forEach(callback => callback(event));
    }

    /**
     * Increment example counter for a document
     */
    incrementExampleCounter(docPath: string): number {
        const counters = this.getDocumentCounters(docPath);
        counters.exampleCounter++;
        return counters.exampleCounter;
    }

    /**
     * Increment hash counter for a document
     */
    incrementHashCounter(docPath: string): number {
        const counters = this.getDocumentCounters(docPath);
        counters.hashCounter++;
        return counters.hashCounter;
    }

    /**
     * Store labeled example data
     */
    setLabeledExample(docPath: string, label: string, number: number, content?: string): void {
        const counters = this.getDocumentCounters(docPath);
        counters.exampleMap.set(label, number);
        if (content) {
            counters.exampleContent.set(label, content);
        }
    }

    /**
     * Get labeled example number
     */
    getLabeledExampleNumber(docPath: string, label: string): number | undefined {
        const counters = this.getDocumentCounters(docPath);
        return counters.exampleMap.get(label);
    }

    /**
     * Get labeled example content
     */
    getLabeledExampleContent(docPath: string, label: string): string | undefined {
        const counters = this.getDocumentCounters(docPath);
        return counters.exampleContent.get(label);
    }

    /**
     * Mark an element as processed to prevent duplicate processing
     */
    markElementProcessed(element: Element, key: string, value: unknown): void {
        if (!this.processedElements.has(element)) {
            this.processedElements.set(element, new Map());
        }
        this.processedElements.get(element)!.set(key, value);
    }

    /**
     * Check if an element has been processed
     */
    isElementProcessed(element: Element, key: string, docPath?: string): boolean {
        // If document needs reprocessing, always return false
        if (docPath && this.documentsNeedingReprocess.has(docPath)) {
            return false;
        }
        return this.processedElements.has(element) && 
               this.processedElements.get(element)!.has(key);
    }
    
    /**
     * Clear reprocess flag for a document after processing
     */
    clearReprocessFlag(docPath: string): void {
        this.documentsNeedingReprocess.delete(docPath);
    }

    /**
     * Get processed element data
     */
    getProcessedElementData(element: Element, key: string): unknown {
        if (this.processedElements.has(element)) {
            return this.processedElements.get(element)!.get(key);
        }
        return undefined;
    }

    /**
     * Scan all leaves and update states
     * Returns true if any mode changes were detected
     */
    scanAllLeaves(leaves: WorkspaceLeaf[]): boolean {
        let anyChanges = false;
        for (const leaf of leaves) {
            if (leaf.view?.getViewType() === "markdown") {
                const event = this.updateViewState(leaf);
                if (event) {
                    anyChanges = true;
                }
            }
        }
        return anyChanges;
    }

    /**
     * Get placeholder context for a document (for testing compatibility)
     */
    getPlaceholderContext(docPath: string): PlaceholderContext {
        return this.getDocumentCounters(docPath).placeholderContext;
    }

    /**
     * Set custom labels for a document (for testing compatibility)
     */
    setCustomLabels(docPath: string, customLabels: Map<string, string>, rawToProcessed: Map<string, string>): void {
        const counters = this.getDocumentCounters(docPath);
        counters.customLabels = customLabels;
        counters.rawToProcessed = rawToProcessed;
    }

    /**
     * Clear all states (for plugin unload)
     */
    clearAllStates(): void {
        this.documentCounters.clear();
        this.viewStates.clear();
        this.modeChangeListeners.clear();
    }

    /**
     * Create empty counters object
     */
    private createEmptyCounters(): DocumentCounters {
        return {
            exampleCounter: 0,
            exampleMap: new Map(),
            exampleContent: new Map(),
            hashCounter: 0,
            placeholderContext: new PlaceholderContext(),
            customLabels: new Map(),
            rawToProcessed: new Map()
        };
    }

    /**
     * Detect the current view mode from a MarkdownView
     */
    private detectViewMode(view: MarkdownView): ViewMode {
        const state = view.getState();
        if (state?.mode === "preview") return "reading";
        if (state?.mode === "source") {
            // Live Preview vs Source is encoded in 'source' boolean
            return state.source ? "source" : "live";
        }
        // Fallback
        return (view.getMode() === "preview") ? "reading" : "live";
    }

    /**
     * Get a stable ID for a leaf
     */
    private getLeafId(leaf: WorkspaceLeaf): string {
        // Use leaf.id if available (newer Obsidian versions)
        if ('id' in leaf && leaf.id) {
            return leaf.id as string;
        }
        // Fallback: create a unique key
        const view = leaf.view as MarkdownView;
        return `${view?.file?.path ?? "unknown"}::${Math.random()}`;
    }
}

// Export singleton instance
export const pluginStateManager = new PluginStateManager();
