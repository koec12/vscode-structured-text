/**
 * Per-token context shared by the formatter (casing, line breaking) and the linter:
 * declaration vs. code context and CASE label colons.
 */
import type { Dialect } from './dialect';
import { keywordSets, VAR_KEYWORDS } from './keywords';
import { isNonCode, type Token, upper } from './lexer';

export const POU_HEADS = new Set([
    'PROGRAM', 'FUNCTION', 'FUNCTION_BLOCK', 'METHOD', 'PROPERTY', 'INTERFACE', 'ACTION',
    'ORGANIZATION_BLOCK', 'DATA_BLOCK', 'CONFIGURATION', 'RESOURCE', 'NAMESPACE',
]);

export const CONTROL_OPENERS: Record<string, string> = {
    IF: 'END_IF',
    CASE: 'END_CASE',
    FOR: 'END_FOR',
    WHILE: 'END_WHILE',
    REPEAT: 'END_REPEAT',
};
export const CONTROL_CLOSERS = new Set(Object.values(CONTROL_OPENERS));

const VAR_OPENERS = new Set(VAR_KEYWORDS.filter((k) => k !== 'END_VAR'));

export function isVarKeyword(u: string): boolean {
    return VAR_OPENERS.has(u);
}

export interface Analysis {
    /** Indices of code tokens (no whitespace, comments or pragmas). */
    code: number[];
    /** Token index -> position in `code`, or -1 for non-code tokens. */
    codePos: Int32Array;
    /** Token index -> inside a declaration context (VAR / TYPE / STRUCT block or POU header line). */
    inDecl: boolean[];
    /** Token indices of `:` operators that terminate a CASE label. */
    labelColons: Set<number>;
    /** Token indices of the first token of a CASE label. */
    labelStarts: Set<number>;
    /** Token indices of `OF` that open a CASE body. */
    caseOfs: Set<number>;
    /** Token index -> the token follows a `.` (member access), so it is never a keyword. */
    afterDot: boolean[];
}

export function analyze(tokens: Token[], dialect: Dialect): Analysis {
    const sets = keywordSets(dialect.id);
    const code: number[] = [];
    const codePos = new Int32Array(tokens.length).fill(-1);
    tokens.forEach((t, i) => {
        if (!isNonCode(t)) {
            codePos[i] = code.length;
            code.push(i);
        }
    });
    const inDecl = new Array<boolean>(tokens.length).fill(false);
    const afterDot = new Array<boolean>(tokens.length).fill(false);
    const labelColons = new Set<number>();
    const labelStarts = new Set<number>();
    const caseOfs = new Set<number>();

    let declDepth = 0;
    let headerLine = -1;
    const control: { kind: string; ofSeen: boolean }[] = [];
    let stmtStart = true;

    for (let ci = 0; ci < code.length; ci++) {
        const i = code[ci];
        const t = tokens[i];
        const prev = ci > 0 ? tokens[code[ci - 1]] : undefined;
        const dotted = prev?.kind === 'op' && prev.text === '.';
        afterDot[i] = dotted;
        const u = dotted ? '' : upper(t);

        if (headerLine >= 0 && t.line !== headerLine) {
            headerLine = -1;
        }

        // declaration context
        if (isVarKeyword(u) || u === 'TYPE' || u === 'STRUCT' || u === 'UNION') {
            declDepth++;
            inDecl[i] = true;
        } else if (u === 'END_VAR' || u === 'END_TYPE' || u === 'END_STRUCT' || u === 'END_UNION') {
            inDecl[i] = true;
            declDepth = Math.max(0, declDepth - 1);
        } else if (POU_HEADS.has(u) && isPouHead(prev, t)) {
            headerLine = t.line;
            inDecl[i] = true;
        } else {
            inDecl[i] = declDepth > 0 || headerLine >= 0;
        }
        if (inDecl[i]) {
            stmtStart = true;
            continue;
        }

        // control structures and CASE labels
        const top = control[control.length - 1];
        if (stmtStart && top?.kind === 'CASE' && top.ofSeen && isLabelStart(t, u)) {
            const colon = findLabelColon(tokens, code, ci, sets.control);
            if (colon >= 0) {
                labelColons.add(code[colon]);
                labelStarts.add(i);
                ci = colon;
                stmtStart = true;
                continue;
            }
        }
        stmtStart = false;
        if (u in CONTROL_OPENERS) {
            control.push({ kind: u, ofSeen: false });
            if (u === 'REPEAT') {
                stmtStart = true;
            }
        } else if (CONTROL_CLOSERS.has(u)) {
            for (let k = control.length - 1; k >= 0; k--) {
                if (CONTROL_OPENERS[control[k].kind] === u) {
                    control.length = k;
                    break;
                }
            }
            stmtStart = true;
        } else if (u === 'OF' && top?.kind === 'CASE' && !top.ofSeen) {
            top.ofSeen = true;
            caseOfs.add(i);
            stmtStart = true;
        } else if (u === 'THEN' || u === 'ELSE' || u === 'DO' || u === 'BEGIN' || u === 'ELSIF') {
            stmtStart = u !== 'ELSIF';
        } else if (t.kind === 'op' && t.text === ';') {
            stmtStart = true;
        }
    }
    return { code, codePos, inDecl, labelColons, labelStarts, caseOfs, afterDot };
}

