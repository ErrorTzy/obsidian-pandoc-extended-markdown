interface TextLineInfo {
  from: number;
  to: number;
  text: string;
  number: number;
}

interface EditorSelectionRange {
  from: number;
  to: number;
}

export interface EditorSelectionShape {
  main: {
    head: number;
    from: number;
    to: number;
  };
  ranges: EditorSelectionRange[];
}

interface EditorChangeSpec {
  from: number;
  to: number;
  insert: string;
}

interface EditorChanges {
  changes?: EditorChangeSpec[];
}

interface EditorUpdateSpec {
  changes?: EditorChanges;
  selection?: EditorSelectionShape | null;
}

interface EditorUpdateResult {
  changes?: EditorChanges;
  selection: EditorSelectionShape | null;
}

interface MockDecoration {
  spec: Record<string, unknown>;
}

interface MockDecorationEntry {
  from: number;
  to: number;
  decoration: MockDecoration;
}

interface MockDoc {
  length: number;
  lines: number;
  toString(): string;
  sliceString(from: number, to: number): string;
  sliceDoc(from: number, to: number): string;
  lineAt(pos: number): TextLineInfo;
  line(num: number): TextLineInfo;
}

type DecorationCallback = (from: number, to: number, decoration: MockDecoration) => void;

export class Text {
  length: number;
  lines: number;
  private text: string;

  constructor(text: string) {
    this.text = text;
    this.length = text.length;
    this.lines = text.split('\n').length;
  }

  static of(lines: string[]): Text {
    const text = lines.join('\n');
    const instance = new Text(text);
    return Object.assign(instance, {
      toString: () => text,
      sliceString: (from: number, to: number) => text.slice(from, to),
      line: (num: number) => {
        const lineArray = lines;
        if (num < 1 || num > lineArray.length) {
          return { from: 0, to: 0, text: '', number: num };
        }
        let currentPos = 0;
        for (let i = 0; i < num - 1; i++) {
          currentPos += lineArray[i].length + 1;
        }
        return {
          from: currentPos,
          to: currentPos + lineArray[num - 1].length,
          text: lineArray[num - 1],
          number: num
        };
      }
    });
  }

  toString(): string {
    return this.text;
  }

  sliceString(from: number, to: number): string {
    return this.text.slice(from, to);
  }
}

export class EditorState {
  doc: MockDoc;
  selection: EditorSelectionShape | null;

  constructor(doc?: string, selection?: EditorSelectionShape | null) {
    const docText = doc || '';
    const lines = docText.split('\n');
    this.doc = {
      length: docText.length,
      lines: lines.length,
      toString: () => docText,
      sliceString: (from: number, to: number) => docText.slice(from, to),
      sliceDoc: (from: number, to: number) => docText.slice(from, to),
      lineAt: (pos: number) => {
        const text = docText;
        const lines = text.split('\n');
        let currentPos = 0;
        for (let i = 0; i < lines.length; i++) {
          const lineLength = lines[i].length + (i < lines.length - 1 ? 1 : 0);
          if (currentPos + lineLength > pos) {
            return {
              from: currentPos,
              to: currentPos + lines[i].length,
              text: lines[i],
              number: i + 1
            };
          }
          currentPos += lineLength;
        }
        return { from: 0, to: text.length, text: text, number: 1 };
      },
      line: (num: number) => {
        const text = docText;
        const textLines = text.split('\n');
        if (num < 1 || num > textLines.length) {
          return { from: 0, to: 0, text: '', number: num };
        }
        let currentPos = 0;
        for (let i = 0; i < num - 1; i++) {
          currentPos += textLines[i].length + 1;
        }
        return {
          from: currentPos,
          to: currentPos + textLines[num - 1].length,
          text: textLines[num - 1],
          number: num
        };
      }
    };
    this.selection = selection || null;
  }

  static create(config: { doc?: string; selection?: EditorSelectionShape | null }) {
    return new EditorState(config.doc, config.selection);
  }

  field(_field: unknown) {
    return new Map<unknown, unknown>();
  }

  update(spec: EditorUpdateSpec): EditorUpdateResult {
    const newDoc = spec.changes ? this.applyChanges(spec.changes) : this.doc.toString();
    const newSelection = spec.selection || this.selection;
    return {
      changes: spec.changes,
      selection: newSelection
    };
  }

  applyChanges(changes: EditorChanges): string {
    let doc = this.doc.toString();
    if (changes.changes) {
      for (const change of changes.changes) {
        doc = doc.substring(0, change.from) + change.insert + doc.substring(change.to);
      }
    }
    return doc;
  }

  facet(_facet: unknown) {
    // Return a mock plugin view with decorations
    return [{
      decorations: {
        size: 1,
        between: (from: number, to: number, callback: DecorationCallback) => {
          // Call the callback with some mock data
          callback(0, 6, { spec: { class: 'pem-definition-term' } });
          callback(8, 11, { spec: { widget: {} } });
        }
      }
    }];
  }
}

export const EditorSelection = {
  cursor: (pos: number): EditorSelectionShape => ({
    main: { head: pos, from: pos, to: pos },
    ranges: [{ from: pos, to: pos }]
  })
};

