import { DEFAULT_EXPORT_PROFILES } from './settings/defaultProfiles';
import type { ExportProfile } from './export/types';
import {
    compileProfileDraft,
    createDefaultPandocRows,
    createProfileDraft,
    createProfileDrafts
} from './profileDraft';
import type {
    PandocOptionCatalog,
    ProfileDraft
} from './types';

interface PresetEntry {
    draft: ProfileDraft;
    savedDraft?: ProfileDraft;
    defaultDraft?: ProfileDraft;
    defaultProfile?: ExportProfile;
    deleted: boolean;
}

export class PandocPresetManager {
    private readonly entries: PresetEntry[];
    private selectedId: string;

    constructor(
        profiles: ExportProfile[],
        defaultProfiles: ExportProfile[] = DEFAULT_EXPORT_PROFILES
    ) {
        const defaultProfileMap = new Map(defaultProfiles.map(profile => [profile.id, profile]));
        const defaultDrafts = new Map(createProfileDrafts(defaultProfiles).map(draft => [draft.id, draft]));
        this.entries = createProfileDrafts(profiles).map(draft => ({
            draft,
            savedDraft: cloneDraft(draft),
            defaultDraft: defaultDrafts.get(draft.id) ?
                cloneDraft(defaultDrafts.get(draft.id)!) :
                undefined,
            defaultProfile: defaultProfileMap.get(draft.id) ?
                cloneProfile(defaultProfileMap.get(draft.id)!) :
                undefined,
            deleted: false
        }));
        this.selectedId = this.visibleDrafts()[0]?.id ?? '';
    }

    visibleDrafts(): ProfileDraft[] {
        return this.entries
            .filter(entry => !entry.deleted)
            .map(entry => entry.draft);
    }

    selectedDraft(): ProfileDraft | undefined {
        return this.selectedEntry()?.draft ?? this.visibleDrafts()[0];
    }

    selectedDraftId(): string {
        return this.selectedDraft()?.id ?? '';
    }

    select(id: string): void {
        if (this.entries.some(entry => !entry.deleted && entry.draft.id === id)) {
            this.selectedId = id;
        }
    }

    addPreset(): ProfileDraft {
        const existingNames = this.visibleDrafts().map(draft => draft.name);
        const name = uniqueName('New preset', existingNames);
        const draft: ProfileDraft = {
            id: uniqueId(slugifyName(name), this.allIds()),
            name,
            type: 'pandoc',
            extension: '.html',
            from: '',
            to: '',
            standalone: false,
            resourcePaths: [],
            luaFilters: [],
            metadata: {},
            optionRows: createDefaultPandocRows(),
            customCommandTemplate: '',
            customShell: false
        };
        this.entries.push({ draft, deleted: false });
        this.selectedId = draft.id;
        return draft;
    }

    deleteSelected(): boolean {
        const entry = this.selectedEntry();
        if (!entry || this.visibleDrafts().length <= 1) return false;
        if (entry.savedDraft) {
            entry.deleted = true;
        } else {
            this.entries.splice(this.entries.indexOf(entry), 1);
        }
        this.selectedId = this.visibleDrafts()[0]?.id ?? '';
        return true;
    }

    resetSelected(): boolean {
        const entry = this.selectedEntry();
        if (!entry?.savedDraft || !this.canResetSelected()) return false;
        entry.draft = cloneDraft(entry.savedDraft);
        return true;
    }

    restoreSelected(): boolean {
        const entry = this.selectedEntry();
        if (!entry?.defaultDraft || !this.canRestoreSelected()) return false;
        entry.draft = cloneDraft(entry.defaultDraft);
        return true;
    }

    canResetSelected(): boolean {
        const entry = this.selectedEntry();
        return Boolean(entry?.savedDraft && !sameDraft(entry.draft, entry.savedDraft));
    }

    canDeleteSelected(): boolean {
        return this.visibleDrafts().length > 1;
    }

    canRestoreSelected(): boolean {
        const entry = this.selectedEntry();
        return Boolean(entry?.defaultDraft && !sameDraft(entry.draft, entry.defaultDraft));
    }

