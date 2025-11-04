interface TooltipOptions {
  delay?: number;
}

interface WorkspaceMock {
  on: jest.Mock;
  getActiveViewOfType: jest.Mock;
  getLeavesOfType: jest.Mock<WorkspaceLeaf[], [string]>;
  getRightLeaf: jest.Mock<WorkspaceLeaf | null, [boolean]>;
  revealLeaf: jest.Mock<void, [WorkspaceLeaf]>;
  detachLeavesOfType: jest.Mock<void, [string]>;
  trigger: jest.Mock;
  setActiveLeaf: jest.Mock<void, [WorkspaceLeaf, { focus: boolean }]>;
}

interface CreateElOptions {
  text?: string;
  cls?: string;
  attr?: Record<string, string>;
}

type ExtendedElement = HTMLElement & {
  empty: () => void;
  createEl: (tag: string, opts?: CreateElOptions) => ExtendedElement;
  createDiv: (opts?: CreateElOptions) => ExtendedElement;
  createSpan: (opts?: CreateElOptions) => ExtendedElement;
  addClass: (cls: string) => void;
  removeClass: (cls: string) => void;
};

function enhanceElement(element: HTMLElement): ExtendedElement {
  const extended = element as ExtendedElement;
  extended.empty = function empty() {
    this.innerHTML = '';
  };
  extended.createEl = function createEl(tag: string, opts?: CreateElOptions) {
    const newEl = enhanceElement(document.createElement(tag));
    if (opts?.text) newEl.textContent = opts.text;
    if (opts?.cls) newEl.className = opts.cls;
    if (opts?.attr) {
      Object.entries(opts.attr).forEach(([key, value]) => {
        newEl.setAttribute(key, value);
      });
    }
    this.appendChild(newEl);
    return newEl;
  };
  extended.createDiv = function createDiv(opts?: CreateElOptions) {
    return this.createEl('div', opts);
  };
  extended.createSpan = function createSpan(opts?: CreateElOptions) {
    return this.createEl('span', opts);
  };
  extended.addClass = function addClass(cls: string) {
    this.classList.add(cls);
  };
  extended.removeClass = function removeClass(cls: string) {
    this.classList.remove(cls);
  };
  return extended;
}

export class Plugin {
  app: App;
  constructor(app: App, _manifest: unknown) {
    this.app = app;
  }
  loadData(): Promise<Record<string, unknown>> { return Promise.resolve({}); }
  saveData(): Promise<void> { return Promise.resolve(); }
  registerEditorExtension(): void {}
  registerMarkdownPostProcessor(): void {}
  registerView(): void {}
  addRibbonIcon(): void {}
  registerEditorSuggest(): void {}
  addSettingTab(): void {}
  addCommand(): void {}
  registerEvent(): void {}
  registerHoverLinkSource(): void {}
}

export function setTooltip(element: HTMLElement, text: string, _options?: TooltipOptions) {
  // Mock implementation - just set a data attribute for testing
  element.setAttribute('data-tooltip', text);
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
  contentEl: ExtendedElement;
  app: App;
  constructor(leaf: WorkspaceLeaf) {
    this.contentEl = enhanceElement(document.createElement('div'));
    this.app = new App();
  }
  onOpen(): Promise<void> { return Promise.resolve(); }
  onClose(): Promise<void> { return Promise.resolve(); }
  getViewType(): string { return ''; }
  getDisplayText(): string { return ''; }
  getIcon(): string { return ''; }
  registerEvent(): void {}
}

export class WorkspaceLeaf {
  app: App;
  view?: MarkdownView;
  constructor(app: App) {
    this.app = app;
  }
  setViewState(): Promise<void> { return Promise.resolve(); }
}

export class Modal {}
export class Notice {}
export class PluginSettingTab {}
export class Setting {}
export class App {
  workspace: WorkspaceMock = {
    on: jest.fn(),
    getActiveViewOfType: jest.fn(),
    getLeavesOfType: jest.fn<WorkspaceLeaf[], [string]>().mockReturnValue([]),
    getRightLeaf: jest.fn<WorkspaceLeaf | null, [boolean]>().mockReturnValue(null),
    revealLeaf: jest.fn(),
    detachLeavesOfType: jest.fn(),
    trigger: jest.fn(),
    setActiveLeaf: jest.fn()
  };
}
export class MarkdownView {
  file: TFile | null = null;
  editor: Editor = new Editor();
}
export class Editor {
  cm?: {
    dom?: HTMLElement;
    contentDOM?: HTMLElement;
  };

  getValue(): string { return ''; }
  setCursor(_pos: EditorPosition): void {}
  scrollIntoView(_range: { from: EditorPosition; to: EditorPosition }, _center?: boolean): void {}
  getLine(): string { return ''; }
  cursorCoords(_force: boolean, _mode?: 'local' | 'page'): { top: number } | null {
    return { top: 0 };
  }
}
export class EditorSuggest {
  constructor(_plugin: unknown) {}
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
