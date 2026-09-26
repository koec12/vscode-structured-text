/**
 * Structured Text / SCL formatter implementing the programming guideline
 * (see README for the rule list). Pure - no VS Code dependencies.
 */
import { analyze } from '../language/analysis';
import type { Dialect } from '../language/dialect';
import { tokenize } from '../language/lexer';
import { applyCasing } from './casing';
import { Layout } from './layout';
import { DEFAULT_FORMAT_OPTIONS, type FormatOptions } from './options';
import { reorderVarSections } from './reorder';
import { verifyEquivalent, verifySameTokens } from './verify';

export { DEFAULT_FORMAT_OPTIONS, type FormatOptions } from './options';

export interface FormatResult {
    text: string;
    ok: boolean;
    error?: string;
}

export function detectEol(src: string): string {
    const m = /\r\n|\n|\r/.exec(src);
    return m ? m[0] : '\n';
}

export function format(src: string, dialect: Dialect, options: Partial<FormatOptions> = {}): FormatResult {
    const o: FormatOptions = { ...DEFAULT_FORMAT_OPTIONS, ...options };
    try {
        let input = src;
        if (o.reorderVarSections) {
            const reordered = reorderVarSections(src, dialect);
            const check = verifySameTokens(src, reordered, dialect);
            if (!check.ok) {
                return { text: src, ok: false, error: check.message };
            }
            input = reordered;
        }
        const raw = tokenize(input, dialect);
        const analysis = analyze(raw, dialect);
        const tokens = applyCasing(raw, analysis, dialect, o);
        const text = new Layout(tokens, analysis, dialect, o).format(detectEol(src));
        const check = verifyEquivalent(input, text, dialect);
        if (!check.ok) {
            return { text: src, ok: false, error: check.message };
        }
        return { text, ok: true };
    } catch (e) {
        return { text: src, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}
