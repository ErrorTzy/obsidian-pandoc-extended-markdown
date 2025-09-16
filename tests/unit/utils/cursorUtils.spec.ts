import { getRegionCursorPosition, isCursorInRange } from '../../../src/shared/utils/cursorUtils';
import { ProcessingContext, ContentRegion } from '../../../src/live-preview/pipeline/types';

describe('Cursor Utilities', () => {
    describe('getRegionCursorPosition', () => {
        it('should calculate correct relative position when cursor is within region', () => {
            const context: ProcessingContext = {
                view: {
                    state: {
                        selection: {
                            main: {
                                head: 150
                            }
                        }
                    }
                } as any
            } as ProcessingContext;

            const region: ContentRegion = {
                from: 100,
                to: 200,
                type: 'list-content',
                parentStructure: 'fancy-list'
            };

            const position = getRegionCursorPosition(context, region);
            expect(position).toBe(50); // 150 - 100
        });

        it('should return -1 when cursor position is undefined', () => {
            const context: ProcessingContext = {
                view: {
                    state: {
                        selection: {
                            main: {
                                head: undefined
                            }
                        }
                    }
                } as any
            } as ProcessingContext;

            const region: ContentRegion = {
                from: 100,
                to: 200,
                type: 'list-content',
                parentStructure: 'fancy-list'
            };

            const position = getRegionCursorPosition(context, region);
            expect(position).toBe(-1);
        });

        it('should return -1 when view is undefined', () => {
            const context: ProcessingContext = {} as ProcessingContext;

            const region: ContentRegion = {
                from: 100,
                to: 200,
                type: 'list-content',
                parentStructure: 'fancy-list'
            };

            const position = getRegionCursorPosition(context, region);
            expect(position).toBe(-1);
        });
    });

    describe('isCursorInRange', () => {
        it('should return true when cursor is within range', () => {
            const context: ProcessingContext = {
                view: {
                    state: {
                        selection: {
                            main: {
                                head: 150
                            }
                        }
                    }
                } as any
            } as ProcessingContext;

            const result = isCursorInRange(context, 100, 200);
            expect(result).toBe(true);
        });

        it('should return false when cursor is before range', () => {
            const context: ProcessingContext = {
                view: {
                    state: {
                        selection: {
                            main: {
                                head: 50
                            }
                        }
                    }
                } as any
            } as ProcessingContext;

            const result = isCursorInRange(context, 100, 200);
            expect(result).toBe(false);
        });

        it('should return false when cursor is after range', () => {
            const context: ProcessingContext = {
                view: {
                    state: {
                        selection: {
                            main: {
                                head: 250
                            }
                        }
                    }
                } as any
            } as ProcessingContext;

            const result = isCursorInRange(context, 100, 200);
            expect(result).toBe(false);
        });

        it('should return false when cursor position is undefined', () => {
            const context: ProcessingContext = {
                view: {
                    state: {
                        selection: {
                            main: {}
                        }
                    }
                } as any
            } as ProcessingContext;

            const result = isCursorInRange(context, 100, 200);
            expect(result).toBe(false);
        });
    });
});