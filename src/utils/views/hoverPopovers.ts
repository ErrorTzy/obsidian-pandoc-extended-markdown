import { CSS_CLASSES } from '../../constants';

export function setupSimpleHoverPreview(
    element: HTMLElement, 
    fullText: string, 
    popoverClass: string = CSS_CLASSES.HOVER_POPOVER_LABEL
): void {
    let hoverPopover: HTMLElement | null = null;
    
    const removePopover = () => {
        if (hoverPopover) {
            hoverPopover.remove();
            hoverPopover = null;
        }
    };
    
    element.addEventListener('mouseenter', () => {
        const hoverEl = document.createElement('div');
        hoverEl.classList.add(CSS_CLASSES.HOVER_POPOVER, popoverClass);
        hoverEl.textContent = fullText;
        
        document.body.appendChild(hoverEl);
        const rect = element.getBoundingClientRect();
        hoverEl.style.left = `${rect.left}px`;
        hoverEl.style.top = `${rect.bottom + 5}px`;
        
        // Adjust if goes off screen
        const hoverRect = hoverEl.getBoundingClientRect();
        if (hoverRect.right > window.innerWidth) {
            hoverEl.style.left = `${window.innerWidth - hoverRect.width - 10}px`;
        }
        if (hoverRect.bottom > window.innerHeight) {
            hoverEl.style.top = `${rect.top - hoverRect.height - 5}px`;
        }
        
        hoverPopover = hoverEl;
    });
    
    element.addEventListener('mouseleave', removePopover);
    element.addEventListener('click', removePopover);
}

export function positionHoverElement(hoverEl: HTMLElement, referenceEl: HTMLElement, maxWidth?: string, maxHeight?: string): void {
    const rect = referenceEl.getBoundingClientRect();
    hoverEl.style.left = `${rect.left}px`;
    hoverEl.style.top = `${rect.bottom + 5}px`;
    
    if (maxWidth) {
        hoverEl.style.maxWidth = maxWidth;
    }
    if (maxHeight) {
        hoverEl.style.maxHeight = maxHeight;
    }
    hoverEl.style.overflow = 'auto';
    
    // Adjust if goes off screen
    const hoverRect = hoverEl.getBoundingClientRect();
    if (hoverRect.right > window.innerWidth) {
        hoverEl.style.left = `${window.innerWidth - hoverRect.width - 10}px`;
    }
    if (hoverRect.bottom > window.innerHeight) {
        hoverEl.style.top = `${rect.top - hoverRect.height - 5}px`;
    }
}