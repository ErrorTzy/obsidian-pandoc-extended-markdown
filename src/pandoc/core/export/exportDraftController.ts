import {
    buildProfileDraftPreview
} from '../preview';
import type {
    PandocCommandPreviewPlatform
} from '../preview';
import {
    compileProfileDraft,
    createProfileDraft
} from '../profileDraft';
import type {
    CommandPreview,
    PandocOptionCatalog,
    ProfileDraft,
    ValidationIssue
} from '../types';
import {
    validateProfileDraft
} from '../validation';
import {
    renderExportTemplate
} from '../templates/template';
import {
    basename,
    dirname
} from '../utils/pathUtils';
import type {
    ExportProfile,
    ExportVariables,
    PandocExportRequest,
    PandocExportSettings
} from './types';

export interface PandocExportDraftControllerConfig {
    profiles: ExportProfile[];
    catalog: PandocOptionCatalog;
    currentFileBaseName: string;
    initialProfileId?: string;
    initialOutputFolder: string;
    initialOverwrite: boolean;
    commandPreviewPlatform?: PandocCommandPreviewPlatform;
}

export interface PandocExportOutputTarget {
    outputFolder: string;
    outputFileName: string;
}

export interface PandocExportDraftCurrentFile {
    path: string;
    name: string;
    basename: string;
}

export class PandocExportDraftController {
    private readonly profiles: ExportProfile[];
    private readonly catalog: PandocOptionCatalog;
    private draft: ProfileDraft;
    private outputFolder: string;
    private outputFileName: string;
    private overwrite: boolean;
    private optionIndex = 0;
    private readonly commandPreviewPlatform: PandocCommandPreviewPlatform;

    constructor(config: PandocExportDraftControllerConfig) {
        this.profiles = [...config.profiles];
        this.catalog = config.catalog;
        this.draft = createProfileDraft(selectInitialProfile(config));
        this.outputFolder = config.initialOutputFolder;
        this.outputFileName = `${config.currentFileBaseName}${this.currentProfile().extension}`;
        this.overwrite = config.initialOverwrite;
        this.commandPreviewPlatform = config.commandPreviewPlatform ?? 'posix';
    }

    currentDraft(): ProfileDraft {
        return this.draft;
    }

    currentProfile(): ExportProfile {
        return compileProfileDraft(this.draft, this.catalog);
    }

    currentOverwrite(): boolean {
        return this.overwrite;
    }

    setOverwrite(value: boolean): void {
        this.overwrite = value;
    }

    nextOptionIndex(): number {
        this.optionIndex += 1;
        return this.optionIndex - 1;
    }

    selectProfile(profileId: string): ProfileDraft | undefined {
        const profile = this.profiles.find(item => item.id === profileId);
        if (!profile) return undefined;

        this.draft = createProfileDraft(profile);
        this.outputFileName = replaceExtension(this.outputFileName, this.currentProfile().extension);
        return this.draft;
    }

    outputTarget(variables: ExportVariables): PandocExportOutputTarget {
        const profile = this.currentProfile();
        const outputPath = renderExportTemplate(
            profile.type === 'pandoc' ? profile.outputPath ?? '${outputPath}' : '${outputPath}',
            variables
        );

        return {
            outputFolder: dirname(outputPath),
            outputFileName: basename(outputPath)
        };
    }

    exportRequest(
        currentFile: PandocExportDraftCurrentFile,
        variables: ExportVariables
    ): PandocExportRequest {
        const profile = this.currentProfile();
        const target = this.outputTarget(variables);

        return {
            currentFilePath: currentFile.path,
            currentFileName: currentFile.name,
            currentFileBaseName: currentFile.basename,
            profileId: profile.id,
            outputFolder: target.outputFolder,
            outputFileName: target.outputFileName,
            overwrite: this.overwrite
        };
    }

    recordSuccessfulExport(settings: PandocExportSettings, outputPath?: string): void {
        if (!outputPath) return;

        settings.lastExportProfileId = this.currentProfile().id;
        settings.lastOutputFolder = dirname(outputPath);
    }

    outputFileNameForProfile(): string {
        return replaceExtension(this.outputFileName, this.currentProfile().extension);
    }

    validationIssues(knownTemplateNames: string[]): ValidationIssue[] {
        return validateProfileDraft(this.draft, this.catalog, knownTemplateNames);
    }

    commandPreview(variables: ExportVariables): CommandPreview {
        return buildProfileDraftPreview(
            this.draft,
            this.catalog,
            variables,
            this.commandPreviewPlatform
        );
    }

    updateOutputFolder(value: string): void {
        this.outputFolder = value;
    }

    updateOutputFileName(value: string): void {
        this.outputFileName = value;
    }

    currentOutputFolder(): string {
        return this.outputFolder;
    }

    currentOutputFileName(): string {
        return this.outputFileName;
    }
}

function selectInitialProfile(config: PandocExportDraftControllerConfig): ExportProfile {
    const profile = config.profiles.find(item => item.id === config.initialProfileId) ??
        config.profiles[0];
    if (!profile) {
        throw new Error('Pandoc export profile not found.');
    }

    return profile;
}

export function replaceExportFileExtension(fileName: string, extension: string): string {
    return replaceExtension(fileName, extension);
}

function replaceExtension(fileName: string, extension: string): string {
    const index = fileName.lastIndexOf('.');
    if (index <= 0) {
        return `${fileName}${extension}`;
    }

    return `${fileName.slice(0, index)}${extension}`;
}
