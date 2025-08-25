/**
 * @jest-environment jsdom
 */

import { setupSimpleHoverPreview, setupRenderedHoverPreview } from '../../../src/shared/utils/hoverPopovers';
import { CSS_CLASSES } from '../../../src/core/constants';

describe('Hover Popover Cleanup', () => {
    let element: HTMLElement;
    let abortController: AbortController;

    beforeEach(() => {
        document.body.innerHTML = '';
        
        element = document.createElement('span');
        element.textContent = 'Hover me';
        document.body.appendChild(element);
        
        abortController = new AbortController();
    });

    afterEach(() => {
        abortController.abort();
        document.body.innerHTML = '';
    });

    describe('setupSimpleHoverPreview', () => {
        it('should create popover on mouseenter', (done) => {
            setupSimpleHoverPreview(element, 'Full text', CSS_CLASSES.HOVER_POPOVER_LABEL, abortController.signal);
            
            // Trigger mouseenter
            const mouseEnterEvent = new MouseEvent('mouseenter', { bubbles: true });
            element.dispatchEvent(mouseEnterEvent);
            
            // Check popover exists
            setTimeout(() => {
                const popover = document.querySelector(`.${CSS_CLASSES.HOVER_POPOVER}`);
                expect(popover).toBeTruthy();
                expect(popover?.textContent).toBe('Full text');
                done();
            }, 10);
        });

        it('should remove popover on mouseleave after delay', (done) => {
            setupSimpleHoverPreview(element, 'Full text', CSS_CLASSES.HOVER_POPOVER_LABEL, abortController.signal);
            
            // Trigger mouseenter
            const mouseEnterEvent = new MouseEvent('mouseenter', { bubbles: true });
            element.dispatchEvent(mouseEnterEvent);
            
            // Trigger mouseleave
            setTimeout(() => {
                const mouseLeaveEvent = new MouseEvent('mouseleave', { bubbles: true });
                element.dispatchEvent(mouseLeaveEvent);
                
                // Check popover is removed after delay
                setTimeout(() => {
                    const popover = document.querySelector(`.${CSS_CLASSES.HOVER_POPOVER}`);
                    expect(popover).toBeFalsy();
                    done();
                }, 150); // Wait for cleanup timeout
            }, 10);
        });

        it('should remove popover immediately on click', (done) => {
            setupSimpleHoverPreview(element, 'Full text', CSS_CLASSES.HOVER_POPOVER_LABEL, abortController.signal);
            
            // Trigger mouseenter
            const mouseEnterEvent = new MouseEvent('mouseenter', { bubbles: true });
            element.dispatchEvent(mouseEnterEvent);
            
            // Trigger click
            setTimeout(() => {
                const clickEvent = new MouseEvent('click', { bubbles: true });
                element.dispatchEvent(clickEvent);
                
                // Check popover is removed immediately
                setTimeout(() => {
                    const popover = document.querySelector(`.${CSS_CLASSES.HOVER_POPOVER}`);
                    expect(popover).toBeFalsy();
                    done();
                }, 10);
            }, 10);
        });

        it('should handle rapid mouseenter/mouseleave without leaving orphaned popovers', (done) => {
            setupSimpleHoverPreview(element, 'Full text', CSS_CLASSES.HOVER_POPOVER_LABEL, abortController.signal);
            
            let eventCount = 0;
            const rapidHover = () => {
                if (eventCount >= 10) {
                    // After rapid hovering, wait for cleanup
                    setTimeout(() => {
                        const popovers = document.querySelectorAll(`.${CSS_CLASSES.HOVER_POPOVER}`);
                        expect(popovers.length).toBeLessThanOrEqual(1); // At most one popover
                        
                        // Trigger final mouseleave
                        const mouseLeaveEvent = new MouseEvent('mouseleave', { bubbles: true });
                        element.dispatchEvent(mouseLeaveEvent);
                        
                        // Wait for final cleanup
                        setTimeout(() => {
                            const finalPopovers = document.querySelectorAll(`.${CSS_CLASSES.HOVER_POPOVER}`);
                            expect(finalPopovers.length).toBe(0); // No popovers should remain
                            done();
                        }, 150);
                    }, 50);
                    return;
                }
                
                // Alternate between mouseenter and mouseleave
                const event = eventCount % 2 === 0 
                    ? new MouseEvent('mouseenter', { bubbles: true })
                    : new MouseEvent('mouseleave', { bubbles: true });
                element.dispatchEvent(event);
                eventCount++;
                
                // Very short delay between events
                setTimeout(rapidHover, 5);
            };
            
            rapidHover();
        });

        it('should replace existing popover when hovering again', (done) => {
            setupSimpleHoverPreview(element, 'Full text', CSS_CLASSES.HOVER_POPOVER_LABEL, abortController.signal);
            
            // First hover
            const mouseEnterEvent1 = new MouseEvent('mouseenter', { bubbles: true });
            element.dispatchEvent(mouseEnterEvent1);
            
            setTimeout(() => {
                const firstPopover = document.querySelector(`.${CSS_CLASSES.HOVER_POPOVER}`);
                expect(firstPopover).toBeTruthy();
                
                // Second hover (without leaving)
                const mouseEnterEvent2 = new MouseEvent('mouseenter', { bubbles: true });
                element.dispatchEvent(mouseEnterEvent2);
                
                setTimeout(() => {
                    const popovers = document.querySelectorAll(`.${CSS_CLASSES.HOVER_POPOVER}`);
                    expect(popovers.length).toBe(1); // Only one popover should exist
                    done();
                }, 10);
            }, 10);
        });

        it('should clean up when abort signal is triggered', (done) => {
            const localAbortController = new AbortController();
            setupSimpleHoverPreview(element, 'Full text', CSS_CLASSES.HOVER_POPOVER_LABEL, localAbortController.signal);
            
            // Trigger mouseenter
            const mouseEnterEvent = new MouseEvent('mouseenter', { bubbles: true });
            element.dispatchEvent(mouseEnterEvent);
            
            setTimeout(() => {
                const popover = document.querySelector(`.${CSS_CLASSES.HOVER_POPOVER}`);
                expect(popover).toBeTruthy();
                
                // Abort
                localAbortController.abort();
                
                setTimeout(() => {
                    const popoverAfterAbort = document.querySelector(`.${CSS_CLASSES.HOVER_POPOVER}`);
                    expect(popoverAfterAbort).toBeFalsy();
                    done();
                }, 10);
            }, 10);
        });
    });
});