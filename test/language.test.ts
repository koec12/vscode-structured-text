import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyze } from '../src/language/analysis';
import { SCL, ST } from '../src/language/dialect';
import { applyCase, isConversionFunction, pascalCase } from '../src/language/keywords';
import { tokenize } from '../src/language/lexer';
import { parseStructure, walk } from '../src/language/structure';

const kinds = (src: string, d = ST) => tokenize(src, d).filter((t) => t.kind !== 'ws').map((t) => `${t.kind}:${t.text}`);

describe('lexer', () => {
    it('is lossless on all fixtures and samples', () => {
        const dirs = ['test/format/fixtures', 'samples'];
        for (const dir of dirs) {
            for (const f of readdirSync(dir)) {
                const src = readFileSync(join(dir, f), 'utf8');
                const d = f.endsWith('.scl') ? SCL : ST;
                expect(tokenize(src, d).map((t) => t.text).join('')).toBe(src);
            }
        }
    });

    it('lexes typed and based literals', () => {
        expect(kinds('x := T#2d4h10s + LTime#0s;')).toEqual(['word:x', 'op::=', 'literal:T#2d4h10s', 'op:+', 'literal:LTime#0s', 'op:;']);
        expect(kinds('B#16#FB DW#16#FFFF_AAAA 16#0F 2#1011_0010 1.5E-3 D#2020-01-01')).toEqual([
            'literal:B#16#FB', 'literal:DW#16#FFFF_AAAA', 'number:16#0F', 'number:2#1011_0010', 'number:1.5E-3', 'literal:D#2020-01-01',
        ]);
        expect(kinds('a[1..10]')).toEqual(['word:a', 'op:[', 'number:1', 'op:..', 'number:10', 'op:]']);
        expect(kinds('T#1s-T#2s')).toEqual(['literal:T#1s', 'op:-', 'literal:T#2s']);
        expect(kinds('E_State#Idle: x')).toEqual(['literal:E_State#Idle', 'op::', 'word:x']);
        expect(kinds("TOD#12:30:15.5")).toEqual(['literal:TOD#12:30:15.5']);
    });

    it('lexes comments, pragmas and strings', () => {
        expect(kinds("(* a (* b *) c *) x")).toEqual(['blockComment:(* a (* b *) c *)', 'word:x']);
        expect(kinds("(* a (* b *) c *) x", SCL)).toEqual(['blockComment:(* a (* b *)', 'word:c', 'op:*', 'op:)', 'word:x']);
        expect(kinds("{attribute 'hide'} s := 'it$'s' + \"w\"; // c")).toEqual([
            "pragma:{attribute 'hide'}", 'word:s', 'op::=', "string:'it$'s'", 'op:+', 'string:"w"', 'op:;', 'lineComment:// c',
        ]);
        expect(kinds('/* c */ x')).toEqual(['blockComment:/* c */', 'word:x']);
    });

    it('lexes SCL locals, quoted identifiers, regions and titles', () => {
        expect(kinds('#a := "DB".x + #"q r";', SCL)).toEqual(['local:#a', 'op::=', 'quotedId:"DB"', 'op:.', 'word:x', 'op:+', 'local:#"q r"', 'op:;']);
        expect(kinds("REGION it's (* odd\nEND_REGION", SCL)).toEqual(['word:REGION', "raw:it's (* odd", 'newline:\n', 'word:END_REGION']);
        expect(kinds("TITLE = Motor's block", SCL)).toEqual(['word:TITLE', 'op:=', "raw:Motor's block"]);
        expect(kinds('%I0.0 %DB1.DBX0.1 %IX0.0.', SCL)).toEqual(['address:%I0.0', 'address:%DB1.DBX0.1', 'address:%IX0.0', 'op:.']);
    });

    it('lexes CODESYS set/reset operators only in ST', () => {
        expect(kinds('b S= a; c R= d; r REF= x;')).toEqual(['word:b', 'op:S=', 'word:a', 'op:;', 'word:c', 'op:R=', 'word:d', 'op:;', 'word:r', 'op:REF=', 'word:x', 'op:;']);
        expect(kinds('S=1', SCL)).toEqual(['word:S', 'op:=', 'number:1']);
    });
});

describe('keywords', () => {
    it('produces Pascal spellings', () => {
        expect(pascalCase('ELSIF')).toBe('Elsif');
        expect(pascalCase('END_IF')).toBe('End_If');
        expect(pascalCase('LTIME_TO_LINT')).toBe('LTime_To_LInt');
        expect(pascalCase('INT_TO_WORD')).toBe('Int_To_Word');
        expect(pascalCase('LREAL')).toBe('LReal');
        expect(applyCase('End_If', 'upper')).toBe('END_IF');
        expect(applyCase('IF', 'lower')).toBe('if');
    });
    it('recognises conversion functions with known operand types only', () => {
        expect(isConversionFunction('LTIME_TO_LINT', 'st')).toBe(true);
        expect(isConversionFunction('TO_INT', 'st')).toBe(true);
        expect(isConversionFunction('MAP_TO_OUTPUT', 'st')).toBe(false);
    });
});

