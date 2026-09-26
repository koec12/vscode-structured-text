import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { format } from '../src/formatter';
import { verifyEquivalent } from '../src/formatter/verify';
import { SCL, ST } from '../src/language/dialect';

const dir = 'test/format/fixtures';
const dialectOf = (f: string) => (f.endsWith('.scl') ? SCL : ST);
const fmt = (src: string, opts = {}, d = ST) => {
    const r = format(src, d, opts);
    expect(r.error).toBeUndefined();
    return r.text;
};

describe('golden fixtures', () => {
    for (const f of readdirSync(dir).filter((x) => x.includes('.input.'))) {
        const d = dialectOf(f);
        const input = readFileSync(join(dir, f), 'utf8');
        const expected = readFileSync(join(dir, f.replace('.input.', '.expected.')), 'utf8');
        it(`${f} matches expected output`, () => {
            expect(fmt(input, {}, d)).toBe(expected);
        });
        it(`${f} is idempotent`, () => {
            expect(fmt(expected, {}, d)).toBe(expected);
        });
        it(`${f} survives whitespace mangling`, () => {
            // add random extra spaces / indentation - result must still verify and be stable
            let seed = 42;
            const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
            const mangled = input.replace(/ +/g, (m) => m + ' '.repeat(Math.floor(rnd() * 3))).replace(/^/gm, () => ' '.repeat(Math.floor(rnd() * 5)));
            const out = fmt(mangled, {}, d);
            expect(verifyEquivalent(mangled, out, d).ok).toBe(true);
            expect(fmt(out, {}, d)).toBe(out);
        });
    }
});

describe('options', () => {
    it('lower-case keywords', () => {
        expect(fmt('IF a AND b THEN x := TRUE; ELSIF c THEN y := 1; END_IF', { keywordCase: 'lower', booleanLiteralCase: 'upper' })).toBe(
            'if a and b then\n    x := TRUE;\nelsif c then\n    y := 1;\nend_if\n',
        );
    });
    it('preserve casing', () => {
        const src = 'IF a THEN\n    x := int_to_word(b);\nEnd_if\n';
        expect(fmt(src, { keywordCase: 'preserve', builtinFunctionCase: 'preserve', dataTypeCase: 'preserve' })).toBe(src);
    });
    it('does not recase user identifiers that look like conversions or built-ins without call', () => {
        expect(fmt('max := MAP_TO_OUTPUT(a);\n')).toBe('max := MAP_TO_OUTPUT(a);\n');
    });
    it('fixed assignment column', () => {
        expect(fmt('a := 1;\nlonger := 2;\n', { assignmentAlignColumn: 12 })).toBe('a          := 1;\nlonger     := 2;\n');
    });
    it('assignment max column prevents outliers', () => {
        expect(fmt('a := 1;\nsAVeryLongStructureName.sMember.iValue := 2;\nb := 3;\n', { assignmentMaxColumn: 20 })).toBe(
            'a := 1;\nsAVeryLongStructureName.sMember.iValue := 2;\nb := 3;\n',
        );
    });
    it('no alignment', () => {
        expect(fmt('a := 1;\nlonger := 2;\n', { alignAssignments: false })).toBe('a := 1;\nlonger := 2;\n');
    });
    it('keeps statements on one line when splitting is off', () => {
        expect(fmt('a := 1; b := 2;\n', { splitStatements: false })).toBe('a := 1; b := 2;\n');
    });
    it('indents POU bodies on request', () => {
        expect(fmt('PROGRAM prgMain\nVAR\nx : INT;\nEND_VAR\nx := 1;\nEND_PROGRAM\n', { indentPouBody: true })).toBe(
            'PROGRAM prgMain\n    VAR\n        x : Int;\n    END_VAR\n    x := 1;\nEND_PROGRAM\n',
        );
    });
    it('expands calls with many named arguments in guideline-always mode', () => {
        expect(fmt('sFb(a := 1, b := 2, c := 3);\nsFb(a := 1);\n', { callStyle: 'guideline-always' })).toBe(
            'sFb\n    (\n    a := 1,\n    b := 2,\n    c := 3\n    );\nsFb(a := 1);\n',
        );
    });
    it('keeps call layout in preserve mode', () => {
        const src = 'sFb(a := 1,\n    b := 2);\n';
        expect(fmt(src, { callStyle: 'preserve' })).toBe(src);
    });
    it('reorders VAR sections on request', () => {
        const src = [
            'FUNCTION_BLOCK fbX',
            'VAR_TEMP',
            '    tbA : Bool;',
            'END_VAR',
            '',
            '// outputs',
            'VAR_OUTPUT',
            '    qbA : Bool;',
            'END_VAR',
            'VAR CONSTANT',
            '    ciA : Int := 1;',
            'END_VAR',
            'VAR_INPUT',
            '    ibA : Bool;',
            'END_VAR',
            'END_FUNCTION_BLOCK',
            '',
        ].join('\n');
        expect(fmt(src, { reorderVarSections: true })).toBe(
            [
                'FUNCTION_BLOCK fbX',
                'VAR CONSTANT',
                '    ciA : Int := 1;',
                'END_VAR',
                '',
                'VAR_INPUT',
                '    ibA : Bool;',
                'END_VAR',
                '',
                '// outputs',
                'VAR_OUTPUT',
                '    qbA : Bool;',
                'END_VAR',
                '',
                'VAR_TEMP',
                '    tbA : Bool;',
                'END_VAR',
                'END_FUNCTION_BLOCK',
                '',
            ].join('\n'),
        );
    });
    it('uses tabs when the editor does', () => {
        expect(fmt('IF a THEN\nx := 1;\nEND_IF\n', { indentUnit: '\t' })).toBe('If a Then\n\tx := 1;\nEnd_If\n');
    });
    it('preserves CRLF line endings', () => {
        expect(fmt('IF a THEN\r\nx := 1;\r\nEND_IF\r\n')).toBe('If a Then\r\n    x := 1;\r\nEnd_If\r\n');
    });
    it('limits blank lines', () => {
        expect(fmt('a := 1;\n\n\n\nb := 2;\n', { maxBlankLines: 1 })).toBe('a := 1;\n\nb := 2;\n');
    });
});

