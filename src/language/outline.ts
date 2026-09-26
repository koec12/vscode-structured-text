/**
 * Folding ranges and document symbols from the block tree (pure, VS Code independent).
 */
import type { Token } from './lexer';
import { type Block, walk } from './structure';

export interface FoldRange {
    start: number;
    end: number;
    kind?: 'comment' | 'region';
}

export function foldingRanges(tokens: Token[], root: Block): FoldRange[] {
    const out: FoldRange[] = [];
    const add = (start: number, end: number, kind?: FoldRange['kind']) => {
        if (end > start) {
            out.push({ start, end, kind });
        }
    };
    for (const b of walk(root)) {
        if (b.kind === 'file' || b.kind === 'typedef' || !b.end) {
            continue;
        }
        // keep the END_ line visible
        add(b.start.line, b.end.line - 1, b.kind === 'region' ? 'region' : undefined);
    }
    const regions: number[] = [];
    let commentRun: { start: number; end: number } | undefined;
    const flushComments = () => {
        if (commentRun) {
            add(commentRun.start, commentRun.end, 'comment');
        }
        commentRun = undefined;
    };
    const lineHasCode = new Set<number>();
    for (const t of tokens) {
        if (t.kind !== 'ws' && t.kind !== 'newline' && t.kind !== 'lineComment') {
            lineHasCode.add(t.line);
        }
    }
    for (const t of tokens) {
        if (t.kind === 'blockComment') {
            const lines = t.text.split(/\r\n|\n|\r/).length;
            add(t.line, t.line + lines - 1, 'comment');
        } else if (t.kind === 'lineComment' && !lineHasCode.has(t.line)) {
            if (commentRun && commentRun.end === t.line - 1) {
                commentRun.end = t.line;
            } else {
                flushComments();
                commentRun = { start: t.line, end: t.line };
            }
        } else if (t.kind === 'pragma') {
            if (/^\{\s*region\b/i.test(t.text)) {
                regions.push(t.line);
            } else if (/^\{\s*endregion\b/i.test(t.text) && regions.length) {
                add(regions.pop()!, t.line, 'region');
            }
        }
    }
    flushComments();
    return out;
}

export type SymbolKindName =
    | 'class' | 'function' | 'module' | 'method' | 'property' | 'interface' | 'event' | 'namespace'
    | 'struct' | 'enum' | 'typeParameter' | 'variable' | 'constant' | 'field' | 'object' | 'package';

export interface Range {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
}

export interface SymbolNode {
    name: string;
    detail: string;
    kind: SymbolKindName;
    range: Range;
    selection: Range;
    children: SymbolNode[];
}

function tokenRange(t: Token): Range {
    const parts = t.text.split(/\r\n|\n|\r/);
    return {
        startLine: t.line,
        startCol: t.col,
        endLine: t.line + parts.length - 1,
        endCol: parts.length === 1 ? t.col + t.text.length : parts[parts.length - 1].length,
    };
}

function blockRange(b: Block): Range {
    const s = tokenRange(b.start);
    const e = tokenRange(b.end ?? b.start);
    return { startLine: s.startLine, startCol: s.startCol, endLine: e.endLine, endCol: e.endCol };
}

const POU_KINDS: Record<string, SymbolKindName> = {
    FUNCTION_BLOCK: 'class',
    FUNCTION: 'function',
    PROGRAM: 'module',
    METHOD: 'method',
    PROPERTY: 'property',
    INTERFACE: 'interface',
    ACTION: 'event',
    ORGANIZATION_BLOCK: 'module',
    DATA_BLOCK: 'object',
    CONFIGURATION: 'namespace',
    RESOURCE: 'namespace',
    NAMESPACE: 'namespace',
};

export function documentSymbols(root: Block): SymbolNode[] {
    return symbolsOf(root);
}

function symbolsOf(block: Block): SymbolNode[] {
    const out: SymbolNode[] = [];
    for (const b of block.children) {
        const range = blockRange(b);
        switch (b.kind) {
            case 'pou':
                out.push({
                    name: b.name ?? b.keyword,
                    detail: [b.keyword, ...b.modifiers].join(' ') + (b.returnType ? ` : ${b.returnType}` : ''),
                    kind: POU_KINDS[b.keyword] ?? 'module',
                    range,
                    selection: b.nameToken ? tokenRange(b.nameToken) : tokenRange(b.start),
                    children: symbolsOf(b),
                });
                break;
            case 'var':
            case 'struct':
            case 'union': {
                const constant = b.modifiers.includes('CONSTANT');
                const members = declSymbols(b, b.kind === 'var' ? (constant ? 'constant' : 'variable') : 'field');
                if (b.kind === 'var') {
                    out.push({
                        name: [b.keyword, ...b.modifiers].join(' '),
                        detail: `${b.decls.length} declaration${b.decls.length === 1 ? '' : 's'}`,
                        kind: 'package',
                        range,
                        selection: tokenRange(b.start),
                        children: members,
                    });
                } else {
                    out.push(...members);
                }
                break;
            }
            case 'type':
                out.push(...symbolsOf(b));
                break;
            case 'typedef': {
                const m = b.modifiers[0] ?? '';
                out.push({
                    name: b.name ?? 'TYPE',
                    detail: m,
                    kind: m === 'ENUM' ? 'enum' : m === 'ALIAS' ? 'typeParameter' : 'struct',
                    range,
                    selection: b.nameToken ? tokenRange(b.nameToken) : tokenRange(b.start),
                    children: symbolsOf(b),
                });
                break;
            }
            case 'region':
                out.push({
                    name: b.name ?? 'REGION',
                    detail: 'REGION',
                    kind: 'namespace',
                    range,
                    selection: tokenRange(b.start),
                    children: symbolsOf(b),
                });
                break;
            default:
                out.push(...symbolsOf(b));
        }
    }
    return out;
}

function declSymbols(b: Block, kind: SymbolKindName): SymbolNode[] {
    const out: SymbolNode[] = [];
    for (const d of b.decls) {
        for (const n of d.names) {
            const sel = tokenRange(n);
            const end = d.end ? tokenRange(d.end) : sel;
            out.push({
                name: n.text,
                detail: d.typeText,
                kind,
                range: { startLine: sel.startLine, startCol: sel.startCol, endLine: end.endLine, endCol: end.endCol },
                selection: sel,
                children: [],
            });
        }
    }
    // anonymous structs (SCL) nested in declarations
    for (const c of b.children) {
        out.push(...declSymbols(c, 'field'));
    }
    return out;
}
