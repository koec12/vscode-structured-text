/**
 * Lossless tokenizer for Structured Text and SCL.
 * Concatenating the `text` of all tokens reproduces the input exactly.
 */
import type { Dialect } from './dialect';

export type TokenKind =
    | 'ws'
    | 'newline'
    | 'lineComment'
    | 'blockComment'
    | 'pragma'
    | 'string'
    | 'quotedId'
    | 'local'
    | 'number'
    | 'literal'
    | 'word'
    | 'address'
    | 'op'
    | 'raw'
    | 'unknown';

export interface Token {
    kind: TokenKind;
    text: string;
    /** Offset in the source. */
    offset: number;
    /** 0-based line / column of the first character. */
    line: number;
    col: number;
}

const OPERATORS = [':=', '=>', '<=', '>=', '<>', '..', '**', '?=', ':', ';', ',', '.', '(', ')', '[', ']', '+', '-', '*', '/', '=', '<', '>', '&', '^', '#', '@'];

const DATE_PREFIXES = new Set(['D', 'DATE', 'LD', 'LDATE', 'DT', 'DATE_AND_TIME', 'LDT', 'LDATE_AND_TIME', 'DTL']);

const WORD_START = /[A-Za-z_\p{L}]/u;
const WORD_CHAR = /[A-Za-z0-9_\p{L}\p{N}]/u;

export function isTrivia(t: Token): boolean {
    return t.kind === 'ws' || t.kind === 'newline';
}

export function isComment(t: Token): boolean {
    return t.kind === 'lineComment' || t.kind === 'blockComment';
}

/** Tokens that carry no code meaning (whitespace, comments, pragmas). */
export function isNonCode(t: Token): boolean {
    return isTrivia(t) || isComment(t) || t.kind === 'pragma';
}

export function upper(t: Token | undefined): string {
    return t && t.kind === 'word' ? t.text.toUpperCase() : '';
}

export function tokenize(src: string, dialect: Dialect): Token[] {
    const tokens: Token[] = [];
    let pos = 0;
    let line = 0;
    let col = 0;
    /** True while only whitespace has been seen on the current line. */
    let lineStart = true;

    const push = (kind: TokenKind, end: number) => {
        const text = src.slice(pos, end);
        tokens.push({ kind, text, offset: pos, line, col });
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (c === '\n' || (c === '\r' && text[i + 1] !== '\n')) {
                line++;
                col = 0;
            } else if (c !== '\r') {
                col++;
            }
        }
        if (kind === 'newline') {
            lineStart = true;
        } else if (kind !== 'ws') {
            lineStart = false;
        }
        pos = end;
    };

    const endOfLine = (from: number) => {
        let i = from;
        while (i < src.length && src[i] !== '\n' && src[i] !== '\r') {
            i++;
        }
        return i;
    };

    /** Emit the rest of the line as one raw token (trailing whitespace separate). */
    const pushRawRestOfLine = () => {
        let ws = pos;
        while (ws < src.length && (src[ws] === ' ' || src[ws] === '\t')) {
            ws++;
        }
        if (ws > pos) {
            push('ws', ws);
        }
        const eol = endOfLine(pos);
        let end = eol;
        while (end > pos && (src[end - 1] === ' ' || src[end - 1] === '\t')) {
            end--;
        }
        if (end > pos) {
            push('raw', end);
        }
        if (eol > pos) {
            push('ws', eol);
        }
    };

    while (pos < src.length) {
        const c = src[pos];
        const next = src[pos + 1];

        // newline
        if (c === '\r' || c === '\n') {
            push('newline', c === '\r' && next === '\n' ? pos + 2 : pos + 1);
            continue;
        }
        // whitespace
        if (c === ' ' || c === '\t' || c === '\f' || c === '\v' || c === ' ' || c === '﻿') {
            let i = pos + 1;
            while (i < src.length && /[ \t\f\v ﻿]/.test(src[i])) {
                i++;
            }
            push('ws', i);
            continue;
        }
        // line comment
        if (c === '/' && next === '/') {
            push('lineComment', endOfLine(pos));
            continue;
        }
        // block comments
        if (c === '(' && next === '*') {
            let depth = 1;
            let i = pos + 2;
            while (i < src.length && depth > 0) {
                if (src[i] === '*' && src[i + 1] === ')') {
                    depth--;
                    i += 2;
                } else if (dialect.nestedComments && src[i] === '(' && src[i + 1] === '*') {
                    depth++;
                    i += 2;
                } else {
                    i++;
                }
            }
            push('blockComment', i);
            continue;
        }
        if (c === '/' && next === '*') {
            const close = src.indexOf('*/', pos + 2);
            push('blockComment', close < 0 ? src.length : close + 2);
            continue;
        }
        // pragma / attribute
        if (c === '{') {
            const close = src.indexOf('}', pos + 1);
            const eol = endOfLine(pos);
            push('pragma', close < 0 ? eol : close + 1);
            continue;
        }
        // strings
        if (c === "'" || (c === '"' && !dialect.doubleQuoteIsIdentifier)) {
            push('string', scanString(src, pos, c));
            continue;
        }
        if (c === '"') {
            push('quotedId', scanQuotedId(src, pos));
            continue;
        }
        // SCL locals: #name, #"name"
        if (c === '#' && dialect.hashLocals && next !== undefined) {
            if (next === '"') {
                push('local', scanQuotedId(src, pos + 1));
                continue;
            }
            if (WORD_START.test(next)) {
                let i = pos + 2;
                while (i < src.length && WORD_CHAR.test(src[i])) {
                    i++;
                }
                push('local', i);
                continue;
            }
        }
        // direct address %IX0.0
        if (c === '%' && next !== undefined && /[A-Za-z]/.test(next)) {
            let i = pos + 1;
            while (i < src.length && /[A-Za-z]/.test(src[i])) {
                i++;
            }
            while (i < src.length && /[A-Za-z0-9_.*]/.test(src[i])) {
                i++;
            }
            while (src[i - 1] === '.') {
                i--;
            }
            push('address', i);
            continue;
        }
        // numbers
        if (c >= '0' && c <= '9') {
            push('number', scanNumber(src, pos));
            continue;
        }
        // words, typed literals
        if (WORD_START.test(c)) {
            let i = pos + 1;
            while (i < src.length && WORD_CHAR.test(src[i])) {
                i++;
            }
            const word = src.slice(pos, i);
            const up = word.toUpperCase();
            if (src[i] === '#') {
                const end = scanTypedLiteralValue(src, i + 1, DATE_PREFIXES.has(up));
                if (end > i + 1) {
                    push('literal', end);
                    continue;
                }
            }
            if (dialect.setResetOperators && (up === 'S' || up === 'R' || up === 'REF') && src[i] === '=' && src[i + 1] !== '=' && src[i + 1] !== '>') {
                push('op', i + 1);
                continue;
            }
            const atLineStart = lineStart;
            push('word', i);
            if (dialect.regions && atLineStart) {
                if (up === 'REGION') {
                    pushRawRestOfLine();
                } else if (up === 'TITLE') {
                    let j = pos;
                    while (src[j] === ' ' || src[j] === '\t') {
                        j++;
                    }
                    if (src[j] === '=') {
                        if (j > pos) {
                            push('ws', j);
                        }
                        push('op', j + 1);
                        pushRawRestOfLine();
                    }
                }
            }
            continue;
        }
        // operators
        const op = OPERATORS.find((o) => src.startsWith(o, pos));
        if (op) {
            push('op', pos + op.length);
            continue;
        }
        push('unknown', pos + 1);
    }
    return tokens;
}

