/**
 * @jest-environment jsdom
 */

import { processCustomLabelLists } from '../src/parsers/customLabelListParser';
import { MarkdownPostProcessorContext } from 'obsidian';

describe('Custom Label Reading Mode', () => {
  let context: MarkdownPostProcessorContext;

  beforeEach(() => {
    // Mock context
    context = {
      sourcePath: 'test.md',
      frontmatter: null,
      addChild: jest.fn(),
      getSectionInfo: jest.fn()
    } as any;
  });

  describe('List markers in paragraphs', () => {
    it('should process custom label at start of paragraph', () => {
      const element = document.createElement('div');
      element.innerHTML = '<p>{::P} All humans are mortal.</p>';
      
      processCustomLabelLists(element, context);
      
      const span = element.querySelector('span.pandoc-list-marker');
      expect(span).toBeTruthy();
      expect(span?.textContent).toBe('(P)');
      
      const paragraph = element.querySelector('p');
      expect(paragraph?.textContent).toBe('(P) All humans are mortal.');
    });

    it('should process custom label with prime', () => {
      const element = document.createElement('div');
      element.innerHTML = "<p>{::P'} Modified premise.</p>";
      
      processCustomLabelLists(element, context);
      
      const span = element.querySelector('span.pandoc-list-marker');
      expect(span).toBeTruthy();
      expect(span?.textContent).toBe("(P')");
    });

    it('should process custom label with underscore', () => {
      const element = document.createElement('div');
      element.innerHTML = '<p>{::X_0} Initial value.</p>';
      
      processCustomLabelLists(element, context);
      
      const span = element.querySelector('span.pandoc-list-marker');
      expect(span).toBeTruthy();
      expect(span?.textContent).toBe('(X_0)');
    });

    it('should process multiple custom labels in different paragraphs', () => {
      const element = document.createElement('div');
      element.innerHTML = `
        <p>{::P} First premise.</p>
        <p>{::Q} Second premise.</p>
        <p>{::R} Conclusion.</p>
      `;
      
      processCustomLabelLists(element, context);
      
      const markers = element.querySelectorAll('span.pandoc-list-marker');
      expect(markers).toHaveLength(3);
      expect(markers[0].textContent).toBe('(P)');
      expect(markers[1].textContent).toBe('(Q)');
      expect(markers[2].textContent).toBe('(R)');
    });
  });

  describe('List markers in list items', () => {
    it('should process custom label in list item', () => {
      const element = document.createElement('div');
      element.innerHTML = '<ul><li>{::P} All humans are mortal.</li></ul>';
      
      processCustomLabelLists(element, context);
      
      const span = element.querySelector('span.pandoc-list-marker');
      expect(span).toBeTruthy();
      expect(span?.textContent).toBe('(P)');
      
      const li = element.querySelector('li');
      expect(li?.classList.contains('pandoc-custom-label-item')).toBe(true);
    });

    it('should process multiple custom labels in list', () => {
      const element = document.createElement('div');
      element.innerHTML = `
        <ul>
          <li>{::P} First premise.</li>
          <li>{::Q} Second premise.</li>
        </ul>
      `;
      
      processCustomLabelLists(element, context);
      
      const markers = element.querySelectorAll('span.pandoc-list-marker');
      expect(markers).toHaveLength(2);
      
      const items = element.querySelectorAll('li.pandoc-custom-label-item');
      expect(items).toHaveLength(2);
    });
  });

  describe('Inline references', () => {
    it('should process inline reference to custom label', () => {
      const element = document.createElement('div');
      element.innerHTML = '<p>From {::P} and {::Q}, we conclude.</p>';
      
      processCustomLabelLists(element, context);
      
      const refs = element.querySelectorAll('span.pandoc-example-reference');
      expect(refs).toHaveLength(2);
      expect(refs[0].textContent).toBe('(P)');
      expect(refs[1].textContent).toBe('(Q)');
      expect(refs[0].getAttribute('data-custom-label-ref')).toBe('P');
      expect(refs[1].getAttribute('data-custom-label-ref')).toBe('Q');
    });

    it('should process multiple references in same text', () => {
      const element = document.createElement('div');
      element.innerHTML = '<p>Given {::P}, {::Q}, and {::R}, we have the result.</p>';
      
      processCustomLabelLists(element, context);
      
      const refs = element.querySelectorAll('span.pandoc-example-reference');
      expect(refs).toHaveLength(3);
    });

    it('should handle references with special characters', () => {
      const element = document.createElement('div');
      element.innerHTML = "<p>From {::P'} and {::X_0} we get the result.</p>";
      
      processCustomLabelLists(element, context);
      
      const refs = element.querySelectorAll('span.pandoc-example-reference');
      expect(refs).toHaveLength(2);
      expect(refs[0].textContent).toBe("(P')");
      expect(refs[1].textContent).toBe('(X_0)');
    });
  });

  describe('Mixed content', () => {
    it('should handle both list markers and references', () => {
      const element = document.createElement('div');
      element.innerHTML = `
        <p>{::P} First premise.</p>
        <p>{::Q} Second premise.</p>
        <p>From {::P} and {::Q}, we conclude.</p>
      `;
      
      processCustomLabelLists(element, context);
      
      const markers = element.querySelectorAll('span.pandoc-list-marker');
      expect(markers).toHaveLength(2);
      
      const refs = element.querySelectorAll('span.pandoc-example-reference');
      expect(refs).toHaveLength(2);
    });

    it('should not process content in code blocks', () => {
      const element = document.createElement('div');
      element.innerHTML = `
        <p>{::P} This should be processed.</p>
        <pre><code>{::Q} This should NOT be processed.</code></pre>
        <p>Reference to {::P} should work.</p>
      `;
      
      processCustomLabelLists(element, context);
      
      const markers = element.querySelectorAll('span.pandoc-list-marker');
      expect(markers).toHaveLength(1);
      
      const codeBlock = element.querySelector('code');
      expect(codeBlock?.textContent).toBe('{::Q} This should NOT be processed.');
    });

    it('should not process inline code', () => {
      const element = document.createElement('div');
      element.innerHTML = '<p>The syntax <code>{::P}</code> creates a label.</p>';
      
      processCustomLabelLists(element, context);
      
      const refs = element.querySelectorAll('span.pandoc-example-reference');
      expect(refs).toHaveLength(0);
      
      const code = element.querySelector('code');
      expect(code?.textContent).toBe('{::P}');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty element', () => {
      const element = document.createElement('div');
      
      expect(() => processCustomLabelLists(element, context)).not.toThrow();
    });

    it('should handle text without custom labels', () => {
      const element = document.createElement('div');
      element.innerHTML = '<p>Regular text without any labels.</p>';
      
      processCustomLabelLists(element, context);
      
      expect(element.innerHTML).toBe('<p>Regular text without any labels.</p>');
    });

    it('should not process invalid labels', () => {
      const element = document.createElement('div');
      element.innerHTML = '<p>{::} Empty label should not be processed.</p>';
      
      processCustomLabelLists(element, context);
      
      const markers = element.querySelectorAll('span.pandoc-list-marker');
      expect(markers).toHaveLength(0);
    });

    it('should preserve whitespace and formatting', () => {
      const element = document.createElement('div');
      element.innerHTML = '<p>    {::P} Indented text.</p>';
      
      processCustomLabelLists(element, context);
      
      const paragraph = element.querySelector('p');
      expect(paragraph?.textContent).toBe('    (P) Indented text.');
    });
  });
});