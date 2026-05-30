interface TooltipOptions {
  delay?: number;
}

interface WorkspaceMock {
  on: jest.Mock;
  getActiveViewOfType: jest.Mock;
  getActiveFile: jest.Mock<TFile | null, []>;
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
  setText: (text: string) => void;
};

type ToggleChangeHandler = (value: boolean) => void | Promise<void>;
type TextChangeHandler = (value: string) => void | Promise<void>;

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
  extended.setText = function setText(text: string) {
    this.textContent = text;
  };
  return extended;
}

export class Plugin {
  app: App;
  manifest: unknown;
  constructor(app: App, manifest: unknown) {
    this.app = app;
    this.manifest = manifest;
  }
  loadData(): Promise<Record<string, unknown>> { return Promise.resolve({}); }
  saveData(): Promise<void> { return Promise.resolve(); }
  registerEditorExtension(): void {}
  registerMarkdownPostProcessor(): void {}
  registerView(): void {}
  addRibbonIcon(): void {}
  registerEditorSuggest(): void {}
  addSettingTab(): void {}
  addCommand = jest.fn();
  registerEvent(): void {}
  registerHoverLinkSource(): void {}
}

export function setTooltip(element: HTMLElement, text: string, _options?: TooltipOptions) {
  // Mock implementation - just set a data attribute for testing
  element.setAttribute('data-tooltip', text);
}

export function renderMath(source: string, display: boolean): HTMLElement {
  const element = document.createElement('span');
  element.className = display ? 'math math-block' : 'math math-inline';
  element.textContent = source;
  return element;
}

