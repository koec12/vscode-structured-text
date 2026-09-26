/**
 * Keyword / type / built-in casing.
 * Shared with the linter's `keyword-case` rule.
 */
import type { Analysis } from '../language/analysis';
import type { Dialect } from '../language/dialect';
import { applyCase, type CaseGroup, type CaseStyle, isConversionFunction, keywordSets } from '../language/keywords';
import type { Token } from '../language/lexer';

export interface CaseOptions {
    keywordCase: CaseStyle;
    declarationKeywordCase: CaseStyle;
    dataTypeCase: CaseStyle;
    builtinFunctionCase: CaseStyle;
    booleanLiteralCase: CaseStyle;
}

/** Type definition words cased like data types (Array[1..10] Of Int, Pointer To tData). */
const TYPE_CONSTRUCTORS = new Set(['ARRAY', 'POINTER', 'REFERENCE']);

export function styleFor(group: CaseGroup, o: CaseOptions): CaseStyle {
    switch (group) {
        case 'keyword':
            return o.keywordCase;
        case 'declaration':
            return o.declarationKeywordCase;
        case 'type':
            return o.dataTypeCase;
        case 'builtin':
            return o.builtinFunctionCase;
        case 'boolean':
            return o.booleanLiteralCase;
    }
}

/** Casing group of the word token at index `i`, or undefined if it must not be recased. */
export function caseGroupOf(tokens: Token[], i: number, a: Analysis, dialect: Dialect): CaseGroup | undefined {
    const t = tokens[i];
    if (t.kind !== 'word' || a.afterDot[i]) {
        return undefined;
    }
    const sets = keywordSets(dialect.id);
    const u = t.text.toUpperCase();
    const ci = a.codePos[i];
    const next = ci >= 0 ? tokens[a.code[ci + 1]] : undefined;
    const nextText = next?.kind === 'op' ? next.text : '';

    if ((u === 'OF' || u === 'TO') && a.inDecl[i]) {
        // part of a type definition: ARRAY[..] OF, POINTER TO, REFERENCE TO
        return 'type';
    }
    if (sets.control.has(u) || sets.operators.has(u)) {
        return 'keyword';
    }
    if (sets.pou.has(u) || sets.vars.has(u)) {
        return 'declaration';
    }
    if (sets.booleans.has(u)) {
        return 'boolean';
    }
    // below: words that could in principle also be identifiers - never touch declared names or assignment targets
    const prev = ci > 0 ? tokens[a.code[ci - 1]] : undefined;
    const typePosition = (prev?.kind === 'op' && prev.text === ':') || (prev?.kind === 'word' && /^(OF|TO)$/i.test(prev.text));
    if (!typePosition && (nextText === ':' || nextText === ':=' || nextText === '=>' || (nextText === ',' && a.inDecl[i]))) {
        return undefined;
    }
    if (TYPE_CONSTRUCTORS.has(u)) {
        return 'type';
    }
    if (sets.modifiers.has(u)) {
        return a.inDecl[i] ? 'declaration' : undefined;
    }
    if (sets.instance.has(u)) {
        return 'keyword';
    }
    if (sets.types.has(u)) {
        return 'type';
    }
    if (nextText === '(' && (sets.builtins.has(u) || isConversionFunction(u, dialect.id))) {
        return 'builtin';
    }
    return undefined;
}

/** Expected spelling of token `i`, or undefined if casing does not apply. */
export function expectedCase(tokens: Token[], i: number, a: Analysis, dialect: Dialect, o: CaseOptions): string | undefined {
    const group = caseGroupOf(tokens, i, a, dialect);
    if (!group) {
        return undefined;
    }
    const style = styleFor(group, o);
    return style === 'preserve' ? undefined : applyCase(tokens[i].text, style);
}

/** Returns a copy of the tokens with casing applied. */
export function applyCasing(tokens: Token[], a: Analysis, dialect: Dialect, o: CaseOptions): Token[] {
    return tokens.map((t, i) => {
        const text = expectedCase(tokens, i, a, dialect, o);
        return text !== undefined && text !== t.text ? { ...t, text } : t;
    });
}
