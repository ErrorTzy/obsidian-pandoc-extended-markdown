import { UI_CONSTANTS } from '../../../core/constants';
import { truncateContentPreservingMath } from '../../../shared/utils/mathRenderer';

export function truncateLabel(label: string): string {
    if (label.length > UI_CONSTANTS.LABEL_MAX_LENGTH) {
        return label.slice(0, UI_CONSTANTS.LABEL_TRUNCATION_LENGTH) + '…';
    }
    return label;
}

export function truncateContent(content: string): string {
    if (content.length > UI_CONSTANTS.CONTENT_MAX_LENGTH) {
        return content.slice(0, UI_CONSTANTS.CONTENT_TRUNCATION_LENGTH) + '…';
    }
    return content;
}

export function truncateContentWithRendering(
    content: string,
    maxLength: number = UI_CONSTANTS.CONTENT_MAX_LENGTH
): string {
    return truncateContentPreservingMath(content, maxLength);
}
