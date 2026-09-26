/**
 * Lint rules derived from the ST programming guideline. Each rule returns
 * findings (message + range); severity is attached by the runner.
 */
import type { Analysis } from '../language/analysis';
import type { Dialect } from '../language/dialect';
import { keywordSets } from '../language/keywords';
import type { Token } from '../language/lexer';
import { type Block, type Declaration, walk } from '../language/structure';
import { expectedCase } from '../formatter/casing';
import { SECTION_ORDER_TEXT, sectionRank } from '../formatter/reorder';
import type { LintOptions, RuleId } from './index';

export interface LintContext {
    src: string;
    lines: string[];
    dialect: Dialect;
    tokens: Token[];
    analysis: Analysis;
    root: Block;
    options: LintOptions;
}

export interface Finding {
    message: string;
    line: number;
    col: number;
    endLine: number;
    endCol: number;
}

type Rule = (ctx: LintContext) => Finding[];

export function rangeOf(t: Token, message: string): Finding {
    const parts = t.text.split(/\r\n|\n|\r/);
    const endLine = t.line + parts.length - 1;
    const endCol = parts.length === 1 ? t.col + t.text.length : parts[parts.length - 1].length;
    return { message, line: t.line, col: t.col, endLine, endCol };
}

function kw(ctx: LintContext, i: number): string {
    const t = ctx.tokens[i];
    return t.kind === 'word' && !ctx.analysis.afterDot[i] ? t.text.toUpperCase() : '';
}

function isOp(t: Token | undefined, ...ops: string[]): boolean {
    return t !== undefined && t.kind === 'op' && ops.includes(t.text);
}

/** Code token indices outside declarations. */
function codeIndices(ctx: LintContext): number[] {
    return ctx.analysis.code.filter((i) => !ctx.analysis.inDecl[i]);
}

function prevCode(ctx: LintContext, i: number): number {
    const p = ctx.analysis.codePos[i];
    return p > 0 ? ctx.analysis.code[p - 1] : -1;
}

function nextCode(ctx: LintContext, i: number): number {
    const p = ctx.analysis.codePos[i];
    return p >= 0 && p + 1 < ctx.analysis.code.length ? ctx.analysis.code[p + 1] : -1;
}

/** True if token `i` starts a statement in the code section. */
function isStatementStart(ctx: LintContext, i: number): boolean {
    const p = prevCode(ctx, i);
    if (p < 0) {
        return true;
    }
    const pt = ctx.tokens[p];
    if (isOp(pt, ';') || ctx.analysis.labelColons.has(p) || ctx.analysis.caseOfs.has(p)) {
        return true;
    }
    const u = kw(ctx, p);
    return ['THEN', 'ELSE', 'DO', 'REPEAT', 'BEGIN'].includes(u) || u.startsWith('END_');
}

// ---------------------------------------------------------------------------

const keywordCase: Rule = (ctx) => {
    const out: Finding[] = [];
    ctx.tokens.forEach((t, i) => {
        if (t.kind !== 'word') {
            return;
        }
        const expected = expectedCase(ctx.tokens, i, ctx.analysis, ctx.dialect, ctx.options);
        if (expected !== undefined && expected !== t.text) {
            out.push(rangeOf(t, `'${t.text}' should be written '${expected}' (guideline 4.1.1.2 keywords).`));
        }
    });
    return out;
};

const oneStatementPerLine: Rule = (ctx) => {
    const out: Finding[] = [];
    for (const i of codeIndices(ctx)) {
        if (!isOp(ctx.tokens[i], ';')) {
            continue;
        }
        const n = nextCode(ctx, i);
        if (n >= 0 && ctx.tokens[n].line === ctx.tokens[i].line && !ctx.analysis.inDecl[n]) {
            out.push(rangeOf(ctx.tokens[n], 'Only one statement per line is allowed (guideline 4.1.1.2.1).'));
        }
    }
    return out;
};

