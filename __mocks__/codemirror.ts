export class EditorState {
  doc: any;
  selection: any;
  
  constructor(doc?: string, selection?: any) {
    this.doc = {
      length: doc ? doc.length : 100,
      toString: () => doc || '',
      sliceString: (from: number, to: number) => (doc || '').slice(from, to),
      sliceDoc: (from: number, to: number) => (doc || '').slice(from, to),
      lineAt: (pos: number) => {
        const text = doc || '';
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
        const text = doc || '';
        const lines = text.split('\n');
        if (num < 1 || num > lines.length) {
          return { from: 0, to: 0, text: '', number: num };
        }
        let currentPos = 0;
        for (let i = 0; i < num - 1; i++) {
          currentPos += lines[i].length + 1;
        }
        return {
          from: currentPos,
          to: currentPos + lines[num - 1].length,
          text: lines[num - 1],
          number: num
        };
      }
    };
    this.selection = selection || {
      main: { head: 0, from: 0, to: 0 },
      ranges: []
    };
  }
  
  static create(config: any) {
    return new EditorState(config.doc, config.selection);
  }
  
  field(field: any) {
    return new Map();
  }
  
  update(spec: any) {
    const newDoc = spec.changes ? this.applyChanges(spec.changes) : this.doc.toString();
    const newSelection = spec.selection || this.selection;
    return {
      changes: spec.changes,
      selection: newSelection
    };
  }
  
  applyChanges(changes: any) {
    let doc = this.doc.toString();
    if (changes.changes) {
      for (const change of changes.changes) {
        doc = doc.substring(0, change.from) + change.insert + doc.substring(change.to);
      }
    }
    return doc;
  }
}

export const EditorSelection = {
  cursor: (pos: number) => ({
    main: { head: pos, from: pos, to: pos },
    ranges: [{ from: pos, to: pos }]
  })
};

export class EditorView {
  static baseTheme(styles: any) {
    return {};
  }
  static decorations = {
    from: (field: any, fn: any) => ({})
  };
  state = new EditorState();
  viewport = { from: 0, to: 100 };
}

export const StateField = {
  define: (config: any) => ({
    create: config.create,
    update: config.update,
    provide: config.provide
  })
};

export const StateEffect = {
  define: () => ({})
};

export const ViewPlugin = {
  fromClass: (cls: any, config?: any) => ({})
};

export class Decoration {
  static mark(config: any) {
    return {};
  }
  static replace(config: any) {
    return {};
  }
  static widget(config: any) {
    return {};
  }
}

export class DecorationSet {
  static empty = new DecorationSet();
}

export class WidgetType {
  toDOM() {
    return document.createElement('span');
  }
  eq(other: any) {
    return false;
  }
}

export class RangeSetBuilder {
  add(from: number, to: number, decoration: any) {}
  finish() {
    return DecorationSet.empty;
  }
}

export const syntaxTree = (state: any) => ({
  iterate: (config: any) => {}
});

export const Extension = {};