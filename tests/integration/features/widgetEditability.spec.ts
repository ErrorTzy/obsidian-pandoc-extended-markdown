import { describe, it, expect } from '@jest/globals';
import { 
    FancyListMarkerWidget,
    HashListMarkerWidget,
    ExampleListMarkerWidget,
    DuplicateExampleLabelWidget
} from '../../../src/live-preview/widgets/listWidgets';
import { DefinitionBulletWidget } from '../../../src/live-preview/widgets/definitionWidget';
import {
    CustomLabelMarkerWidget,
    CustomLabelInlineNumberWidget,
    CustomLabelReferenceWidget
} from '../../../src/live-preview/widgets/customLabelWidget';
import { SuperscriptWidget, SubscriptWidget } from '../../../src/live-preview/widgets/formatWidgets';
import { ExampleReferenceWidget } from '../../../src/live-preview/widgets/referenceWidget';

describe('Widget Editability', () => {
    describe('List Widgets', () => {
        it('FancyListMarkerWidget should allow all events through', () => {
            const widget = new FancyListMarkerWidget('A', '.');
            
            // Widget should return false for all event types to allow editing
            const keyboardEvent = new Event('keydown');
            const inputEvent = new Event('input');
            const mouseEvent = new Event('mousedown');
            
            expect(widget.ignoreEvent(keyboardEvent)).toBe(false);
            expect(widget.ignoreEvent(inputEvent)).toBe(false);
            expect(widget.ignoreEvent(mouseEvent)).toBe(false);
        });

        it('HashListMarkerWidget should allow all events through', () => {
            const widget = new HashListMarkerWidget(1);
            
            const keyboardEvent = new Event('keydown');
            const inputEvent = new Event('input');
            const mouseEvent = new Event('mousedown');
            
            expect(widget.ignoreEvent(keyboardEvent)).toBe(false);
            expect(widget.ignoreEvent(inputEvent)).toBe(false);
            expect(widget.ignoreEvent(mouseEvent)).toBe(false);
        });

        it('ExampleListMarkerWidget should allow all events through', () => {
            const widget = new ExampleListMarkerWidget(1, 'label');
            
            const keyboardEvent = new Event('keydown');
            const inputEvent = new Event('input');
            const mouseEvent = new Event('mousedown');
            
            expect(widget.ignoreEvent(keyboardEvent)).toBe(false);
            expect(widget.ignoreEvent(inputEvent)).toBe(false);
            expect(widget.ignoreEvent(mouseEvent)).toBe(false);
        });

        it('DuplicateExampleLabelWidget should allow all events through', () => {
            const widget = new DuplicateExampleLabelWidget('label', 1, 'content');
            
            const keyboardEvent = new Event('keydown');
            const inputEvent = new Event('input');
            const mouseEvent = new Event('mousedown');
            
            expect(widget.ignoreEvent(keyboardEvent)).toBe(false);
            expect(widget.ignoreEvent(inputEvent)).toBe(false);
            expect(widget.ignoreEvent(mouseEvent)).toBe(false);
        });
    });

    describe('Definition Widget', () => {
        it('DefinitionBulletWidget should allow all events through', () => {
            const widget = new DefinitionBulletWidget(':', 'term', true);
            
            const keyboardEvent = new Event('keydown');
            const inputEvent = new Event('input');
            const mouseEvent = new Event('mousedown');
            
            expect(widget.ignoreEvent(keyboardEvent)).toBe(false);
            expect(widget.ignoreEvent(inputEvent)).toBe(false);
            expect(widget.ignoreEvent(mouseEvent)).toBe(false);
        });
    });

    describe('Custom Label Widgets', () => {
        it('CustomLabelMarkerWidget should allow all events through', () => {
            const widget = new CustomLabelMarkerWidget('LABEL', 'Text', undefined as any);
            
            const keyboardEvent = new Event('keydown');
            const inputEvent = new Event('input');
            const mouseEvent = new Event('mousedown');
            
            expect(widget.ignoreEvent(keyboardEvent)).toBe(false);
            expect(widget.ignoreEvent(inputEvent)).toBe(false);
            expect(widget.ignoreEvent(mouseEvent)).toBe(false);
        });

        it('CustomLabelInlineNumberWidget should allow all events through', () => {
            const widget = new CustomLabelInlineNumberWidget('1', undefined as any);
            
            const keyboardEvent = new Event('keydown');
            const inputEvent = new Event('input');
            const mouseEvent = new Event('mousedown');
            
            // This widget has a different implementation - it blocks some events
            // but for editability, it should allow all events through
            expect(widget.ignoreEvent(keyboardEvent)).toBe(false);
            expect(widget.ignoreEvent(inputEvent)).toBe(false);
            expect(widget.ignoreEvent(mouseEvent)).toBe(false);
        });

        it('CustomLabelReferenceWidget should allow all events through', () => {
            const widget = new CustomLabelReferenceWidget('LABEL', 'Tooltip', undefined as any);
            
            const keyboardEvent = new Event('keydown');
            const inputEvent = new Event('input');
            const mouseEvent = new Event('mousedown');
            
            expect(widget.ignoreEvent(keyboardEvent)).toBe(false);
            expect(widget.ignoreEvent(inputEvent)).toBe(false);
            expect(widget.ignoreEvent(mouseEvent)).toBe(false);
        });
    });

    describe('Format Widgets', () => {
        it('SuperscriptWidget should allow all events through', () => {
            const widget = new SuperscriptWidget('text');
            
            // No event parameter means it should return false for all events
            expect(widget.ignoreEvent()).toBe(false);
        });

        it('SubscriptWidget should allow all events through', () => {
            const widget = new SubscriptWidget('text');
            
            // No event parameter means it should return false for all events
            expect(widget.ignoreEvent()).toBe(false);
        });
    });

    describe('Reference Widget', () => {
        it('ExampleReferenceWidget should allow all events through', () => {
            const widget = new ExampleReferenceWidget(1, 'tooltip');
            
            // No event parameter means it should return false for all events
            expect(widget.ignoreEvent()).toBe(false);
        });
    });
});