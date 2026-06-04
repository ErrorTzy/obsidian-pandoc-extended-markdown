export const WINDOWS_PANDOC_ENV_DEFAULTS: Record<string, string> = {
    PATH: '${HOME}\\AppData\\Local\\Pandoc;${PATH}',
    TEXINPUTS: '${pluginDir}/textemplate/;'
};
