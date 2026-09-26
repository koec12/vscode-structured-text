/**
 * Block tree of a Structured Text / SCL document: POUs, TYPE definitions,
 * VAR sections with their declarations, control structures and SCL regions.
 * Tolerant of incomplete code: unmatched END_ keywords are ignored and
 * unclosed blocks end at the last token.
 */
import { CONTROL_OPENERS, isPouHead, isVarKeyword, POU_HEADS } from './analysis';
import type { Dialect } from './dialect';
import { isNonCode, type Token, upper } from './lexer';

export type BlockKind = 'file' | 'pou' | 'type' | 'typedef' | 'var' | 'struct' | 'union' | 'control' | 'region';

export interface Declaration {
    names: Token[];
    typeTokens: Token[];
    /** Type text with single spaces between words, e.g. `ARRAY[1..10] OF INT`. */
    typeText: string;
    hasInit: boolean;
    start: Token;
    end?: Token;
}

export interface Block {
    kind: BlockKind;
    /** UPPER keyword that opened the block (FUNCTION_BLOCK, VAR_INPUT, IF, ...). */
    keyword: string;
    name?: string;
    nameToken?: Token;
    /** UPPER modifiers (CONSTANT, RETAIN, PUBLIC, ...). For typedefs: STRUCT / UNION / ENUM / ALIAS. */
    modifiers: string[];
    returnType?: string;
    start: Token;
    end?: Token;
    /** SCL: the BEGIN token of a POU. */
    begin?: Token;
    children: Block[];
    decls: Declaration[];
    parent?: Block;
}

const ACCESS_MODIFIERS = new Set(['PUBLIC', 'PRIVATE', 'PROTECTED', 'INTERNAL', 'ABSTRACT', 'FINAL']);
const VAR_MODIFIERS = new Set(['CONSTANT', 'RETAIN', 'NON_RETAIN', 'PERSISTENT', 'DB_SPECIFIC']);

interface DeclState {
    phase: 'start' | 'names' | 'type' | 'init' | 'skip';
    current?: Declaration;
    depth: number;
}