describe('analysis', () => {
    it('detects declaration context and CASE labels', () => {
        const src = 'VAR a : ARRAY[1..2] OF INT; END_VAR\nCASE x OF\n  ciA, ciB: y := 1;\n  1..5: z := 2;\nELSE\n  q := 3;\nEND_CASE';
        const toks = tokenize(src, ST);
        const a = analyze(toks, ST);
        const of = toks.filter((t) => t.text === 'OF');
        expect(a.inDecl[toks.indexOf(of[0])]).toBe(true);
        expect(a.inDecl[toks.indexOf(of[1])]).toBe(false);
        const colons = [...a.labelColons].map((i) => toks[i].line);
        expect(colons).toEqual([2, 3]);
    });
});

describe('structure', () => {
    it('builds POU, VAR and declaration tree', () => {
        const src = [
            'FUNCTION_BLOCK fbTest',
            'VAR_INPUT',
            '    ibStart, ibStop : BOOL; //c',
            '    ixIn AT %IX0.0 : BOOL;',
            'END_VAR',
            'VAR CONSTANT',
            '    ciMax : INT := 5;',
            '    carBuf : ARRAY[1..10] OF REAL := [10(0.0)];',
            'END_VAR',
            'IF ibStart THEN',
            '    FOR i := 1 TO 10 DO',
            '    END_FOR',
            'END_IF',
            'METHOD PUBLIC mRun : BOOL',
            'END_METHOD',
            'END_FUNCTION_BLOCK',
            'TYPE tComplex :',
            'STRUCT',
            '    rRe : REAL;',
            'END_STRUCT',
            'END_TYPE',
        ].join('\n');
        const root = parseStructure(tokenize(src, ST), ST);
        const fb = root.children[0];
        expect(fb.kind).toBe('pou');
        expect(fb.name).toBe('fbTest');
        expect(fb.end?.text).toBe('END_FUNCTION_BLOCK');
        const vars = fb.children.filter((b) => b.kind === 'var');
        expect(vars.map((v) => [v.keyword, v.modifiers.join()])).toEqual([['VAR_INPUT', ''], ['VAR', 'CONSTANT']]);
        expect(vars[0].decls.map((d) => [d.names.map((n) => n.text).join(','), d.typeText])).toEqual([['ibStart,ibStop', 'BOOL'], ['ixIn', 'BOOL']]);
        expect(vars[1].decls.map((d) => [d.names[0].text, d.typeText, d.hasInit])).toEqual([['ciMax', 'INT', true], ['carBuf', 'ARRAY[1..10] OF REAL', true]]);
        const method = fb.children.find((b) => b.keyword === 'METHOD');
        expect([method?.name, method?.modifiers, method?.returnType]).toEqual(['mRun', ['PUBLIC'], 'BOOL']);
        expect(fb.children.filter((b) => b.kind === 'control').map((b) => b.keyword)).toEqual(['IF']);
        const typedef = [...walk(root)].find((b) => b.kind === 'typedef');
        expect([typedef?.name, typedef?.modifiers]).toEqual(['tComplex', ['STRUCT']]);
        const struct = typedef?.children[0];
        expect(struct?.decls.map((d) => d.names[0].text)).toEqual(['rRe']);
    });

    it('handles SCL blocks, regions and anonymous structs', () => {
        const src = [
            'FUNCTION_BLOCK "fbMotor"',
            "{ S7_Optimized_Access := 'TRUE' }",
            'VERSION : 0.1',
            'VAR',
            '    sData : Struct',
            '        a : Int;',
            '    END_STRUCT;',
            '    sB : Bool;',
            'END_VAR',
            'BEGIN',
            'REGION Init stuff',
            '    #sB := TRUE;',
            'END_REGION',
            'END_FUNCTION_BLOCK',
        ].join('\n');
        const root = parseStructure(tokenize(src, SCL), SCL);
        const fb = root.children[0];
        expect(fb.name).toBe('fbMotor');
        expect(fb.begin?.text).toBe('BEGIN');
        const v = fb.children.find((b) => b.kind === 'var');
        expect(v?.decls.map((d) => [d.names[0].text, d.typeText])).toEqual([['sData', 'STRUCT'], ['sB', 'Bool']]);
        expect(v?.children[0].decls.map((d) => d.names[0].text)).toEqual(['a']);
        const region = fb.children.find((b) => b.kind === 'region');
        expect(region?.name).toBe('Init stuff');
    });
});
