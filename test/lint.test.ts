import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { lint, type RuleId } from '../src/lint';
import { SCL, ST } from '../src/language/dialect';

const only = (rule: RuleId, src: string, opts = {}, d = ST) =>
    lint(src, d, { rules: { [rule]: 'warning' }, ...opts })
        .filter((x) => x.rule === rule)
        .map((x) => `${x.line}:${x.col}`);

describe('lint rules', () => {
    it('keyword-case', () => {
        expect(only('keyword-case', 'IF a THEN\n    x := 1;\nEnd_If\n')).toEqual(['0:0', '0:5']);
        expect(only('keyword-case', 'if a then\nend_if\n', { keywordCase: 'lower' })).toEqual([]);
        expect(only('keyword-case', 'VAR\n    a : BOOL;\nEND_VAR\n')).toEqual(['1:8']);
    });
    it('one-statement-per-line', () => {
        expect(only('one-statement-per-line', 'a := 1; b := 2;\nc := 3; // ok\n')).toEqual(['0:8']);
        expect(only('one-statement-per-line', 'VAR a : INT; b : INT; END_VAR\n')).toEqual([]);
    });
    it('var-section-order', () => {
        const src = 'FUNCTION_BLOCK fbX\nVAR_TEMP\nEND_VAR\n\nVAR_INPUT\nEND_VAR\nVAR_OUTPUT\nEND_VAR\nEND_FUNCTION_BLOCK\n';
        const msgs = lint(src, ST).filter((d) => d.rule === 'var-section-order').map((d) => d.message);
        expect(msgs[0]).toMatch(/VAR_INPUT should come before VAR_TEMP/);
        expect(msgs[1]).toMatch(/VAR_OUTPUT should come before VAR_TEMP/);
        expect(msgs[2]).toMatch(/blank line/);
        expect(only('var-section-order', 'FUNCTION_BLOCK fbX\nVAR CONSTANT\nEND_VAR\n\nVAR_INPUT\nEND_VAR\nEND_FUNCTION_BLOCK\n')).toEqual([]);
    });
    it('no-direct-address', () => {
        expect(only('no-direct-address', 'VAR_GLOBAL\n    gbIn AT %IX0.0 : BOOL;\nEND_VAR\ntbIn := %IX0.0;\n')).toEqual(['3:8']);
    });
    it('no-jump', () => {
        expect(only('no-jump', 'JMP lbl;\n')).toEqual(['0:0']);
        expect(only('no-jump', 'GOTO lbl;\n', {}, SCL)).toEqual(['0:0']);
    });
    it('case-numeric-label', () => {
        expect(only('case-numeric-label', 'CASE siState OF\n    1: x := 1;\n    ciHigh: x := 2;\n    3..5, INT#7: x := 3;\nEND_CASE\n')).toEqual(['1:4', '3:4', '3:7', '3:10']);
    });
    it('explicit-parentheses', () => {
        expect(only('explicit-parentheses', 'x := a + 1 / 2;\n')).toEqual(['0:11']);
        expect(only('explicit-parentheses', 'x := a + (1 / 2);\ny := (a + 1) / 2;\nz := a + b - c;\nb := RX And Not sbRx;\nc := -a * b;\n')).toEqual([]);
        expect(only('explicit-parentheses', 'IF a < b AND c THEN\nEND_IF\n')).toEqual(['0:9']);
    });
    it('for-counter-modified', () => {
        expect(only('for-counter-modified', 'FOR tiI := 1 TO 10 DO\n    tiI := tiI + 1;\n    x := tiI;\nEND_FOR\ntiI := 0;\n')).toEqual(['1:4']);
    });
    it('prefer-for-loop', () => {
        expect(only('prefer-for-loop', 'WHILE a DO\nEND_WHILE\nREPEAT\nUNTIL b\nEND_REPEAT\n')).toEqual(['0:0', '2:0']);
    });
    it('variable-prefix', () => {
        const src = [
            'FUNCTION_BLOCK fbX',
            'VAR_INPUT',
            '    ibStart : BOOL;',
            '    start : BOOL;',
            '    XGH : BOOL;',
            '    iiCount : INT;',
            '    iCount : INT;',
            'END_VAR',
            'VAR_IN_OUT',
            '    iqbX : BOOL;',
            'END_VAR',
            'VAR CONSTANT',
            '    ciPulse : INT := 1;',
            '    crPi : LREAL := 3.14;',
            'END_VAR',
            'VAR',
            '    sFilter : fbExponentialLpf;',
            '    srBuffer : ARRAY[1..10] OF REAL;',
            '    sbfilter : fbExponentialLpf;',
            '    stTod : TOD;',
            'END_VAR',
            'VAR_TEMP',
            '    tltNow : LTIME;',
            '    i : INT;',
            'END_VAR',
            'END_FUNCTION_BLOCK',
            'FUNCTION fcX : INT',
            'VAR',
            '    tiA : INT;',
            '    siB : INT;',
            'END_VAR',
            'END_FUNCTION',
        ].join('\n');
        expect(only('variable-prefix', src)).toEqual(['3:4', '6:4', '13:4', '18:4', '23:4', '29:4']);
        expect(only('variable-prefix', src, { allowCfcStyleIo: false })).toContain('4:4');
    });
    it('variable-prefix struct members (opt-in)', () => {
        const src = 'TYPE tComplex :\nSTRUCT\n    rRe : REAL;\n    Im : REAL;\nEND_STRUCT\nEND_TYPE\n';
        expect(only('variable-prefix', src)).toEqual([]);
        expect(only('variable-prefix', src, { checkStructMembers: true })).toEqual(['3:4']);
    });
    it('pou-prefix', () => {
        const src = 'FUNCTION_BLOCK fbGood\nEND_FUNCTION_BLOCK\nFUNCTION Bad : INT\nEND_FUNCTION\nPROGRAM prgMain\nEND_PROGRAM\nTYPE Complex : STRUCT END_STRUCT END_TYPE\nTYPE uCmd : UNION END_UNION END_TYPE\n';
        expect(only('pou-prefix', src)).toEqual(['2:9', '6:5']);
        expect(only('pou-prefix', 'FUNCTION_BLOCK "fbMotor"\nEND_FUNCTION_BLOCK\n', {}, SCL)).toEqual([]);
    });
    it('no-underscore-in-names', () => {
        expect(only('no-underscore-in-names', 'VAR\n    s_Bad : INT;\n    sGood : INT;\nEND_VAR\n')).toEqual(['1:4']);
    });
    it('missing-header', () => {
        expect(only('missing-header', 'FUNCTION_BLOCK fbX\n')).toEqual(['0:0']);
        expect(only('missing-header', '(* header *)\nFUNCTION_BLOCK fbX\n')).toEqual([]);
    });
    it('the fbRuntime sample produces no naming or structure findings', () => {
        const src = readFileSync('test/format/fixtures/fbruntime.expected.st', 'utf8');
        const found = lint(src, ST).filter((d) => d.rule !== 'no-underscore-in-names');
        expect(found.map((d) => `${d.rule}@${d.line}`)).toEqual([]);
    });
    it('respects severity settings', () => {
        const d = lint('JMP x;\n', ST, { rules: { 'no-jump': 'error' } });
        expect(d.find((x) => x.rule === 'no-jump')?.severity).toBe('error');
        expect(lint('JMP x;\n', ST, { rules: { 'no-jump': 'off' } }).some((x) => x.rule === 'no-jump')).toBe(false);
    });
});