const varSectionOrder: Rule = (ctx) => {
    const out: Finding[] = [];
    for (const pou of walk(ctx.root)) {
        if (pou.kind !== 'pou' && pou.kind !== 'file') {
            continue;
        }
        const sections = pou.children.filter((b) => b.kind === 'var');
        let maxRank = -1;
        let maxName = '';
        sections.forEach((sec, k) => {
            const rank = sectionRank(sec);
            const name = [sec.keyword, ...sec.modifiers.filter((m) => m === 'CONSTANT')].join(' ');
            if (rank < maxRank) {
                out.push(rangeOf(sec.start, `${name} should come before ${maxName}. Order: ${SECTION_ORDER_TEXT} (guideline 4.1.1.2.2).`));
            }
            if (rank > maxRank) {
                maxRank = rank;
                maxName = name;
            }
            const prev = sections[k - 1];
            if (prev?.end) {
                const between = ctx.lines.slice(prev.end.line + 1, sec.start.line);
                if (sec.start.line > prev.end.line && !between.some((l) => l.trim() === '')) {
                    out.push(rangeOf(sec.start, 'Separate VAR sections with a blank line (guideline 4.1.1.2.2).'));
                }
            }
        });
    }
    return out;
};

const noDirectAddress: Rule = (ctx) =>
    codeIndices(ctx)
        .filter((i) => ctx.tokens[i].kind === 'address')
        .map((i) => rangeOf(ctx.tokens[i], `Direct access to absolute address '${ctx.tokens[i].text}' is forbidden; use a symbolic variable (guideline 4.1.1.1 Robust Programming).`));

const noJump: Rule = (ctx) =>
    codeIndices(ctx)
        .filter((i) => ['JMP', 'GOTO'].includes(kw(ctx, i)))
        .map((i) => rangeOf(ctx.tokens[i], 'Never use jumps (guideline 4.1.1.2.2 Jumps and complex structures).'));

