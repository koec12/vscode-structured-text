import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { format } from '../src/formatter';
import { SCL, ST } from '../src/language/dialect';

/** Expand a snippet body with its default placeholder values. */
function expand(body: string[]): string {
    const defaults = new Map<string, string>();
    let text = body.join('\n');
    text = text.replace(/\$\{CURRENT_(YEAR|MONTH|DATE)\}/g, (_, k) => (k === 'YEAR' ? '2026' : '01'));
    for (let guard = 0; guard < 10 && /\$\{\d+[:|]/.test(text); guard++) {
        text = text.replace(/\$\{(\d+):([^${}]*)\}/g, (_, n, d) => (defaults.set(n, d), d));
        text = text.replace(/\$\{(\d+)\|([^|]*)[^}]*\|\}/g, (_, n, d) => (defaults.set(n, d), d));
    }
    return text.replace(/\$\{(\d+)\}/g, (_, n) => defaults.get(n) ?? 'x').replace(/\$\d+/g, '');
}

describe.each([
    ['snippets/st.code-snippets', ST],
    ['snippets/scl.code-snippets', SCL],
])('%s', (file, dialect) => {
    const snippets = JSON.parse(readFileSync(file, 'utf8')) as Record<string, { prefix: string; body: string[] }>;
    for (const [name, s] of Object.entries(snippets)) {
        it(`${name} formats cleanly`, () => {
            const r = format(expand(s.body) + '\n', dialect);
            expect(r.error).toBeUndefined();
        });
    }
});