describe('spacing', () => {
    it.each([
        ['x:=a+b*c;', 'x := a + b * c;'],
        ['x := - a;', 'x := -a;'],
        ['x := a-(-b);', 'x := a - (-b);'],
        ['x := arr [ i ] . member ;', 'x := arr[i].member;'],
        ['p^ := 5;', 'p^ := 5;'],
        ['x := p^.a;', 'x := p^.a;'],
        ['x := NOT(a);', 'x := Not (a);'],
        ['x := fn ( a , b );', 'x := fn(a, b);'],
        ['bOut S= bIn;', 'bOut S= bIn;'],
        ['y := x.1;', 'y := x.1;'],
        ['s := CONCAT(\'a\',\'b\');', "s := Concat('a', 'b');"],
        ['t := T#1s+T#2s;', 't := T#1s + T#2s;'],
        ['x := a**2;', 'x := a ** 2;'],
        ['x := a<>b;', 'x := a <> b;'],
        ['x := 5;//c', 'x := 5; //c'],
        ['x := (* inline *) 5;', 'x := (* inline *) 5;'],
    ])('%s', (src, out) => {
        expect(fmt(src + '\n')).toBe(out + '\n');
    });
    it('keeps array ranges and initialisers tight', () => {
        expect(fmt('VAR\na : ARRAY [ 1 .. 10 ] OF INT := [ 10 ( 0 ) ];\nEND_VAR\n')).toBe('VAR\n    a : ARRAY[1..10] OF Int := [10(0)];\nEND_VAR\n');
    });
});

describe('safety', () => {
    it('refuses output that would change tokens', () => {
        expect(verifyEquivalent('a := b;', 'a := c;', ST).ok).toBe(false);
        expect(verifyEquivalent('a := b;', 'A:=B;', ST).ok).toBe(true);
    });
    it('does not crash on incomplete code', () => {
        for (const src of ['IF a THEN', 'END_IF END_CASE', 'x := (a + ', "s := 'unterminated", '(* open comment', 'CASE x OF 1:', 'VAR a : INT']) {
            const r = format(src, ST);
            expect(r.ok).toBe(true);
            expect(verifyEquivalent(src, r.text, ST).ok).toBe(true);
        }
    });
    it('keeps multi-line block comments verbatim', () => {
        const src = '    (* header\n       | keep |\n    *)\nx := 1;\n';
        expect(fmt(src)).toBe(src);
    });
});