export function finishRenderMath(): Promise<void> {
  return Promise.resolve();
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

export class Modal {
  app: App;
  modalEl: ExtendedElement;
  titleEl: ExtendedElement;
  contentEl: ExtendedElement;
  containerEl: ExtendedElement;

  constructor(app: App) {
    this.app = app;
    this.containerEl = enhanceElement(document.createElement('div'));
    this.modalEl = this.containerEl;
    this.titleEl = this.containerEl.createDiv({ cls: 'modal-title' });
    this.contentEl = this.containerEl.createDiv({ cls: 'modal-content' });
  }

  open(): void { this.onOpen(); }
  close(): void { this.onClose(); }
  onOpen(): void {}
  onClose(): void {}
}
export class Notice {
  message: string;
  timeout?: number;
  constructor(message: string, timeout?: number) {
    this.message = message;
    this.timeout = timeout;
  }
}
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

class TextComponent {
  inputEl: HTMLInputElement;

  constructor(containerEl: HTMLElement) {
    this.inputEl = document.createElement('input');
    containerEl.appendChild(this.inputEl);
  }

  setValue(value: string): this {
    this.inputEl.value = value;
    return this;
  }

  setPlaceholder(value: string): this {
    this.inputEl.placeholder = value;
    return this;
  }

  setDisabled(value: boolean): this {
    this.inputEl.disabled = value;
    return this;
  }

  onChange(callback: TextChangeHandler): this {
    this.inputEl.addEventListener('input', () => {
      void callback(this.inputEl.value);
    });
    return this;
  }
}

class TextAreaComponent {
  inputEl: HTMLTextAreaElement;

  constructor(containerEl: HTMLElement) {
    this.inputEl = document.createElement('textarea');
    containerEl.appendChild(this.inputEl);
  }

  setValue(value: string): this {
    this.inputEl.value = value;
    return this;
  }

  onChange(callback: TextChangeHandler): this {
    this.inputEl.addEventListener('input', () => {
      void callback(this.inputEl.value);
    });
    return this;
  }
}

class DropdownComponent {
  selectEl: HTMLSelectElement;

  constructor(containerEl: HTMLElement) {
    this.selectEl = document.createElement('select');
    containerEl.appendChild(this.selectEl);
  }

  addOptions(options: Record<string, string>): this {
    Object.entries(options).forEach(([value, text]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      this.selectEl.appendChild(option);
    });
    return this;
  }

  setValue(value: string): this {
    this.selectEl.value = value;
    return this;
  }

  onChange(callback: TextChangeHandler): this {
    this.selectEl.addEventListener('change', () => {
      void callback(this.selectEl.value);
    });
    return this;
  }
}

class ButtonComponent {
  buttonEl: HTMLButtonElement;

  constructor(containerEl: HTMLElement) {
    this.buttonEl = document.createElement('button');
    containerEl.appendChild(this.buttonEl);
  }

  setButtonText(value: string): this {
    this.buttonEl.textContent = value;
    return this;
  }

  setCta(): this {
    this.buttonEl.classList.add('mod-cta');
    return this;
  }

  onClick(callback: () => void | Promise<void>): this {
    this.buttonEl.addEventListener('click', () => {
      void callback();
    });
    return this;
  }
}

class ExtraButtonComponent extends ButtonComponent {
  setIcon(value: string): this {
    this.buttonEl.dataset.icon = value;
    return this;
  }

  setTooltip(value: string): this {
    this.buttonEl.title = value;
    return this;
  }
}

export class Setting {
  settingEl: ExtendedElement;
  infoEl: ExtendedElement;
  controlEl: ExtendedElement;
  components: unknown[] = [];

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
    const component = new ToggleComponent(this.controlEl);
    this.components.push(component);
    callback(component);
    return this;
  }

  addText(callback: (text: TextComponent) => void): this {
    const component = new TextComponent(this.controlEl);
    this.components.push(component);
    callback(component);
    return this;
  }

  addTextArea(callback: (text: TextAreaComponent) => void): this {
    const component = new TextAreaComponent(this.controlEl);
    this.components.push(component);
    callback(component);
    return this;
  }

  addDropdown(callback: (dropdown: DropdownComponent) => void): this {
    const component = new DropdownComponent(this.controlEl);
    this.components.push(component);
    callback(component);
    return this;
  }

  addButton(callback: (button: ButtonComponent) => void): this {
    const component = new ButtonComponent(this.controlEl);
    this.components.push(component);
    callback(component);
    return this;
  }

  addExtraButton(callback: (button: ExtraButtonComponent) => void): this {
    const component = new ExtraButtonComponent(this.controlEl);
    this.components.push(component);
    callback(component);
    return this;
  }
}
export class App {
  workspace: WorkspaceMock = {
    on: jest.fn(),
    getActiveViewOfType: jest.fn(),
    getActiveFile: jest.fn<TFile | null, []>().mockReturnValue(null),
    getLeavesOfType: jest.fn<WorkspaceLeaf[], [string]>().mockReturnValue([]),
    getRightLeaf: jest.fn<WorkspaceLeaf | null, [boolean]>().mockReturnValue(null),
    revealLeaf: jest.fn(),
    detachLeavesOfType: jest.fn(),
    trigger: jest.fn(),
    setActiveLeaf: jest.fn(),
    updateOptions: jest.fn()
  };
  vault = {
    adapter: {
      getBasePath: jest.fn(() => '/vault'),
      getFullPath: jest.fn((path: string) => `/vault/${path}`),
      exists: jest.fn(() => Promise.resolve(false)),
      mkdir: jest.fn(() => Promise.resolve()),
      write: jest.fn(() => Promise.resolve())
    },
    config: {}
  };
  metadataCache = {
    getCache: jest.fn(() => null),
    getFirstLinkpathDest: jest.fn(() => null)
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
export class TAbstractFile {
  path: string;
  name: string;
  constructor(path = '') {
    this.path = path;
    this.name = path.split('/').pop() ?? path;
  }
}
export class TFile extends TAbstractFile {
  basename: string;
  constructor(path = '') {
    super(path);
    this.basename = this.name.replace(/\.[^.]+$/, '');
  }
}
export class Menu {
  addItem(callback: (item: MenuItem) => void): this {
    callback(new MenuItem());
    return this;
  }
  addSeparator(): this { return this; }
}
class MenuItem {
  setTitle(): this { return this; }
  setIcon(): this { return this; }
  onClick(): this { return this; }
}
export const Platform = {
  isDesktop: true
};

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

// Mock editorLivePreviewField
export const editorLivePreviewField = {
  init: jest.fn(() => ({
    provide: () => true
  }))
};
