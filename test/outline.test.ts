import { describe, expect, it } from 'vitest';
import { computeChanges } from '../src/formatter/edits';
import { SCL, ST } from '../src/language/dialect';
import { tokenize } from '../src/language/lexer';
import { documentSymbols, foldingRanges } from '../src/language/outline';
import { parseStructure } from '../src/language/structure';

const src = [
    '(* header',
    '   line *)',
    'FUNCTION_BLOCK fbX',
    'VAR_INPUT',
    '    ibA, ibB : BOOL;',
    'END_VAR',
    '// one',
    '// two',
    'IF ibA THEN',
    '    x := 1;',
    'END_IF',
    '{region "Outputs"}',
    'q := 1;',
    '{endregion}',
    'METHOD mRun : BOOL',
    'END_METHOD',
    'END_FUNCTION_BLOCK',
    'TYPE eColor : (Red, Green); END_TYPE',
].join('\n');

describe('outline', () => {
    const tokens = tokenize(src, ST);
    const root = parseStructure(tokens, ST);
    it('folding ranges', () => {
        const ranges = foldingRanges(tokens, root).map((r) => `${r.start}-${r.end}${r.kind ? ':' + r.kind : ''}`).sort();
        // METHOD (14-15) has no body to fold; END_ lines stay visible
        expect(ranges).toEqual(['0-1:comment', '11-13:region', '2-15', '3-4', '6-7:comment', '8-9']);
    });
    it('document symbols', () => {
        const syms = documentSymbols(root);
        expect(syms.map((s) => `${s.kind}:${s.name}`)).toEqual(['class:fbX', 'enum:eColor']);
        const fb = syms[0];
        expect(fb.children.map((c) => `${c.kind}:${c.name}`)).toEqual(['package:VAR_INPUT', 'method:mRun']);
        expect(fb.children[0].children.map((c) => `${c.kind}:${c.name}:${c.detail}`)).toEqual(['variable:ibA:BOOL', 'variable:ibB:BOOL']);
        expect(fb.children[1].detail).toBe('METHOD : BOOL');
    });
    it('SCL regions appear in the outline', () => {
        const s = 'FUNCTION "fcX" : Void\nBEGIN\nREGION Inputs\n#a := 1;\nEND_REGION\nEND_FUNCTION\n';
        const syms = documentSymbols(parseStructure(tokenize(s, SCL), SCL));
        expect(syms[0].children.map((c) => `${c.kind}:${c.name}`)).toEqual(['namespace:Inputs']);
    });
});

describe('edits', () => {
    const apply = (oldText: string, newText: string) => {
        let out = oldText;
        for (const c of computeChanges(oldText, newText).reverse()) {
            out = out.slice(0, c.start) + c.text + out.slice(c.end);
        }
        return out;
    };
    it.each([
        ['a\nb\nc\n', 'a\nB\nc\n'],
        ['a\nb\nc', 'a\nb\nc\n'],
        ['a\n\n\nb\n', 'a\n\nb\n'],
        ['x\r\ny\r\n', 'x\r\n  y\r\nz\r\n'],
        ['', 'a\n'],
        ['a\n', ''],
    ])('%j -> %j', (a, b) => {
        expect(apply(a, b)).toBe(b);
    });
    it('only touches changed lines', () => {
        const changes = computeChanges('a\nb\nc\nd\n', 'a\nb\nC\nd\n');
        expect(changes).toEqual([{ start: 4, end: 6, text: 'C\n' }]);
    });
});
