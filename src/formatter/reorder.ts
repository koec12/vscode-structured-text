/**
 * Optional reordering of VAR sections:
 * VAR CONSTANT, VAR_INPUT, VAR_OUTPUT, VAR_IN_OUT, VAR, VAR_TEMP.
 * Operates on the source text; line comments / pragmas directly above a
 * section header (no blank line in between) move with the section.
 */
import type { Dialect } from '../language/dialect';
import { isNonCode, type Token, tokenize } from '../language/lexer';
import { type Block, parseStructure, walk } from '../language/structure';

export function sectionRank(block: Block): number {
    switch (block.keyword) {
        case 'VAR_INPUT':
            return 1;
        case 'VAR_OUTPUT':
            return 2;
        case 'VAR_IN_OUT':
            return 3;
        case 'VAR_EXTERNAL':
            return 3.5;
        case 'VAR_TEMP':
            return 5;
        case 'VAR':
        case 'VAR_GLOBAL':
            return block.modifiers.includes('CONSTANT') ? 0 : 4;
        default:
            return 4;
    }
}

export const SECTION_ORDER_TEXT = 'VAR CONSTANT, VAR_INPUT, VAR_OUTPUT, VAR_IN_OUT, VAR, VAR_TEMP';

interface Span {
    start: number;
    end: number;
    rank: number;
}

export function reorderVarSections(src: string, dialect: Dialect): string {
    const tokens = tokenize(src, dialect);
    const root = parseStructure(tokens, dialect);
    const lineStarts = computeLineStarts(src);
    const replacements: { start: number; end: number; text: string }[] = [];

    for (const pou of walk(root)) {
        if (pou.kind !== 'pou') {
            continue;
        }
        const sections = pou.children.filter((b) => b.kind === 'var');
        if (sections.length < 2) {
            continue;
        }
        // sections must be contiguous: only whitespace/comments/pragmas between them
        let contiguous = true;
        for (let s = 1; s < sections.length && contiguous; s++) {
            const from = tokens.indexOf(sections[s - 1].end!);
            const to = tokens.indexOf(sections[s].start);
            for (let k = from + 1; k < to; k++) {
                const t = tokens[k];
                if (!isNonCode(t) && !(t.kind === 'op' && t.text === ';' && k === from + 1)) {
                    contiguous = false;
                    break;
                }
            }
        }
        if (!contiguous) {
            continue;
        }
        const ranks = sections.map(sectionRank);
        if (ranks.every((r, k) => k === 0 || ranks[k - 1] <= r)) {
            continue;
        }
        const spans: Span[] = sections.map((sec, k) => ({
            start: k === 0 ? lineStarts[sec.start.line] : attachedStart(tokens, lineStarts, sec.start),
            end: endOfLine(src, tokens, sec.end!),
            rank: ranks[k],
        }));
        const separators = spans.slice(1).map((sp, k) => src.slice(spans[k].end, sp.start));
        const sorted = spans
            .map((sp, k) => ({ ...sp, k }))
            .sort((a, b) => a.rank - b.rank || a.k - b.k);
        let text = '';
        sorted.forEach((sp, k) => {
            text += src.slice(sp.start, sp.end);
            if (k < separators.length) {
                text += separators[k];
            }
        });
        replacements.push({ start: spans[0].start, end: spans[spans.length - 1].end, text });
    }
    let out = src;
    for (const r of replacements.sort((a, b) => b.start - a.start)) {
        out = out.slice(0, r.start) + r.text + out.slice(r.end);
    }
    return out;
}

function computeLineStarts(src: string): number[] {
    const starts = [0];
    for (let i = 0; i < src.length; i++) {
        if (src[i] === '\n' || (src[i] === '\r' && src[i + 1] !== '\n')) {
            starts.push(i + 1);
        }
    }
    return starts;
}

/** Start offset of the header line, extended upwards over directly attached line comments / pragmas. */
function attachedStart(tokens: Token[], lineStarts: number[], header: Token): number {
    let line = header.line;
    const byLine = new Map<number, Token[]>();
    for (const t of tokens) {
        if (t.kind !== 'ws' && t.kind !== 'newline') {
            const list = byLine.get(t.line) ?? [];
            list.push(t);
            byLine.set(t.line, list);
        }
    }
    while (line > 0) {
        const prev = byLine.get(line - 1);
        if (!prev || !prev.every((t) => t.kind === 'lineComment' || t.kind === 'pragma')) {
            break;
        }
        line--;
    }
    return lineStarts[line];
}

/** End offset of the line containing `tok` (after trailing comments, before the newline). */
function endOfLine(src: string, tokens: Token[], tok: Token): number {
    let k = tokens.indexOf(tok) + 1;
    let end = tok.offset + tok.text.length;
    while (k < tokens.length && tokens[k].kind !== 'newline') {
        const t = tokens[k];
        if (t.kind === 'blockComment' && t.text.includes('\n')) {
            break;
        }
        if (t.kind !== 'ws' && !(t.kind === 'op' && t.text === ';') && t.kind !== 'lineComment' && t.kind !== 'blockComment') {
            break;
        }
        if (t.kind !== 'ws') {
            end = t.offset + t.text.length;
        }
        k++;
    }
    return Math.min(end, src.length);
}
