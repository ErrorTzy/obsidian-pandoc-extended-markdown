/**
 * @jest-environment jsdom
 */

import { processCustomLabelLists } from '../src/reading-mode/parsers/customLabelListParser';
import { MarkdownPostProcessorContext } from 'obsidian';

describe('Custom Label Multi-Line Reading Mode', () => {
  let context: MarkdownPostProcessorContext;

  beforeEach(() => {
    context = {
      sourcePath: 'test.md',
      frontmatter: null,
      addChild: jest.fn(),
      getSectionInfo: jest.fn()
    } as any;
  });

  it('should process multiple custom labels in a single paragraph with line breaks', () => {
    const element = document.createElement('div');
    element.innerHTML = '<p>{::P} All humans are mortal.<br>{::Q} Socrates is human.<br>{::R} Therefore, Socrates is mortal.</p>';
    
    processCustomLabelLists(element, context);
    
    const markers = element.querySelectorAll('span.pandoc-list-marker');
    expect(markers).toHaveLength(3);
    expect(markers[0].textContent).toBe('(P)');
    expect(markers[1].textContent).toBe('(Q)');
    expect(markers[2].textContent).toBe('(R)');
  });

  it('should process multiple custom labels with newlines in HTML', () => {
    const element = document.createElement('div');
    element.innerHTML = `<p>{::P} First premise.
{::Q} Second premise.
{::R} Conclusion.</p>`;
    
    processCustomLabelLists(element, context);
    
    const markers = element.querySelectorAll('span.pandoc-list-marker');
    expect(markers).toHaveLength(3);
  });

  it('should handle mixed list markers and references on same line', () => {
    const element = document.createElement('div');
    element.innerHTML = '<p>{::P} From {::A} and {::B} we get this.<br>{::Q} Another point.</p>';
    
    processCustomLabelLists(element, context);
    
    const markers = element.querySelectorAll('span.pandoc-list-marker');
    const refs = element.querySelectorAll('span.pandoc-example-reference');
    
    expect(markers).toHaveLength(2); // P and Q are list markers
    expect(refs).toHaveLength(2); // A and B are references
    expect(markers[0].textContent).toBe('(P)');
    expect(markers[1].textContent).toBe('(Q)');
    expect(refs[0].textContent).toBe('(A)');
    expect(refs[1].textContent).toBe('(B)');
  });

  it('should process multiple custom labels in separate paragraphs', () => {
    const element = document.createElement('div');
    element.innerHTML = `
      <p>{::P} First premise.</p>
      <p>{::Q} Second premise.</p>
      <p>{::R} Conclusion.</p>
    `;
    
    processCustomLabelLists(element, context);
    
    const markers = element.querySelectorAll('span.pandoc-list-marker');
    expect(markers).toHaveLength(3);
  });

  it('should handle both br tags and actual line breaks', () => {
    const element = document.createElement('div');
    // Mix of <br> tags and newlines
    element.innerHTML = '<p>{::P} Line one.<br/>{::Q} Line two.\n{::R} Line three.</p>';
    
    processCustomLabelLists(element, context);
    
    const markers = element.querySelectorAll('span.pandoc-list-marker');
    expect(markers).toHaveLength(3);
    expect(markers[0].textContent).toBe('(P)');
    expect(markers[1].textContent).toBe('(Q)');
    expect(markers[2].textContent).toBe('(R)');
  });

  it('should preserve single br tags without duplication', () => {
    const element = document.createElement('div');
    element.innerHTML = '<p>{::P} First line.<br>{::Q} Second line.</p>';
    
    processCustomLabelLists(element, context);
    
    // Count br tags - should still be 1
    const brTags = element.querySelectorAll('br');
    expect(brTags).toHaveLength(1);
    
    const markers = element.querySelectorAll('span.pandoc-list-marker');
    expect(markers).toHaveLength(2);
  });

  it('should preserve line break structure', () => {
    const element = document.createElement('div');
    const originalHtml = '<p>{::P} Line one.<br>{::Q} Line two.<br>{::R} Line three.</p>';
    element.innerHTML = originalHtml;
    
    processCustomLabelLists(element, context);
    
    // Should have same number of br tags as original
    const brTags = element.querySelectorAll('br');
    expect(brTags).toHaveLength(2);
    
    // Should have processed the markers
    const markers = element.querySelectorAll('span.pandoc-list-marker');
    expect(markers).toHaveLength(3);
  });
});