export function typeTextOf(tokens: Token[]): string {
    let out = '';
    for (const t of tokens) {
        const tight = /^[\[\]().,^]$|^\.\.$/.test(t.text) || /[\[(.]$/.test(out) || out.endsWith('..');
        out += out === '' || tight ? t.text : ' ' + t.text;
    }
    return out;
}

export function parseStructure(tokens: Token[], dialect: Dialect): Block {
    const code = tokens.filter((t) => !isNonCode(t));
    const first = code[0] ?? tokens[0] ?? { kind: 'ws', text: '', offset: 0, line: 0, col: 0 };
    const root: Block = { kind: 'file', keyword: '', modifiers: [], start: first, children: [], decls: [] };
    const stack: Block[] = [root];
    const declStates = new Map<Block, DeclState>();
    const top = () => stack[stack.length - 1];

    const open = (b: Omit<Block, 'children' | 'decls' | 'modifiers' | 'parent'> & { modifiers?: string[] }) => {
        const block: Block = { modifiers: [], ...b, children: [], decls: [], parent: top() };
        top().children.push(block);
        stack.push(block);
        if (block.kind === 'var' || block.kind === 'struct' || block.kind === 'union') {
            declStates.set(block, { phase: 'start', depth: 0 });
        }
        return block;
    };
    const closeTo = (pred: (b: Block) => boolean, end: Token): Block | undefined => {
        for (let k = stack.length - 1; k > 0; k--) {
            if (pred(stack[k])) {
                const closed = stack[k];
                for (let j = stack.length - 1; j >= k; j--) {
                    stack[j].end ??= end;
                }
                stack.length = k;
                return closed;
            }
        }
        return undefined;
    };
    const nameAt = (k: number): Token | undefined => {
        const t = code[k];
        return t && (t.kind === 'word' || t.kind === 'quotedId') ? t : undefined;
    };
    const unquote = (t: Token) => (t.kind === 'quotedId' ? t.text.replace(/^"|"$/g, '') : t.text);

    for (let k = 0; k < code.length; k++) {
        const t = code[k];
        const prev = code[k - 1];
        const u = prev && prev.kind === 'op' && prev.text === '.' ? '' : upper(t);
        const cur = top();

        // --- declaration containers consume their tokens first
        const ds = declStates.get(cur);
        if (ds && !(u === 'END_VAR' || u === 'END_STRUCT' || u === 'END_UNION')) {
            if (ds.phase === 'type' && ds.depth === 0 && (u === 'STRUCT' || u === 'UNION')) {
                if (ds.current) {
                    ds.current.typeTokens.push(t);
                    ds.current.typeText = u;
                }
                open({ kind: u === 'STRUCT' ? 'struct' : 'union', keyword: u, start: t });
                continue;
            }
            handleDeclToken(cur, ds, t, u);
            continue;
        }

        if (POU_HEADS.has(u) && isPouHead(prev, t)) {
            const block = open({ kind: 'pou', keyword: u, start: t });
            let j = k + 1;
            while (ACCESS_MODIFIERS.has(upper(code[j]))) {
                block.modifiers.push(upper(code[j]));
                j++;
            }
            const n = nameAt(j);
            if (n && n.line === t.line) {
                block.nameToken = n;
                block.name = unquote(n);
                j++;
                if (code[j]?.kind === 'op' && code[j].text === ':' && code[j].line === t.line) {
                    const rt: Token[] = [];
                    j++;
                    while (code[j] && code[j].line === t.line && !(code[j].kind === 'op' && code[j].text === ';')) {
                        rt.push(code[j]);
                        j++;
                    }
                    block.returnType = typeTextOf(rt);
                }
                k = j - 1;
            }
            continue;
        }
        if (u.startsWith('END_') && POU_HEADS.has(u.slice(4))) {
            const kw = u.slice(4);
            closeTo((b) => b.kind === 'pou' && b.keyword === kw, t);
            continue;
        }
        if (u === 'BEGIN') {
            const pou = [...stack].reverse().find((b) => b.kind === 'pou');
            if (pou) {
                pou.begin = t;
            }
            continue;
        }
        if (isVarKeyword(u)) {
            const block = open({ kind: 'var', keyword: u, start: t });
            while (VAR_MODIFIERS.has(upper(code[k + 1]))) {
                block.modifiers.push(upper(code[k + 1]));
                k++;
            }
            continue;
        }
        if (u === 'END_VAR') {
            closeTo((b) => b.kind === 'var', t);
            continue;
        }
        if (u === 'TYPE') {
            open({ kind: 'type', keyword: u, start: t });
            const n = nameAt(k + 1);
            if (n) {
                open({ kind: 'typedef', keyword: 'TYPE', start: n, nameToken: n, name: unquote(n) });
                k++;
            }
            continue;
        }
        if (u === 'END_TYPE') {
            closeTo((b) => b.kind === 'type', t);
            continue;
        }
        if (u === 'STRUCT' || u === 'UNION') {
            if (cur.kind === 'typedef') {
                cur.modifiers.push(u);
            }
            open({ kind: u === 'STRUCT' ? 'struct' : 'union', keyword: u, start: t });
            continue;
        }
        if (u === 'END_STRUCT' || u === 'END_UNION') {
            const kind = u === 'END_STRUCT' ? 'struct' : 'union';
            const closed = closeTo((b) => b.kind === kind, t);
            if (closed) {
                const after = top();
                if (after.kind === 'typedef') {
                    const semi = code[k + 1];
                    after.end = semi && semi.kind === 'op' && semi.text === ';' ? semi : t;
                    stack.pop();
                } else {
                    // anonymous struct inside a declaration: continue the declaration
                    const pds = declStates.get(after);
                    if (pds) {
                        pds.phase = 'type';
                    }
                }
            }
            continue;
        }
        if (cur.kind === 'type') {
            const n = nameAt(k);
            if (n && code[k + 1]?.kind === 'op' && code[k + 1].text === ':') {
                open({ kind: 'typedef', keyword: 'TYPE', start: n, nameToken: n, name: unquote(n) });
                k++;
            }
            continue;
        }
        if (cur.kind === 'typedef') {
            if (t.kind === 'op' && t.text === '(' && cur.modifiers.length === 0) {
                cur.modifiers.push('ENUM');
            } else if (t.kind === 'op' && t.text === ';') {
                if (cur.modifiers.length === 0) {
                    cur.modifiers.push('ALIAS');
                }
                cur.end = t;
                stack.pop();
            }
            continue;
        }
        if (u in CONTROL_OPENERS) {
            open({ kind: 'control', keyword: u, start: t });
            continue;
        }
        if (u.startsWith('END_') && u.slice(4) in CONTROL_OPENERS) {
            const kw = u.slice(4);
            closeTo((b) => b.kind === 'control' && b.keyword === kw, t);
            continue;
        }
        if (dialect.regions && u === 'REGION') {
            const raw = code[k + 1];
            const block = open({ kind: 'region', keyword: u, start: t });
            if (raw && raw.kind === 'raw' && raw.line === t.line) {
                block.name = raw.text;
                block.nameToken = raw;
                k++;
            }
            continue;
        }
        if (dialect.regions && u === 'END_REGION') {
            closeTo((b) => b.kind === 'region', t);
        }
    }
    const last = code[code.length - 1] ?? first;
    for (let j = stack.length - 1; j > 0; j--) {
        stack[j].end ??= last;
    }
    root.end = last;
    return root;
}

function handleDeclToken(block: Block, ds: DeclState, t: Token, u: string): void {
    const isOp = (s: string) => t.kind === 'op' && t.text === s;
    switch (ds.phase) {
        case 'start':
            if (t.kind === 'word' || t.kind === 'quotedId') {
                ds.current = { names: [t], typeTokens: [], typeText: '', hasInit: false, start: t };
                ds.phase = 'names';
            } else if (!isOp(';')) {
                ds.phase = 'skip';
            }
            return;
        case 'names':
            if (isOp(':')) {
                ds.phase = 'type';
                ds.depth = 0;
            } else if ((t.kind === 'word' || t.kind === 'quotedId') && u !== 'AT' && ds.current) {
                const prev = ds.current.names[ds.current.names.length - 1];
                if (prev && t !== prev) {
                    ds.current.names.push(t);
                }
            } else if (isOp(';')) {
                ds.phase = 'start';
                ds.current = undefined;
            }
            return;
        case 'type':
        case 'init':
            if (isOp('(') || isOp('[')) {
                ds.depth++;
            } else if (isOp(')') || isOp(']')) {
                ds.depth = Math.max(0, ds.depth - 1);
            }
            if (ds.depth === 0 && isOp(';')) {
                if (ds.current) {
                    ds.current.end = t;
                    if (!ds.current.typeText) {
                        ds.current.typeText = typeTextOf(ds.current.typeTokens);
                    }
                    block.decls.push(ds.current);
                }
                ds.phase = 'start';
                ds.current = undefined;
                return;
            }
            if (ds.phase === 'type' && ds.depth === 0 && isOp(':=')) {
                ds.phase = 'init';
                if (ds.current) {
                    ds.current.hasInit = true;
                }
                return;
            }
            if (ds.phase === 'type' && ds.current) {
                ds.current.typeTokens.push(t);
            }
            return;
        case 'skip':
            if (isOp(';')) {
                ds.phase = 'start';
            }
            return;
    }
}

/** Depth-first iteration over all blocks. */
export function* walk(block: Block): Generator<Block> {
    yield block;
    for (const c of block.children) {
        yield* walk(c);
    }
}
