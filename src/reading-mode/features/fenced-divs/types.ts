import { FencedDivReference } from '../../../shared/types/fencedDivTypes';

export interface ActiveFencedDiv {
    contentElement: HTMLElement;
    contentLines: string[];
    reference: FencedDivReference;
}

export interface PreparedFencedDiv {
    block: HTMLElement;
    contentElement: HTMLElement;
    reference: FencedDivReference;
}

export interface CandidateLine {
    text: string;
    nodes: Node[];
}

export interface MultilineCandidateResult {
    processed: boolean;
    canOpenAtNextLine: boolean;
    lastProcessedFenceWasClosing: boolean;
}

export interface SourceOpeningState {
    openings: SourceOpeningEligibility[];
    index: number;
    currentOpeningDepth?: number;
    sourceLines: string[];
    lineIndex: number;
    inObsidianComment: boolean;
}

export interface SourceOpeningEligibility {
    text: string;
    allowed: boolean;
    depth: number;
    lineIndex: number;
}