describe('reported issues', () => {
    const src = [
        'FUNCTION_BLOCK fbTransport',
        'VAR_OUTPUT',
        '    qltRemainingTime : LReal; // [min] Accumulated time in state',
        '    qbControlHigh : Bool;',
        'END_VAR',
        '',
        'VAR_IN_OUT',
        '    iqItemStore : Array[*] Of tTransportItem;',
        'END_VAR',
        'If a Then',
        '    qbControlHigh := True;',
        'Elsif b Then',
        '    qbControlHigh := False;',
        'End_If',
        'END_FUNCTION_BLOCK',
    ].join('\n');
    const found = lint(src, ST);

    it('explains a prefix of the wrong type and keeps the base name in the suggestion', () => {
        const d = found.filter((x) => x.rule === 'variable-prefix');
        expect(d.map((x) => x.line)).toEqual([2]);
        expect(d[0].message).toBe("Output 'qltRemainingTime' has type LReal: use the prefix 'qlr' ('lt' is the prefix for LTime), e.g. 'qlrRemainingTime'.");
    });
    it('accepts Pascal case Array / Of, True / False and Elsif', () => {
        expect(found.filter((x) => x.rule === 'keyword-case')).toEqual([]);
    });
    it('asks for Elsif, not ElsIf', () => {
        const d = lint('If a Then\nELSIF b Then\nEnd_If\n', ST).filter((x) => x.rule === 'keyword-case');
        expect(d.map((x) => x.message)).toEqual(["'ELSIF' should be written 'Elsif'."]);
    });
    it('messages do not cite guideline sections', () => {
        const all = lint(readFileSync('samples/fbSwitchBistable.st', 'utf8'), ST, { rules: { 'missing-header': 'warning' } });
        expect(all.length).toBeGreaterThan(0);
        for (const d of all) {
            expect(d.message).not.toMatch(/guideline|\d\.\d\.\d/i);
        }
    });
});
