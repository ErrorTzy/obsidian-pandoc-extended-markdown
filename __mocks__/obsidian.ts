export class Plugin {
  loadData() { return Promise.resolve({}); }
  saveData() { return Promise.resolve(); }
  registerEditorExtension() {}
  registerMarkdownPostProcessor() {}
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

export class Modal {}
export class Notice {}
export class PluginSettingTab {}
export class Setting {}
export class App {}
export class MarkdownView {}
export class Editor {}