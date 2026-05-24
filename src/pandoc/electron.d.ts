declare module 'electron' {
    export const remote: {
        dialog: {
            showOpenDialog(options: {
                defaultPath?: string;
                properties: string[];
            }): Promise<{ canceled: boolean; filePaths: string[] }>;
            showSaveDialog(options: {
                defaultPath: string;
                properties: string[];
            }): Promise<{ canceled: boolean; filePath?: string }>;
        };
        shell: {
            openPath(path: string): Promise<string>;
            showItemInFolder(path: string): void;
        };
    };
}