function isPouHead(prev: Token | undefined, t: Token): boolean {
    return !prev || prev.line < t.line || (prev.kind === 'op' && prev.text === ';') || (prev.kind === 'word' && prev.text.toUpperCase().startsWith('END_'));
}

function isLabelStart(t: Token, u: string): boolean {
    if (u && (u === 'ELSE' || u === 'END_CASE')) {
        return false;
    }
    return t.kind === 'word' || t.kind === 'number' || t.kind === 'literal' || t.kind === 'local' || t.kind === 'quotedId' || (t.kind === 'op' && (t.text === '-' || t.text === '+'));
}

/** From code position `ci`, find the `:` that ends a CASE label, or -1 if this is a statement. */
function findLabelColon(tokens: Token[], code: number[], ci: number, control: Set<string>): number {
    for (let k = ci; k < code.length; k++) {
        const t = tokens[code[k]];
        if (t.kind === 'op') {
            if (t.text === ':') {
                return k;
            }
            if (t.text === ';' || t.text === ':=' || t.text === '=>' || t.text === '(' || t.text === '?=' || /^(S|R|REF)=$/i.test(t.text)) {
                return -1;
            }
        } else if (t.kind === 'word') {
            const u = t.text.toUpperCase();
            if (control.has(u) || u === 'END_CASE') {
                return -1;
            }
        }
    }
    return -1;
}

/** Next / previous code token relative to token index `i`. */
export function nextCode(tokens: Token[], a: Analysis, i: number): Token | undefined {
    for (let j = i + 1; j < tokens.length; j++) {
        if (a.codePos[j] >= 0) {
            return tokens[j];
        }
    }
    return undefined;
}

export function prevCode(tokens: Token[], a: Analysis, i: number): Token | undefined {
    for (let j = i - 1; j >= 0; j--) {
        if (a.codePos[j] >= 0) {
            return tokens[j];
        }
    }
    return undefined;
}

/**
 * True if token `i` is a POU keyword (FUNCTION_BLOCK, METHOD, ...) in header position:
 * the first code token on its line or following `;` / an END_ keyword.
 */
export function isPouHeadAt(tokens: Token[], a: Analysis, i: number): boolean {
    const t = tokens[i];
    if (t.kind !== 'word' || !POU_HEADS.has(t.text.toUpperCase()) || a.afterDot[i]) {
        return false;
    }
    const p = a.codePos[i] > 0 ? tokens[a.code[a.codePos[i] - 1]] : undefined;
    return !p || p.line < t.line || (p.kind === 'op' && p.text === ';') || (p.kind === 'word' && p.text.toUpperCase().startsWith('END_'));
}
