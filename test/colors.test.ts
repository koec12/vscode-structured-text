import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const grammarText = ['syntaxes/st.tmLanguage.json', 'syntaxes/scl.tmLanguage.json'].map((f) => readFileSync(f, 'utf8')).join('\n');
const custom = pkg.contributes.configurationDefaults['editor.tokenColorCustomizations'];

describe('default operator colours', () => {
    const sets = [custom.textMateRules, custom['[*Light*]'].textMateRules];

    it('only reference scopes the grammars produce', () => {
        for (const rules of sets) {
            for (const r of rules) {
                for (const scope of r.scope) {
                    expect(grammarText).toContain(`"${scope}"`);
                }
            }
        }
    });

    it('give assignment, comparison and logical operators different colours', () => {
        for (const rules of sets) {
            const colours = rules.map((r: { settings: { foreground: string } }) => r.settings.foreground.toLowerCase());
            expect(colours).toHaveLength(3);
            expect(new Set(colours).size).toBe(3);
        }
    });
});
