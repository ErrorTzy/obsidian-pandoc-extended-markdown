export class EditorState {
  doc: any;
  selection: any;
  
  constructor(doc?: string, selection?: any) {
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

  facet(facet: any) {
    // Return a mock plugin view with decorations
    return [{
      decorations: {
        size: 1,
        between: (from: number, to: number, callback: (from: number, to: number, decoration: any) => void) => {
          // Call the callback with some mock data
          callback(0, 6, { spec: { class: 'pandoc-definition-term' } });
          callback(8, 11, { spec: { widget: {} } });
        }
      }
    }];
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
  static pluginField = {
    init: () => ({}),
  };
  state: EditorState;
  viewport = { from: 0, to: 100 };
  dom: any;
  
  constructor(config?: any) {
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
  
  dispatch(spec: any) {
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
      this.state.selection = spec.selection;
    }
  }

  destroy() {
    // no-op
  }

  facet(facet: any) {
    // Return a mock plugin view with decorations
    return [{
      decorations: {
        size: 1,
        between: (from: number, to: number, callback: (from: number, to: number, decoration: any) => void) => {
          // Call the callback with some mock data
          callback(0, 6, { spec: { class: 'pandoc-definition-term' } });
          callback(8, 11, { spec: { widget: {} } });
        }
      }
    }];
  }
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
    return { spec: config };
  }
  static replace(config: any) {
    return { spec: config };
  }
  static widget(config: any) {
    return { spec: config };
  }
  static line(config: any) {
    return { spec: config };
  }
}

export class DecorationSet {
  static empty = new DecorationSet();
  
  size: number = 0;
  decorations: any[] = [];
  
  constructor(decorations?: any[]) {
    if (decorations) {
      this.decorations = decorations;
      this.size = decorations.length;
    }
  }
  
  iter() {
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

export class WidgetType {
  toDOM() {
    return document.createElement('span');
  }
  eq(other: any) {
    return false;
  }
}

export class RangeSetBuilder {
  private decorations: any[] = [];
  
  add(from: number, to: number, decoration: any) {
    this.decorations.push({ from, to, decoration });
  }
  
  finish() {
    return new DecorationSet(this.decorations);
  }
}

export const syntaxTree = (state: any) => ({
  iterate: (config: any) => {}
});

export const Extension = {};