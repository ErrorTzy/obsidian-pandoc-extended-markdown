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
  updateOptions: jest.Mock;
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

type ToggleChangeHandler = (value: boolean) => void | Promise<void>;

function ensureCssHelpers(): void {
  const toKebabCase = (property: string) =>
    property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);

  if (typeof HTMLElement !== 'undefined') {
    const elementProto = HTMLElement.prototype as HTMLElement & {
      setCssProps?: (props: Record<string, string>) => void;
    };
    if (typeof elementProto.setCssProps !== 'function') {
      elementProto.setCssProps = function setCssProps(props: Record<string, string>) {
        Object.entries(props).forEach(([property, value]) => {
          this.style.setProperty(toKebabCase(property), value);
        });
      };
    }
  }

  if (typeof SVGElement !== 'undefined') {
    const svgProto = SVGElement.prototype as SVGElement & {
      setCssProps?: (props: Record<string, string>) => void;
    };
    if (typeof svgProto.setCssProps !== 'function') {
      svgProto.setCssProps = function setCssProps(props: Record<string, string>) {
        Object.entries(props).forEach(([property, value]) => {
          this.style.setProperty(toKebabCase(property), value);
        });
      };
    }
  }
}

ensureCssHelpers();

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
export class PluginSettingTab {
  app: App;
  plugin: unknown;
  containerEl: ExtendedElement;

  constructor(app: App, plugin: unknown) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = enhanceElement(document.createElement('div'));
  }
}

class ToggleComponent {
  private inputEl: HTMLInputElement;

  constructor(containerEl: HTMLElement) {
    this.inputEl = document.createElement('input');
    this.inputEl.type = 'checkbox';
    containerEl.appendChild(this.inputEl);
  }

  setValue(value: boolean): this {
    this.inputEl.checked = value;
    return this;
  }

  onChange(callback: ToggleChangeHandler): this {
    this.inputEl.addEventListener('change', () => {
      void callback(this.inputEl.checked);
    });
    return this;
  }
}

export class Setting {
  settingEl: ExtendedElement;
  infoEl: ExtendedElement;
  controlEl: ExtendedElement;

  constructor(containerEl: HTMLElement) {
    this.settingEl = enhanceElement(document.createElement('div'));
    this.settingEl.className = 'setting-item';
    this.infoEl = this.settingEl.createDiv({ cls: 'setting-item-info' });
    this.controlEl = this.settingEl.createDiv({ cls: 'setting-item-control' });
    containerEl.appendChild(this.settingEl);
  }

  setName(name: string): this {
    this.infoEl.createDiv({ text: name, cls: 'setting-item-name' });
    return this;
  }

  setDesc(description: string): this {
    this.infoEl.createDiv({ text: description, cls: 'setting-item-description' });
    return this;
  }

  setHeading(): this {
    this.settingEl.classList.add('setting-item-heading');
    return this;
  }

  addToggle(callback: (toggle: ToggleComponent) => void): this {
    callback(new ToggleComponent(this.controlEl));
    return this;
  }
}
export class App {
  workspace: WorkspaceMock = {
    on: jest.fn(),
    getActiveViewOfType: jest.fn(),
    getLeavesOfType: jest.fn<WorkspaceLeaf[], [string]>().mockReturnValue([]),
    getRightLeaf: jest.fn<WorkspaceLeaf | null, [boolean]>().mockReturnValue(null),
    revealLeaf: jest.fn(),
    detachLeavesOfType: jest.fn(),
    trigger: jest.fn(),
    setActiveLeaf: jest.fn(),
    updateOptions: jest.fn()
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