    saveSelected(catalog: PandocOptionCatalog): ExportProfile[] {
        const entry = this.selectedEntry();
        if (!entry) return this.compileSavedProfiles(catalog);
        const profile = this.compileEntryDraft(entry, catalog);
        entry.savedDraft = createProfileDraft(profile);
        entry.draft = cloneDraft(entry.savedDraft);
        entry.deleted = false;

        return this.compileSavedProfiles(catalog);
    }

    saveAll(catalog: PandocOptionCatalog): ExportProfile[] {
        const profiles = this.visibleDrafts()
            .map(draft => this.compileEntryDraft(this.entryForDraft(draft), catalog));
        this.entries.splice(0, this.entries.length, ...profiles.map(profile => {
            const draft = createProfileDraft(profile);
            return {
                draft,
                savedDraft: cloneDraft(draft),
                defaultDraft: this.defaultDraftFor(profile.id),
                defaultProfile: this.defaultProfileFor(profile.id),
                deleted: false
            };
        }));
        this.selectedId = this.visibleDrafts()[0]?.id ?? '';
        return profiles;
    }

    isSelectedBuiltIn(): boolean {
        return Boolean(this.selectedEntry()?.defaultDraft);
    }

    private selectedEntry(): PresetEntry | undefined {
        return this.entries.find(entry => !entry.deleted && entry.draft.id === this.selectedId) ??
            this.entries.find(entry => !entry.deleted);
    }

    private compileSavedProfiles(catalog: PandocOptionCatalog): ExportProfile[] {
        return this.entries.flatMap(entry => {
            if (!entry.savedDraft) return [];
            return [this.compileEntrySavedDraft(entry, catalog)];
        });
    }

    private compileEntryDraft(entry: PresetEntry, catalog: PandocOptionCatalog): ExportProfile {
        if (entry.defaultDraft && entry.defaultProfile && sameDraft(entry.draft, entry.defaultDraft)) {
            return cloneProfile(entry.defaultProfile);
        }
        return compileProfileDraft(entry.draft, catalog);
    }

    private compileEntrySavedDraft(entry: PresetEntry, catalog: PandocOptionCatalog): ExportProfile {
        if (entry.defaultDraft && entry.defaultProfile && entry.savedDraft &&
            sameDraft(entry.savedDraft, entry.defaultDraft)) {
            return cloneProfile(entry.defaultProfile);
        }
        return compileProfileDraft(entry.savedDraft!, catalog);
    }

    private allIds(): string[] {
        return this.entries.map(entry => entry.draft.id);
    }

    private defaultDraftFor(id: string): ProfileDraft | undefined {
        const profile = DEFAULT_EXPORT_PROFILES.find(item => item.id === id);
        return profile ? createProfileDraft(profile) : undefined;
    }

    private defaultProfileFor(id: string): ExportProfile | undefined {
        const profile = DEFAULT_EXPORT_PROFILES.find(item => item.id === id);
        return profile ? cloneProfile(profile) : undefined;
    }

    private entryForDraft(draft: ProfileDraft): PresetEntry {
        return this.entries.find(entry => entry.draft === draft)!;
    }
}

function uniqueName(base: string, existing: string[]): string {
    const normalized = new Set(existing.map(name => name.trim().toLowerCase()));
    let candidate = base;
    let index = 2;
    while (normalized.has(candidate.toLowerCase())) {
        candidate = `${base} ${index}`;
        index += 1;
    }
    return candidate;
}

function uniqueId(base: string, existing: string[]): string {
    let candidate = base || 'preset';
    let index = 2;
    while (existing.includes(candidate)) {
        candidate = `${base}-${index}`;
        index += 1;
    }
    return candidate;
}

function slugifyName(name: string): string {
    const slug = name.trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || 'preset';
}

function cloneDraft(draft: ProfileDraft): ProfileDraft {
    return JSON.parse(JSON.stringify(draft)) as ProfileDraft;
}

function cloneProfile(profile: ExportProfile): ExportProfile {
    return JSON.parse(JSON.stringify(profile)) as ExportProfile;
}

function sameDraft(a: ProfileDraft, b: ProfileDraft): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}