export class EditorView {
  static baseTheme(_styles: unknown) {
    return {};
  }
  static decorations = {
    from: (_field: unknown, _fn: unknown) => ({})
  };
  static pluginField = {
    init: () => ({}),
  };
  state: EditorState;
  viewport = { from: 0, to: 100 };
  dom?: HTMLElement;

  constructor(config?: { state?: EditorState; parent?: HTMLElement }) {
    if (config?.state) {
      this.state = config.state;
    } else {
      this.state = new EditorState();
    }
    if (config?.parent) {
      this.dom = document.createElement('div');
      config.parent.appendChild(this.dom);
    }
  }

  dispatch(spec: EditorUpdateSpec) {
    const newState = this.state.update(spec);
    // Update state if changes were applied
    if (spec.changes) {
      const newDoc = this.state.applyChanges(spec.changes);
      this.state = EditorState.create({
        doc: newDoc, 
        selection: spec.selection || this.state.selection 
      });
    }
    if (spec.selection) {
      this.state.selection = spec.selection ?? null;
    }
  }

  destroy() {
    // no-op
  }

  facet(_facet: unknown) {
    // Return a mock plugin view with decorations
    return [{
      decorations: {
        size: 1,
        between: (from: number, to: number, callback: DecorationCallback) => {
          // Call the callback with some mock data
          callback(0, 6, { spec: { class: 'pem-definition-term' } });
          callback(8, 11, { spec: { widget: {} } });
        }
      }
    }];
  }
}

export const StateField = {
  define: <T>(config: {
    create: () => T;
    update: (value: T) => T;
    provide?: (field: unknown) => unknown;
  }) => ({
    create: config.create,
    update: config.update,
    provide: config.provide
  })
};

export const StateEffect = {
  define: () => ({})
};

export const ViewPlugin = {
  fromClass: <T>(_cls: new (...args: unknown[]) => T, _config?: unknown) => ({})
};

export class Decoration {
  static mark(config: Record<string, unknown>): MockDecoration {
    return { spec: config };
  }
  static replace(config: Record<string, unknown>): MockDecoration {
    return { spec: config };
  }
  static widget(config: Record<string, unknown>): MockDecoration {
    return { spec: config };
  }
  static line(config: Record<string, unknown>): MockDecoration {
    return { spec: config };
  }
}

export class DecorationSet {
  static empty = new DecorationSet();

  size: number = 0;
  decorations: MockDecorationEntry[] = [];

  constructor(decorations?: MockDecorationEntry[]) {
    if (decorations) {
      this.decorations = decorations;
      this.size = decorations.length;
    }
  }

  iter(callback?: DecorationCallback) {
    if (callback) {
      // When callback is provided, iterate and call it
      for (const dec of this.decorations) {
        callback(dec.from, dec.to, dec.decoration);
      }
    } else {
      // When no callback, return an iterator
      let index = 0;
      const decorations = this.decorations;
      const iterator = {
        value: decorations[index] || null,
        from: decorations[index]?.from || 0,
        to: decorations[index]?.to || 0,
        next() {
          index++;
          if (index < decorations.length) {
            this.value = decorations[index];
            this.from = decorations[index].from;
            this.to = decorations[index].to;
          } else {
            this.value = null;
          }
        }
      };
      return iterator;
    }
  }
}

export class WidgetType {
  toDOM() {
    return document.createElement('span');
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  eq(_other: WidgetType) {
    return false;
  }
}

export class RangeSetBuilder {
  private decorations: MockDecorationEntry[] = [];

  add(from: number, to: number, decoration: MockDecoration) {
    this.decorations.push({ from, to, decoration });
  }

  finish() {
    return new DecorationSet(this.decorations);
  }
}

interface SyntaxTreeConfig {
  enter?: (node: SyntaxNodeRefLike) => boolean | void;
  leave?: (node: SyntaxNodeRefLike) => void;
}

interface SyntaxNodeRefLike {
  from: number;
  to: number;
  type: { name: string };
}

type SyntaxTreeIterator = (state: unknown, config: SyntaxTreeConfig) => void;

let syntaxTreeIterator: SyntaxTreeIterator = () => {};

interface SyntaxTreeFunction {
  (state: unknown): { iterate: (config: SyntaxTreeConfig) => void };
  __setMockIterator?: (fn: SyntaxTreeIterator) => void;
}

export const syntaxTree = ((state: unknown) => ({
  iterate: (config: SyntaxTreeConfig) => {
    syntaxTreeIterator(state, config);
  }
})) as SyntaxTreeFunction;

syntaxTree.__setMockIterator = (fn: SyntaxTreeIterator) => {
  syntaxTreeIterator = fn;
};

type EnsureSyntaxTreeFunction = {
  (state: unknown, _upto?: number, _timeout?: number): { iterate: (config: SyntaxTreeConfig) => void } | null;
  __setReturnNull?: (value: boolean) => void;
};

let ensureReturnsNull = false;

export const ensureSyntaxTree = ((state: unknown) => {
  if (ensureReturnsNull) {
    return null;
  }
  return syntaxTree(state);
}) as EnsureSyntaxTreeFunction;

ensureSyntaxTree.__setReturnNull = (value: boolean) => {
  ensureReturnsNull = value;
};

export const Extension: [] = [];