const caseNumericLabel: Rule = (ctx) => {
    const out: Finding[] = [];
    for (const start of ctx.analysis.labelStarts) {
        for (let p = ctx.analysis.codePos[start]; p < ctx.analysis.code.length; p++) {
            const i = ctx.analysis.code[p];
            if (ctx.analysis.labelColons.has(i)) {
                break;
            }
            const t = ctx.tokens[i];
            if (t.kind === 'number' || (t.kind === 'literal' && /#[+-]?\d/.test(t.text))) {
                out.push(rangeOf(t, `CASE label '${t.text}' is a plain number; use a named constant or enumeration (guideline 4.1.1.2.4).`));
            }
        }
    }
    return out;
};

const PRECEDENCE: Record<string, string> = {
    '**': 'exponentiation',
    '*': 'multiplication', '/': 'multiplication', MOD: 'multiplication',
    '+': 'addition', '-': 'addition',
    '=': 'comparison', '<>': 'comparison', '<': 'comparison', '>': 'comparison', '<=': 'comparison', '>=': 'comparison',
    AND: 'AND', '&': 'AND', AND_THEN: 'AND',
    XOR: 'XOR',
    OR: 'OR', OR_ELSE: 'OR',
};

const explicitParentheses: Rule = (ctx) => {
    const out: Finding[] = [];
    const sets = keywordSets(ctx.dialect.id);
    const frames: { classes: Set<string>; reported: boolean }[] = [{ classes: new Set(), reported: false }];
    const top = () => frames[frames.length - 1];
    for (const i of codeIndices(ctx)) {
        const t = ctx.tokens[i];
        const u = kw(ctx, i);
        if (isOp(t, '(', '[')) {
            frames.push({ classes: new Set(), reported: false });
            continue;
        }
        if (isOp(t, ')', ']')) {
            if (frames.length > 1) {
                frames.pop();
            }
            continue;
        }
        const key = t.kind === 'op' ? t.text : u;
        const cls = PRECEDENCE[key];
        if (cls) {
            if ((key === '-' || key === '+') && isUnaryAt(ctx, i)) {
                continue;
            }
            const f = top();
            f.classes.add(cls);
            if (f.classes.size > 1 && !f.reported) {
                f.reported = true;
                out.push(rangeOf(t, `Operators of different precedence (${[...f.classes].join(', ')}) are mixed; add parentheses instead of relying on operator precedence (guideline 4.1.1.2).`));
            }
            continue;
        }
        if (t.kind === 'op' ? [';', ':=', '=>', ',', ':', '..', '?='].includes(t.text) || /^(S|R|REF)=$/i.test(t.text) : u !== '' && u !== 'NOT' && (sets.control.has(u) || sets.operators.has(u))) {
            top().classes = new Set();
            top().reported = false;
        }
    }
    return out;
};

function isUnaryAt(ctx: LintContext, i: number): boolean {
    const p = prevCode(ctx, i);
    if (p < 0) {
        return true;
    }
    const pt = ctx.tokens[p];
    if (pt.kind === 'op') {
        return !isOp(pt, ')', ']', '^');
    }
    const u = kw(ctx, p);
    const sets = keywordSets(ctx.dialect.id);
    return u !== '' && (sets.control.has(u) || sets.operators.has(u));
}

const forCounterModified: Rule = (ctx) => {
    const out: Finding[] = [];
    const counters: string[] = [];
    for (const i of codeIndices(ctx)) {
        const u = kw(ctx, i);
        if (u === 'FOR') {
            const n = nextCode(ctx, i);
            counters.push(n >= 0 ? ctx.tokens[n].text.toUpperCase() : '');
            continue;
        }
        if (u === 'END_FOR') {
            counters.pop();
            continue;
        }
        const t = ctx.tokens[i];
        if (counters.length && (t.kind === 'word' || t.kind === 'local') && counters.includes(t.text.toUpperCase()) && isStatementStart(ctx, i) && isOp(ctx.tokens[nextCode(ctx, i)], ':=')) {
            out.push(rangeOf(t, `The FOR loop counter '${t.text}' must not be modified inside the loop (guideline 4.1.1.2.11).`));
        }
    }
    return out;
};

const preferForLoop: Rule = (ctx) =>
    codeIndices(ctx)
        .filter((i) => ['WHILE', 'REPEAT'].includes(kw(ctx, i)))
        .map((i) => rangeOf(ctx.tokens[i], `Prefer a FOR loop over ${ctx.tokens[i].text.toUpperCase()}; WHILE/REPEAT can loop endlessly and time out the PLC (guideline 4.1.1.2.11).`));

// --------------------------------------------------------------- naming

const TYPE_CODES: Record<string, string[]> = {
    BOOL: ['b', 'x'], BIT: ['b', 'x'],
    BYTE: ['by'], WORD: ['w'], DWORD: ['dw'], LWORD: ['lw'],
    SINT: ['si'], USINT: ['usi'], INT: ['i'], UINT: ['ui'], DINT: ['di'], UDINT: ['udi'], LINT: ['li'], ULINT: ['uli'],
    TIME: ['t'], LTIME: ['lt'], REAL: ['r'], LREAL: ['lr'], DATE: ['d'],
    CHAR: ['c'], WCHAR: ['wc', 'c'], STRING: ['s'], WSTRING: ['ws', 's'],
};

type TypeClass = { kind: 'elementary'; codes: string[] } | { kind: 'complex' } | { kind: 'lenient' };

function classifyType(typeText: string, dialect: Dialect): TypeClass {
    const words: string[] = typeText.toUpperCase().match(/[A-Z_][A-Z0-9_]*/g) ?? [];
    let head = words[0] ?? '';
    if (head === 'ARRAY') {
        const of = words.lastIndexOf('OF');
        head = of >= 0 ? (words[of + 1] ?? '') : '';
        if (head === 'POINTER' || head === 'REFERENCE') {
            return { kind: 'lenient' };
        }
    }
    if (head === 'POINTER' || head === 'REFERENCE') {
        return { kind: 'lenient' };
    }
    if (TYPE_CODES[head]) {
        return { kind: 'elementary', codes: TYPE_CODES[head] };
    }
    if (keywordSets(dialect.id).types.has(head)) {
        return { kind: 'lenient' };
    }
    return { kind: 'complex' };
}

function memoryPrefix(pou: Block | undefined, section: Block): { prefix: string; label: string } | undefined {
    const constant = section.modifiers.includes('CONSTANT');
    switch (section.keyword) {
        case 'VAR_INPUT':
            return { prefix: 'i', label: 'input' };
        case 'VAR_OUTPUT':
            return { prefix: 'q', label: 'output' };
        case 'VAR_IN_OUT':
            return { prefix: 'iq', label: 'input/output' };
        case 'VAR_TEMP':
            return { prefix: 't', label: 'temporary' };
        case 'VAR_STAT':
        case 'VAR_INST':
            return { prefix: 's', label: 'static' };
        case 'VAR_GLOBAL':
        case 'VAR_EXTERNAL':
            return constant ? { prefix: 'gc', label: 'global constant' } : { prefix: 'g', label: 'global' };
        case 'VAR':
            if (constant) {
                return { prefix: 'c', label: 'constant' };
            }
            if (!pou) {
                return undefined;
            }
            if (pou.keyword === 'FUNCTION' || pou.keyword === 'METHOD') {
                return { prefix: 't', label: 'temporary' };
            }
            if (pou.keyword === 'DATA_BLOCK') {
                return { prefix: 'g', label: 'global' };
            }
            return { prefix: 's', label: 'static' };
        default:
            return undefined;
    }
}

/** `state_old` -> `StateOld` (CamelCase suggestion part of a name). */
function capitalise(name: string): string {
    return name
        .split('_')
        .filter((p) => p.length > 0)
        .map((p) => p[0].toUpperCase() + p.slice(1))
        .join('');
}

const variablePrefix: Rule = (ctx) => {
    const out: Finding[] = [];
    const o = ctx.options;
    for (const block of walk(ctx.root)) {
        if (block.kind === 'var') {
            const pou = block.parent?.kind === 'pou' ? block.parent : undefined;
            const mem = memoryPrefix(pou, block);
            if (!mem) {
                continue;
            }
            const io = ['i', 'q', 'iq'].includes(mem.prefix);
            for (const decl of block.decls) {
                const cls = classifyType(decl.typeText, ctx.dialect);
                for (const n of decl.names) {
                    if (n.kind !== 'word') {
                        continue;
                    }
                    if (io && o.allowCfcStyleIo && /^[A-Z][A-Z0-9]{0,7}$/.test(n.text)) {
                        continue;
                    }
                    const f = checkName(n, decl, cls, mem.prefix, mem.label);
                    if (f) {
                        out.push(f);
                    }
                }
            }
        } else if (o.checkStructMembers && (block.kind === 'struct' || block.kind === 'union') && block.parent?.kind === 'typedef') {
            for (const decl of block.decls) {
                const cls = classifyType(decl.typeText, ctx.dialect);
                if (cls.kind !== 'elementary') {
                    continue;
                }
                for (const n of decl.names) {
                    if (n.kind === 'word' && !new RegExp(`^(?:${cls.codes.join('|')})[A-Z]`).test(n.text)) {
                        out.push(rangeOf(n, `Member '${n.text}' of type ${decl.typeText} should start with the type prefix '${cls.codes[0]}' followed by an upper-case letter, e.g. '${cls.codes[0]}${capitalise(n.text)}' (guideline 6.1).`));
                    }
                }
            }
        }
    }
    return out;
};

function checkName(n: Token, decl: Declaration, cls: TypeClass, prefix: string, label: string): Finding | undefined {
    const name = n.text;
    let re: RegExp;
    let expected: string;
    if (cls.kind === 'elementary') {
        re = new RegExp(`^${prefix}(?:${cls.codes.join('|')})[A-Z]`);
        expected = `'${prefix}' + type prefix '${cls.codes[0]}' + Name, e.g. '${prefix}${cls.codes[0]}${capitalise(name)}'`;
    } else if (cls.kind === 'complex') {
        re = new RegExp(`^${prefix}[A-Z]`);
        expected = `'${prefix}' + Name without type prefix (complex type), e.g. '${prefix}${capitalise(name)}'`;
    } else {
        re = new RegExp(`^${prefix}[a-z]*[A-Z]`);
        expected = `'${prefix}' + type prefix + Name`;
    }
    if (re.test(name)) {
        return undefined;
    }
    return rangeOf(n, `The ${label} ${decl.typeText || ''} variable '${name}' should be named ${expected} (guideline 4.1.1.1, 6.1).`.replace(/  +/g, ' '));
}

const POU_PREFIX: Record<string, { prefix: string; label: string }> = {
    FUNCTION_BLOCK: { prefix: 'fb', label: 'Function block' },
    FUNCTION: { prefix: 'fc', label: 'Function' },
    PROGRAM: { prefix: 'prg', label: 'Program' },
};

const pouPrefix: Rule = (ctx) => {
    const out: Finding[] = [];
    for (const b of walk(ctx.root)) {
        if (!b.nameToken || !b.name) {
            continue;
        }
        let rule: { prefix: string; label: string } | undefined;
        if (b.kind === 'pou') {
            rule = POU_PREFIX[b.keyword];
        } else if (b.kind === 'typedef') {
            rule = b.modifiers.includes('UNION') ? { prefix: 'u', label: 'Union' } : { prefix: 't', label: 'Data type' };
        }
        if (rule && !new RegExp(`^${rule.prefix}[A-Z0-9]`).test(b.name)) {
            out.push(rangeOf(b.nameToken, `${rule.label} '${b.name}' should be prefixed with '${rule.prefix}', e.g. '${rule.prefix}${capitalise(b.name)}' (guideline 3.3).`));
        }
    }
    return out;
};

const noUnderscoreInNames: Rule = (ctx) => {
    const out: Finding[] = [];
    for (const b of walk(ctx.root)) {
        const names: Token[] = [];
        if (b.nameToken && (b.kind === 'pou' || b.kind === 'typedef')) {
            names.push(b.nameToken);
        }
        for (const d of b.decls) {
            names.push(...d.names);
        }
        for (const n of names) {
            if (n.text.replace(/^"|"$/g, '').includes('_')) {
                out.push(rangeOf(n, `'${n.text}' contains an underscore; use CamelCase names (guideline 6.1).`));
            }
        }
    }
    return out;
};

const missingHeader: Rule = (ctx) => {
    const first = ctx.tokens.find((t) => t.kind !== 'ws' && t.kind !== 'newline');
    if (!first || first.kind === 'blockComment') {
        return [];
    }
    return [{ ...rangeOf(first, ''), message: 'The source file should start with the header comment (title, version table, functionality) of guideline 4.1.1.1.' }];
};

export const RULES: Record<RuleId, Rule> = {
    'keyword-case': keywordCase,
    'one-statement-per-line': oneStatementPerLine,
    'var-section-order': varSectionOrder,
    'no-direct-address': noDirectAddress,
    'no-jump': noJump,
    'case-numeric-label': caseNumericLabel,
    'explicit-parentheses': explicitParentheses,
    'for-counter-modified': forCounterModified,
    'prefer-for-loop': preferForLoop,
    'variable-prefix': variablePrefix,
    'pou-prefix': pouPrefix,
    'no-underscore-in-names': noUnderscoreInNames,
    'missing-header': missingHeader,
};
