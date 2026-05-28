import type { OptionSpec, PandocOptionCatalog } from './types';

export interface OptionSearchResult {
    option: OptionSpec;
    score: number;
}

export function searchOptions(
    catalog: PandocOptionCatalog,
    query: string,
    limit = 20,
    fuzzy = false
): OptionSearchResult[] {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) {
        return catalog.options.slice(0, limit).map(option => ({ option, score: 1 }));
    }

    return catalog.options
        .map(option => ({ option, score: scoreOption(option, normalizedQuery, fuzzy) }))
        .filter(result => result.score > 0)
        .sort((a, b) => b.score - a.score || a.option.name.localeCompare(b.option.name))
        .slice(0, limit);
}

export function searchOptionKeys(
    catalog: PandocOptionCatalog,
    query: string,
    limit = 8
): OptionSearchResult[] {
    const normalizedQuery = normalizeKey(query);
    if (!normalizedQuery) return [];

    return catalog.options
        .map(option => ({ option, score: scoreOptionKeys(option, normalizedQuery) }))
        .filter(result => result.score > 0)
        .sort((a, b) => b.score - a.score || a.option.name.localeCompare(b.option.name))
        .slice(0, limit);
}

export function optionLabel(option: OptionSpec): string {
    const tokens = [option.key, ...option.aliases];
    const alias = tokens.find(item => item.length === 2);
    const long = tokens.find(item => item.startsWith('--'));
    const suffix = option.valuePlaceholder ? ` ${option.valuePlaceholder}` : '';
    if (alias && long) return `${alias}, ${long}${suffix}`;
    return `${option.key}${suffix}`;
}

function scoreOptionKeys(option: OptionSpec, query: string): number {
    const tokens = [option.key, ...option.aliases].map(normalizeKey);
    const scores = tokens.map(token => {
        if (token === query) return 100;
        if (token.startsWith(query)) return 80;
        return token.includes(query) ? 50 : 0;
    });

    return Math.max(...scores);
}

function scoreOption(option: OptionSpec, query: string, fuzzy: boolean): number {
    const tokens = [option.key, ...option.aliases, option.name];
    const tokenScore = Math.max(...tokens.map(token => scoreToken(normalize(token), query, fuzzy)));
    const descriptionScore = scoreText(normalize(option.description), query, fuzzy);

    return Math.max(tokenScore, descriptionScore);
}

function scoreToken(token: string, query: string, fuzzy: boolean): number {
    if (token === query || token.replace(/^--?/, '') === query) return 100;
    if (token.startsWith(query)) return 80;
    if (token.includes(query)) return 60;
    if (!fuzzy) return 0;
    return fuzzyScore(token, query);
}

function scoreText(text: string, query: string, fuzzy: boolean): number {
    if (!text) return 0;
    if (text.includes(query)) return 35;
    if (!fuzzy) return 0;
    return fuzzyScore(text, query) > 0 ? 15 : 0;
}

function fuzzyScore(text: string, query: string): number {
    let position = 0;
    let score = 0;

    for (const char of query) {
        const found = text.indexOf(char, position);
        if (found < 0) return 0;
        score += found === position ? 4 : 1;
        position = found + 1;
    }

    return Math.max(1, score);
}

function normalize(value: string): string {
    return value.trim().toLowerCase();
}

function normalizeKey(value: string): string {
    return normalize(value).replace(/^--?/, '');
}
