export class Plugin {
  app: App;
  constructor(app: App, manifest: any) {
    this.app = app;
  }
  loadData() { return Promise.resolve({}); }
  saveData() { return Promise.resolve(); }
  registerEditorExtension() {}
  registerMarkdownPostProcessor() {}
  registerView() {}
  addRibbonIcon() {}
  registerEditorSuggest() {}
  addSettingTab() {}
  addCommand() {}
  registerEvent() {}
  registerHoverLinkSource() {}
}

export class MarkdownPostProcessorContext {
  getSectionInfo() {
    return {
      text: '',
      lineStart: 0,
      lineEnd: 0
    };
  }
}

export class ItemView {
  contentEl: HTMLElement & {
    empty: () => void;
    createEl: (tag: string, opts?: any) => HTMLElement;
    createDiv: (opts?: any) => HTMLElement;
  };
  app: App;
  constructor(leaf: WorkspaceLeaf) {
    const el = document.createElement('div') as HTMLElement & {
      empty: () => void;
      createEl: (tag: string, opts?: any) => HTMLElement;
      createDiv: (opts?: any) => HTMLElement;
    };
    el.empty = function() {
      this.innerHTML = '';
    };
    el.createEl = function(tag: string, opts?: any) {
      const newEl = document.createElement(tag);
      if (opts?.text) newEl.textContent = opts.text;
      if (opts?.cls) newEl.className = opts.cls;
      this.appendChild(newEl);
      // Add the same methods to the new element
      (newEl as any).empty = el.empty.bind(newEl);
      (newEl as any).createEl = el.createEl.bind(newEl);
      (newEl as any).createDiv = el.createDiv.bind(newEl);
      (newEl as any).createSpan = el.createSpan.bind(newEl);
      (newEl as any).addClass = function(cls: string) { this.classList.add(cls); };
      (newEl as any).removeClass = function(cls: string) { this.classList.remove(cls); };
      return newEl as HTMLElement;
    };
    el.createDiv = function(opts?: any) {
      return el.createEl('div', opts);
    };
    el.createSpan = function(opts?: any) {
      return el.createEl('span', opts);
    };
    this.contentEl = el;
    this.app = new App();
  }
  onOpen() { return Promise.resolve(); }
  onClose() { return Promise.resolve(); }
  getViewType() { return ''; }
  getDisplayText() { return ''; }
  getIcon() { return ''; }
  registerEvent() {}
}

export class WorkspaceLeaf {
  constructor(app: App) {}
  setViewState() { return Promise.resolve(); }
}

export class Modal {}
export class Notice {}
export class PluginSettingTab {}
export class Setting {}
export class App {
  workspace: any = {
    on: jest.fn(),
    getActiveViewOfType: jest.fn(),
    getLeavesOfType: jest.fn().mockReturnValue([]),
    getRightLeaf: jest.fn(),
    revealLeaf: jest.fn(),
    detachLeavesOfType: jest.fn(),
    trigger: jest.fn()
  };
}
export class MarkdownView {
  file: any;
  editor: any;
}
export class Editor {
  getValue() { return ''; }
  setCursor() {}
  scrollIntoView() {}
  getLine() { return ''; }
}
export class EditorSuggest {
  constructor(plugin: any) {}
}
export interface HoverLinkSource {
  display: string;
  defaultMod: boolean;
}
export interface EditorPosition {
  line: number;
  ch: number;
}
export interface TFile {
  path: string;
}

// Mock editorLivePreviewField
export const editorLivePreviewField = {
  init: jest.fn(() => ({
    provide: () => true
  }))
};