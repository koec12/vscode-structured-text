/**
 * Safety net: the formatter may only change whitespace and the casing of words.
 * Compares the significant tokens of two texts.
 */
import type { Dialect } from '../language/dialect';
import { isTrivia, type Token, tokenize } from '../language/lexer';

export interface VerifyResult {
    ok: boolean;
    message?: string;
}

function normalise(t: Token): string {
    switch (t.kind) {
        case 'word':
            return t.text.toUpperCase();
        case 'lineComment':
            return t.text.trimEnd();
        case 'blockComment':
            return t.text.replace(/[ \t]+(?=\r\n|\n|\r)/g, '').replace(/\r\n|\r/g, '\n');
        default:
            return t.text;
    }
}

export function significant(src: string, dialect: Dialect): Token[] {
    return tokenize(src, dialect).filter((t) => !isTrivia(t));
}

export function verifyEquivalent(before: string, after: string, dialect: Dialect): VerifyResult {
    const a = significant(before, dialect);
    const b = significant(after, dialect);
    const n = Math.min(a.length, b.length);
    for (let k = 0; k < n; k++) {
        if (a[k].kind !== b[k].kind || normalise(a[k]) !== normalise(b[k])) {
            return {
                ok: false,
                message: `token ${k} differs at line ${a[k].line + 1}: '${a[k].text}' (${a[k].kind}) became '${b[k].text}' (${b[k].kind})`,
            };
        }
    }
    if (a.length !== b.length) {
        return { ok: false, message: `token count changed from ${a.length} to ${b.length}` };
    }
    return { ok: true };
}

/** Same multiset of significant tokens (used to validate VAR section reordering). */
export function verifySameTokens(before: string, after: string, dialect: Dialect): VerifyResult {
    const key = (src: string) => significant(src, dialect).map(normalise).sort().join('\u0000');
    return key(before) === key(after) ? { ok: true } : { ok: false, message: 'VAR section reordering changed the set of tokens' };
}
