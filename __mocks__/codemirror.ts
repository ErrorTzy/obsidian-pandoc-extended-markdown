export class EditorState {
  static create(config: any) {
    return new EditorState();
  }
  field(field: any) {
    return new Map();
  }
  doc = {
    length: 100,
    sliceString: (from: number, to: number) => '',
    lineAt: (pos: number) => ({ from: 0, to: 100, number: 1 })
  };
  selection = {
    main: { head: 0, from: 0, to: 0 },
    ranges: []
  };
}

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