function scanString(src: string, start: number, quote: string): number {
    let i = start + 1;
    while (i < src.length) {
        const ch = src[i];
        if (ch === '\n' || ch === '\r') {
            return i;
        }
        if (ch === '$' && i + 1 < src.length && src[i + 1] !== '\n' && src[i + 1] !== '\r') {
            i += 2;
            continue;
        }
        if (ch === quote) {
            if (src[i + 1] === quote) {
                i += 2;
                continue;
            }
            return i + 1;
        }
        i++;
    }
    return i;
}

function scanQuotedId(src: string, start: number): number {
    let i = start + 1;
    while (i < src.length && src[i] !== '"' && src[i] !== '\n' && src[i] !== '\r') {
        i++;
    }
    return src[i] === '"' ? i + 1 : i;
}

function scanNumber(src: string, start: number): number {
    let i = start;
    while (i < src.length && /[0-9_]/.test(src[i])) {
        i++;
    }
    if (src[i] === '#' && i + 1 < src.length && /[0-9A-Za-z_]/.test(src[i + 1])) {
        i++;
        while (i < src.length && /[0-9A-Za-z_]/.test(src[i])) {
            i++;
        }
        return i;
    }
    if (src[i] === '.' && /[0-9]/.test(src[i + 1] ?? '')) {
        i++;
        while (i < src.length && /[0-9_]/.test(src[i])) {
            i++;
        }
    }
    if ((src[i] === 'e' || src[i] === 'E') && /[0-9]/.test(src[i + 1] === '+' || src[i + 1] === '-' ? src[i + 2] ?? '' : src[i + 1] ?? '')) {
        i += src[i + 1] === '+' || src[i + 1] === '-' ? 2 : 1;
        while (i < src.length && /[0-9_]/.test(src[i])) {
            i++;
        }
    }
    return i;
}

/** Scan the value part of a typed literal (after `PREFIX#`). Returns `start` if there is none. */
function scanTypedLiteralValue(src: string, start: number, allowDash: boolean): number {
    let i = start;
    if (src[i] === "'" || src[i] === '"') {
        return scanString(src, i, src[i]);
    }
    // nested base: B#16#FF, INT#16#7FFF
    const base = /^[0-9]+#/.exec(src.slice(i, i + 4));
    if (base) {
        i += base[0].length;
    }
    if (src[i] === '+' || src[i] === '-') {
        i++;
    }
    const valueStart = i;
    const valueChar = allowDash ? /[A-Za-z0-9_.:\-]/ : /[A-Za-z0-9_.:]/;
    while (i < src.length && valueChar.test(src[i])) {
        // don't swallow a trailing range operator or member access dot
        if (src[i] === '.' && !/[0-9A-Za-z]/.test(src[i + 1] ?? '')) {
            break;
        }
        if (src[i] === ':' && !/[0-9]/.test(src[i + 1] ?? '')) {
            break;
        }
        i++;
    }
    return i > valueStart ? i : start;
}
