/**
 * Line building, indentation, spacing and alignment.
 *
 * The formatter never joins lines: it only splits lines (one statement per line,
 * call layout), re-indents them, normalises the spacing between tokens and pads
 * for alignment. Token texts are never changed here (casing happens before).
 */
import { type Analysis, CONTROL_OPENERS, isPouHeadAt, isVarKeyword } from '../language/analysis';
import type { Dialect } from '../language/dialect';
import { keywordSets, SCL_HEADER_ATTRIBUTES } from '../language/keywords';
import type { Token } from '../language/lexer';
import type { FormatOptions } from './options';

interface LTok {
    tok: Token;
    idx: number;
    /** Original whitespace before this token on the same source line. */
    gap: string;
}

type LineKind = 'comment' | 'verbatim' | 'decl' | 'assign' | 'label' | 'code';

interface Line {
    toks: LTok[];
    blankBefore: number;
    firstOnOrigLine: boolean;
    origIndent: string;
    indent: number;
    kind: LineKind;
    /** Token position of the aligned operator (`:` for declarations, `:=` / `=>` for assignments). */
    opPos: number;
    /** Declaration block id (for declaration alignment groups). */
    blockId: number;
    /** Run key for assignment alignment. */
    runKey: string;
    firstUpper: string;
    // render results
    left: string;
    right: string;
    code: string;
    comment: string;
    commentGap: string;
    pad: number;
}

const VAR_MODIFIERS = new Set(['CONSTANT', 'RETAIN', 'NON_RETAIN', 'PERSISTENT', 'DB_SPECIFIC']);
const HEADER_ATTRIBUTES = new Set(SCL_HEADER_ATTRIBUTES);
const ASSIGN_OPS = new Set([':=', 'S=', 'R=', 'REF=', '?=']);
const BINARY_OPS = new Set(['+', '-', '*', '/', '**', '=', '<>', '<', '>', '<=', '>=', '&']);
const OPEN_BRACKETS = new Set(['(', '[']);
const CLOSE_BRACKETS = new Set([')', ']']);

interface Entry {
    kind: string;
    base: number;
    inc: number;
    id: number;
}

export class Layout {
    private readonly tokens: Token[];
    private readonly a: Analysis;
    private readonly dialect: Dialect;
    private readonly o: FormatOptions;
    private readonly sets;
    private readonly keywordLike: Set<string>;

    constructor(tokens: Token[], analysis: Analysis, dialect: Dialect, options: FormatOptions) {
        this.tokens = tokens;
        this.a = analysis;
        this.dialect = dialect;
        this.o = options;
        this.sets = keywordSets(dialect.id);
        this.keywordLike = new Set([...this.sets.control, ...this.sets.operators, ...this.sets.pou, ...this.sets.vars, ...this.sets.modifiers]);
    }

    /** Upper-case keyword text of token `i` ('' for non-words and member names). */
    private kw(i: number): string {
        const t = this.tokens[i];
        return t.kind === 'word' && !this.a.afterDot[i] ? t.text.toUpperCase() : '';
    }

    private isOp(i: number, ...ops: string[]): boolean {
        const t = this.tokens[i];
        return t !== undefined && t.kind === 'op' && ops.includes(t.text);
    }

    private isCode(i: number): boolean {
        return this.a.codePos[i] >= 0;
    }

    private nextCodeIdx(i: number): number {
        const p = this.a.codePos[i];
        if (p >= 0) {
            return p + 1 < this.a.code.length ? this.a.code[p + 1] : -1;
        }
        for (let j = i + 1; j < this.tokens.length; j++) {
            if (this.isCode(j)) {
                return j;
            }
        }
        return -1;
    }

    private prevCodeIdx(i: number): number {
        for (let j = i - 1; j >= 0; j--) {
            if (this.isCode(j)) {
                return j;
            }
        }
        return -1;
    }

    // ------------------------------------------------------------------ breaks

    private computeBreaks(): boolean[] {
        const { tokens, a, o } = this;
        const n = tokens.length;
        const breakBefore = new Array<boolean>(n).fill(false);
        // next non-whitespace token on the same source line, and whether code follows later on that line
        const nextOnLine = new Int32Array(n).fill(-1);
        const codeAfter = new Array<boolean>(n).fill(false);
        let seg: number[] = [];
        const flush = () => {
            let anyCode = false;
            for (let k = seg.length - 1; k >= 0; k--) {
                codeAfter[seg[k]] = anyCode;
                nextOnLine[seg[k]] = k + 1 < seg.length ? seg[k + 1] : -1;
                if (this.isCode(seg[k])) {
                    anyCode = true;
                }
            }
            seg = [];
        };
        for (let i = 0; i < n; i++) {
            const t = tokens[i];
            if (t.kind === 'newline') {
                flush();
            } else if (t.kind !== 'ws') {
                seg.push(i);
                if (t.kind === 'blockComment' && t.text.includes('\n')) {
                    flush();
                }
            }
        }
        flush();

        const breakAfterIfCode = (i: number) => {
            if (codeAfter[i] && nextOnLine[i] >= 0) {
                breakBefore[nextOnLine[i]] = true;
            }
        };
        /** Break after `i`, but keep a directly following comment on the same line. */
        const breakAfterKeepComment = (i: number) => {
            let j = nextOnLine[i];
            if (j < 0) {
                return;
            }
            if (tokens[j].kind === 'lineComment' || tokens[j].kind === 'blockComment') {
                j = nextOnLine[j];
                if (j < 0) {
                    return;
                }
            }
            breakBefore[j] = true;
        };

        if (o.splitStatements) {
            let varDepth = 0;
            for (const i of a.code) {
                const u = this.kw(i);
                const t = tokens[i];
                if (t.kind === 'op') {
                    if (t.text === ';' || a.labelColons.has(i)) {
                        breakAfterIfCode(i);
                    }
                    continue;
                }
                if (!u) {
                    continue;
                }
                if (a.caseOfs.has(i) || ((u === 'THEN' || u === 'DO' || u === 'ELSE' || u === 'REPEAT' || u === 'BEGIN') && !a.inDecl[i])) {
                    breakAfterIfCode(i);
                }
                if (isVarKeyword(u)) {
                    varDepth++;
                    breakBefore[i] = true;
                    let j = i;
                    for (let nx = this.nextCodeIdx(j); nx >= 0 && VAR_MODIFIERS.has(this.kw(nx)); nx = this.nextCodeIdx(nx)) {
                        j = nx;
                    }
                    breakAfterIfCode(j);
                } else if (u === 'END_VAR') {
                    varDepth = Math.max(0, varDepth - 1);
                }
                if (u === 'STRUCT' || u === 'UNION') {
                    breakAfterIfCode(i);
                    if (varDepth === 0) {
                        breakBefore[i] = true;
                    }
                }
                if (u.startsWith('END_') && this.keywordLike.has(u)) {
                    breakBefore[i] = true;
                    const nx = this.nextCodeIdx(i);
                    if (nx < 0 || !this.isOp(nx, ';')) {
                        breakAfterIfCode(i);
                    }
                }
                if (u === 'ELSIF' || u === 'ELSE' || u === 'UNTIL' || u === 'TYPE' || u === 'BEGIN' || (this.dialect.regions && u === 'REGION') || isPouHeadAt(tokens, a, i)) {
                    breakBefore[i] = true;
                }
            }
        }

        if (o.callStyle !== 'preserve') {
            for (const call of this.findLayoutCalls()) {
                breakBefore[call.open] = true;
                breakAfterKeepComment(call.open);
                for (const c of call.commas) {
                    breakAfterKeepComment(c);
                }
                breakBefore[call.close] = true;
            }
        }
        return breakBefore;
    }

    /** Calls with named arguments that get the guideline 4.1.1.2.6/7 layout. */
    private findLayoutCalls(): { open: number; close: number; commas: number[] }[] {
        const { tokens, a, o } = this;
        const result: { open: number; close: number; commas: number[] }[] = [];
        const depthAt = new Map<number, number>();
        let depth = 0;
        for (const i of a.code) {
            if (this.isOp(i, '(', '[')) {
                depthAt.set(i, depth);
                depth++;
            } else if (this.isOp(i, ')', ']')) {
                depth = Math.max(0, depth - 1);
            }
        }
        for (let ci = 1; ci < a.code.length; ci++) {
            const p = a.code[ci];
            if (!this.isOp(p, '(') || a.inDecl[p]) {
                continue;
            }
            const callee = tokens[a.code[ci - 1]];
            const calleeIdx = a.code[ci - 1];
            const isCallee =
                (callee.kind === 'word' && !this.keywordLike.has(this.kw(calleeIdx))) ||
                callee.kind === 'quotedId' ||
                callee.kind === 'local' ||
                (callee.kind === 'op' && (callee.text === ']' || callee.text === '^'));
            if (!isCallee) {
                continue;
            }
            const n1 = tokens[a.code[ci + 1]];
            const n2 = tokens[a.code[ci + 2]];
            if (!n1 || !n2 || !(n1.kind === 'word' || n1.kind === 'local') || !(n2.kind === 'op' && (n2.text === ':=' || n2.text === '=>'))) {
                continue;
            }
            let d = 0;
            let close = -1;
            const commas: number[] = [];
            for (let k = ci; k < a.code.length; k++) {
                const j = a.code[k];
                if (this.isOp(j, '(', '[')) {
                    d++;
                } else if (this.isOp(j, ')', ']')) {
                    d--;
                    if (d === 0) {
                        close = j;
                        break;
                    }
                } else if (d === 1 && this.isOp(j, ',')) {
                    commas.push(j);
                }
            }
            if (close < 0) {
                continue;
            }
            const multiLine = tokens[p].line !== tokens[close].line || callee.line !== tokens[p].line;
            const expandAlways = o.callStyle === 'guideline-always' && depthAt.get(p) === 0 && commas.length + 1 >= o.callExpandMinArgs;
            if (multiLine || expandAlways) {
                result.push({ open: p, close, commas });
            }
        }
        return result;
    }

    // ------------------------------------------------------------------ lines

    private buildLines(breakBefore: boolean[]): Line[] {
        const lines: Line[] = [];
        let cur: Line | undefined;
        let blank = 0;
        let hasContent = false;
        let ws = '';
        for (let i = 0; i < this.tokens.length; i++) {
            const t = this.tokens[i];
            if (t.kind === 'newline') {
                if (!hasContent) {
                    blank++;
                }
                cur = undefined;
                hasContent = false;
                ws = '';
                continue;
            }
            if (t.kind === 'ws') {
                ws += t.text;
                continue;
            }
            if (!cur || (breakBefore[i] && cur.toks.length > 0)) {
                cur = {
                    toks: [],
                    blankBefore: hasContent ? 0 : blank,
                    firstOnOrigLine: !hasContent,
                    origIndent: hasContent ? '' : ws,
                    indent: 0,
                    kind: 'code',
                    opPos: -1,
                    blockId: -1,
                    runKey: '',
                    firstUpper: '',
                    left: '',
                    right: '',
                    code: '',
                    comment: '',
                    commentGap: '',
                    pad: 1,
                };
                if (!hasContent) {
                    blank = 0;
                }
                lines.push(cur);
                cur.toks.push({ tok: t, idx: i, gap: '' });
            } else {
                cur.toks.push({ tok: t, idx: i, gap: ws });
            }
            ws = '';
            hasContent = true;
        }
        return lines;
    }

    // ------------------------------------------------------------ indentation

    private indentLines(lines: Line[]): void {
        const { a, o } = this;
        const stack: Entry[] = [];
        let nextId = 0;
        const level = () => (stack.length ? stack[stack.length - 1].base + stack[stack.length - 1].inc : 0);
        const push = (kind: string, inc: number) => stack.push({ kind, base: level(), inc, id: nextId++ });
        const nearest = (kind: string) => {
            for (let k = stack.length - 1; k >= 0; k--) {
                if (stack[k].kind === kind) {
                    return k;
                }
            }
            return -1;
        };
        const closerKind = (u: string): string | undefined => {
            if (!u.startsWith('END_')) {
                return undefined;
            }
            const rest = u.slice(4);
            if (rest in CONTROL_OPENERS) {
                return rest;
            }
            if (rest === 'VAR') {
                return 'VAR';
            }
            if (rest === 'STRUCT' || rest === 'UNION') {
                return 'STRUCT';
            }
            if (rest === 'TYPE') {
                return 'TYPE';
            }
            if (rest === 'REGION' && this.dialect.regions) {
                return 'REGION';
            }
            if (this.sets.pou.has(u)) {
                return 'POU';
            }
            return undefined;
        };

        let parenDepth = 0;
        let stmtOpen = false;
        let lastCode = '';

        for (const line of lines) {
            const codeToks = line.toks.filter((lt) => this.isCode(lt.idx));
            const top = stack[stack.length - 1];
            if (codeToks.length === 0) {
                line.kind = 'comment';
                line.indent = level() + parenDepth;
                continue;
            }
            const f = codeToks[0];
            const fu = this.kw(f.idx);
            line.firstUpper = fu;

            if (
                this.dialect.headerAttributes &&
                HEADER_ATTRIBUTES.has(fu) &&
                (top === undefined || top.kind === 'POU' || top.kind === 'TYPE') &&
                !codeToks.some((lt) => this.isOp(lt.idx, ':=', ';'))
            ) {
                line.kind = 'verbatim';
                line.indent = level();
                continue;
            }

            let indent: number;
            let firstHandled = true;
            const parenBefore = parenDepth;
            const stmtOpenBefore = stmtOpen;
            const ck = closerKind(fu);
            if (ck) {
                const k = nearest(ck);
                if (k >= 0) {
                    indent = stack[k].base;
                    stack.length = k;
                } else {
                    indent = level();
                }
            } else if (fu === 'ELSIF') {
                const k = nearest('IF');
                indent = k >= 0 ? stack[k].base : Math.max(0, level() - 1);
            } else if (fu === 'ELSE') {
                if (top && (top.kind === 'LABEL' || top.kind === 'CASE')) {
                    if (top.kind === 'LABEL') {
                        stack.pop();
                    }
                    indent = level();
                    push('LABEL', 1);
                } else {
                    const k = nearest('IF');
                    indent = k >= 0 ? stack[k].base : Math.max(0, level() - 1);
                }
            } else if (fu === 'UNTIL') {
                const k = nearest('REPEAT');
                indent = k >= 0 ? stack[k].base : Math.max(0, level() - 1);
            } else if (a.labelStarts.has(f.idx)) {
                if (top && top.kind === 'LABEL') {
                    stack.pop();
                }
                indent = level();
                push('LABEL', 1);
                line.kind = 'label';
            } else if (fu === 'BEGIN') {
                const k = nearest('POU');
                indent = k >= 0 ? stack[k].base : level();
            } else {
                firstHandled = false;
                const structural = this.isStructuralFirst(f.idx, fu);
                const cont =
                    !structural && stmtOpen && !OPEN_BRACKETS.has(lastCode) && lastCode !== ',' && !this.isOp(f.idx, ')', ']') ? 1 : 0;
                indent = level() + (structural ? 0 : parenDepth + cont);
            }
            line.indent = indent;

            // classify for alignment (state at line start)
            const inner = stack[stack.length - 1];
            if (line.kind !== 'label') {
                if (inner && (inner.kind === 'VAR' || inner.kind === 'STRUCT') && !stmtOpenBefore && parenBefore === 0 && !this.keywordLike.has(fu)) {
                    const colon = this.findDepth0(codeToks, ':');
                    const assign = this.findDepth0(codeToks, ':=');
                    const last = codeToks[codeToks.length - 1];
                    if (colon >= 0 && this.isOp(last.idx, ';') && (assign === -1 || assign > colon)) {
                        line.kind = 'decl';
                        line.opPos = line.toks.indexOf(codeToks[colon]);
                        line.blockId = inner.id;
                    }
                } else if (!inner || (inner.kind !== 'VAR' && inner.kind !== 'STRUCT' && inner.kind !== 'TYPE')) {
                    const isStart = !stmtOpenBefore || (parenBefore > 0 && (lastCode === '(' || lastCode === ','));
                    const op = isStart ? this.assignmentOp(codeToks, parenBefore > 0) : -1;
                    if (op >= 0) {
                        line.kind = 'assign';
                        line.opPos = line.toks.indexOf(codeToks[op]);
                        line.runKey = `${indent}|${parenBefore > 0 ? 'arg' : 'stmt'}`;
                    }
                }
            }

            // update block stack, bracket depth and statement state
            codeToks.forEach((lt, k) => {
                const i = lt.idx;
                const u = this.kw(i);
                const t = lt.tok;
                if (t.kind === 'op') {
                    if (OPEN_BRACKETS.has(t.text)) {
                        parenDepth++;
                    } else if (CLOSE_BRACKETS.has(t.text)) {
                        parenDepth = Math.max(0, parenDepth - 1);
                    }
                }
                if (!(k === 0 && firstHandled)) {
                    if (isPouHeadAt(this.tokens, a, i)) {
                        push('POU', o.indentPouBody ? 1 : 0);
                    } else if (isVarKeyword(u)) {
                        push('VAR', 1);
                    } else if (u === 'TYPE') {
                        push('TYPE', 1);
                    } else if (u === 'STRUCT' || u === 'UNION') {
                        push('STRUCT', 1);
                    } else if (u in CONTROL_OPENERS && !a.inDecl[i]) {
                        push(u, 1);
                    } else if (u === 'REGION' && this.dialect.regions) {
                        push('REGION', 1);
                    } else {
                        const kind = closerKind(u);
                        if (kind) {
                            const idx = nearest(kind);
                            if (idx >= 0) {
                                stack.length = idx;
                            }
                        }
                    }
                }
                stmtOpen = !this.isTerminator(i, u);
                lastCode = t.kind === 'op' ? t.text : 'w';
            });
            if (isPouHeadAt(this.tokens, a, f.idx) || fu === 'TYPE') {
                stmtOpen = lastCode === ':';
            } else if (fu === 'REGION') {
                stmtOpen = false;
            }
        }

        // comments directly above a CASE label / ELSIF / ELSE belong to that branch
        for (let k = 0; k < lines.length; k++) {
            const l = lines[k];
            if (l.kind === 'label' || l.firstUpper === 'ELSIF' || l.firstUpper === 'ELSE') {
                for (let j = k - 1; j >= 0 && lines[j].kind === 'comment' && lines[j + 1].blankBefore === 0; j--) {
                    if (lines[j].indent > l.indent) {
                        lines[j].indent = l.indent;
                    }
                }
            }
        }
    }

    private isStructuralFirst(i: number, u: string): boolean {
        if (!u) {
            return false;
        }
        return (
            u.startsWith('END_') ||
            ['ELSIF', 'ELSE', 'UNTIL', 'THEN', 'DO', 'OF', 'STRUCT', 'UNION', 'TYPE', 'BEGIN', 'REGION'].includes(u) ||
            isVarKeyword(u) ||
            isPouHeadAt(this.tokens, this.a, i)
        );
    }

    private isTerminator(i: number, u: string): boolean {
        const { a } = this;
        if (this.isOp(i, ';') || a.labelColons.has(i) || a.caseOfs.has(i)) {
            return true;
        }
        if (!u) {
            return false;
        }
        if (['THEN', 'DO', 'ELSE', 'REPEAT', 'BEGIN', 'STRUCT', 'UNION'].includes(u) || isVarKeyword(u)) {
            return true;
        }
        if (VAR_MODIFIERS.has(u) && a.inDecl[i]) {
            const p = this.prevCodeIdx(i);
            return p >= 0 && (isVarKeyword(this.kw(p)) || VAR_MODIFIERS.has(this.kw(p)));
        }
        return u.startsWith('END_') && this.keywordLike.has(u);
    }

    private findDepth0(toks: LTok[], op: string): number {
        let d = 0;
        for (let k = 0; k < toks.length; k++) {
            const t = toks[k].tok;
            if (t.kind !== 'op') {
                continue;
            }
            if (OPEN_BRACKETS.has(t.text)) {
                d++;
            } else if (CLOSE_BRACKETS.has(t.text)) {
                d--;
            } else if (d === 0 && t.text === op) {
                return k;
            }
        }
        return -1;
    }

    /** Position of the assignment operator if the line starts with `lvalue :=` (or `name =>` in calls). */
    private assignmentOp(toks: LTok[], inCall: boolean): number {
        const first = toks[0];
        if (!first) {
            return -1;
        }
        const ft = first.tok;
        const isName = (t: Token, i: number) =>
            (t.kind === 'word' && !this.keywordLike.has(this.kw(i))) || t.kind === 'local' || t.kind === 'quotedId' || t.kind === 'address';
        if (!isName(ft, first.idx) && !(ft.kind === 'word' && this.sets.instance.has(ft.text.toUpperCase()))) {
            return -1;
        }
        let k = 1;
        while (k < toks.length) {
            const t = toks[k].tok;
            if (t.kind !== 'op') {
                return -1;
            }
            if (ASSIGN_OPS.has(t.text) || (inCall && t.text === '=>')) {
                return t.text === ':=' || t.text === '=>' ? k : -1;
            }
            if (t.text === '.') {
                if (!toks[k + 1] || toks[k + 1].tok.kind === 'op') {
                    return -1;
                }
                k += 2;
            } else if (t.text === '^') {
                k++;
            } else if (t.text === '[') {
                let d = 0;
                for (; k < toks.length; k++) {
                    const x = toks[k].tok;
                    if (x.kind === 'op' && x.text === '[') {
                        d++;
                    } else if (x.kind === 'op' && x.text === ']') {
                        d--;
                        if (d === 0) {
                            break;
                        }
                    }
                }
                k++;
            } else {
                return -1;
            }
        }
        return -1;
    }

    // --------------------------------------------------------------- spacing

    private isUnary(i: number): boolean {
        const p = this.prevCodeIdx(i);
        if (p < 0) {
            return true;
        }
        const pt = this.tokens[p];
        if (pt.kind === 'op') {
            return !CLOSE_BRACKETS.has(pt.text) && pt.text !== '^';
        }
        if (pt.kind === 'word') {
            const u = this.kw(p);
            return u !== '' && this.keywordLike.has(u) && !this.sets.types.has(u);
        }
        return false;
    }

    private space(prev: LTok, cur: LTok): string {
        const a = prev.tok;
        const b = cur.tok;
        const orig = cur.gap;
        const keep = orig === '' ? '' : ' ';
        if (b.kind === 'lineComment' || b.kind === 'blockComment') {
            return orig === '' || /[\t \f\v]/.test(orig) ? ' ' : orig;
        }
        if (a.kind === 'lineComment' || a.kind === 'blockComment') {
            return keep;
        }
        if (a.kind === 'pragma') {
            return ' ';
        }
        if (b.kind === 'pragma' || a.kind === 'unknown' || b.kind === 'unknown') {
            return keep;
        }
        if (b.kind === 'raw' || a.kind === 'raw') {
            return ' ';
        }
        const aOp = a.kind === 'op' ? a.text : '';
        const bOp = b.kind === 'op' ? b.text : '';
        if (bOp === ',' || bOp === ';') {
            return '';
        }
        if (OPEN_BRACKETS.has(aOp) || CLOSE_BRACKETS.has(bOp)) {
            return '';
        }
        if (aOp === ',') {
            return ' ';
        }
        if (aOp === '.' || bOp === '.' || aOp === '..' || bOp === '..') {
            return '';
        }
        if (ASSIGN_OPS.has(aOp) || ASSIGN_OPS.has(bOp) || aOp === '=>' || bOp === '=>') {
            return ' ';
        }
        if (bOp === ':') {
            return this.a.labelColons.has(cur.idx) ? '' : ' ';
        }
        if (aOp === ':') {
            return ' ';
        }
        if (bOp === '^') {
            return '';
        }
        if (aOp === '^') {
            return BINARY_OPS.has(bOp) ? ' ' : '';
        }
        if (aOp === '#' || bOp === '#' || aOp === '@' || bOp === '@') {
            return keep;
        }
        if (bOp === '(') {
            if (a.kind === 'word') {
                const u = this.kw(prev.idx);
                return u && this.keywordLike.has(u) && !this.sets.types.has(u) ? ' ' : '';
            }
            if (a.kind === 'quotedId' || a.kind === 'local' || a.kind === 'number' || CLOSE_BRACKETS.has(aOp)) {
                return '';
            }
            if ((aOp === '-' || aOp === '+') && this.isUnary(prev.idx)) {
                return '';
            }
            return ' ';
        }
        if (bOp === '[') {
            if (a.kind === 'word' || a.kind === 'quotedId' || a.kind === 'local' || CLOSE_BRACKETS.has(aOp)) {
                return '';
            }
            return ' ';
        }
        if (BINARY_OPS.has(bOp)) {
            return ' ';
        }
        if (BINARY_OPS.has(aOp)) {
            if ((aOp === '-' || aOp === '+') && this.isUnary(prev.idx)) {
                return '';
            }
            return ' ';
        }
        if (CLOSE_BRACKETS.has(aOp)) {
            return ' ';
        }
        if (a.kind !== 'op' && b.kind !== 'op') {
            return ' ';
        }
        return keep;
    }

    private render(toks: LTok[], from: number, to: number): string {
        let s = '';
        for (let k = from; k < to; k++) {
            s += k === from ? toks[k].tok.text : this.space(toks[k - 1], toks[k]) + toks[k].tok.text;
        }
        return s;
    }

    private renderLines(lines: Line[]): void {
        for (const line of lines) {
            const toks = line.toks;
            if (line.kind === 'verbatim') {
                line.code = toks.map((lt, k) => (k === 0 ? '' : lt.gap) + lt.tok.text).join('');
                continue;
            }
            let lastCode = -1;
            for (let k = toks.length - 1; k >= 0; k--) {
                if (this.isCode(toks[k].idx)) {
                    lastCode = k;
                    break;
                }
            }
            if (lastCode < 0) {
                line.code = this.render(toks, 0, toks.length);
                continue;
            }
            if (lastCode + 1 < toks.length) {
                line.comment = this.render(toks, lastCode + 1, toks.length);
                line.commentGap = this.space(toks[lastCode], toks[lastCode + 1]);
            }
            if (line.opPos >= 0) {
                line.left = this.render(toks, 0, line.opPos);
                line.right = this.render(toks, line.opPos, lastCode + 1);
                line.pad = 1;
                line.code = line.left + ' ' + line.right;
            } else {
                line.code = this.render(toks, 0, lastCode + 1);
            }
        }
    }

    // ------------------------------------------------------------- alignment

    private width(indent: number): number {
        return this.o.indentUnit === '\t' ? indent * this.o.tabSize : indent * this.o.indentUnit.length;
    }

    private alignComments(group: Line[]): void {
        const commented = group.filter((l) => l.comment);
        if (!this.o.alignTrailingComments || commented.length < 2) {
            return;
        }
        const col = Math.max(...commented.map((l) => l.code.length)) + 1;
        for (const l of commented) {
            l.commentGap = ' '.repeat(col - l.code.length);
        }
    }

    private align(lines: Line[]): void {
        const { o } = this;
        // declarations: all declaration lines of one VAR / STRUCT block
        const groups = new Map<number, Line[]>();
        for (const l of lines) {
            if (l.kind === 'decl') {
                const g = groups.get(l.blockId) ?? [];
                g.push(l);
                groups.set(l.blockId, g);
            }
        }
        for (const g of groups.values()) {
            if (o.alignDeclarations) {
                const fits = (l: Line) => this.width(l.indent) + l.left.length + 1 < o.declarationMaxColumn;
                const maxLeft = Math.max(0, ...g.filter(fits).map((l) => l.left.length));
                for (const l of g) {
                    l.pad = fits(l) ? maxLeft - l.left.length + 1 : 1;
                    l.code = l.left + ' '.repeat(l.pad) + l.right;
                }
            }
            this.alignComments(g);
        }

        // assignments: runs of consecutive assignment lines
        let run: Line[] = [];
        const flush = () => {
            if (run.length > 0) {
                this.alignRun(run);
            }
            run = [];
        };
        for (const l of lines) {
            if (l.kind === 'assign' && (run.length === 0 || (l.blankBefore === 0 && l.runKey === run[0].runKey))) {
                run.push(l);
            } else {
                flush();
                if (l.kind === 'assign') {
                    run.push(l);
                }
            }
        }
        flush();
    }

    private alignRun(run: Line[]): void {
        const { o } = this;
        if (o.alignAssignments) {
            // the global column applies to statements; named call arguments align among themselves (guideline 4.1.1.2.7)
            if (o.assignmentAlignColumn > 0 && run[0].runKey.endsWith('|stmt')) {
                for (const l of run) {
                    const target = o.assignmentAlignColumn - 1 - this.width(l.indent);
                    l.pad = Math.max(1, target - l.left.length);
                }
            } else if (run.length > 1) {
                const fits = (l: Line) => this.width(l.indent) + l.left.length + 1 < o.assignmentMaxColumn;
                const maxLeft = Math.max(0, ...run.filter(fits).map((l) => l.left.length));
                for (const l of run) {
                    l.pad = fits(l) ? maxLeft - l.left.length + 1 : 1;
                }
            }
            for (const l of run) {
                l.code = l.left + ' '.repeat(l.pad) + l.right;
            }
        }
        this.alignComments(run);
    }

    // -------------------------------------------------------------- assemble

    private assemble(lines: Line[], eol: string): string {
        const { o } = this;
        // exactly one blank line between VAR sections (guideline 4.1.1.2.2)
        if (o.blankLineBetweenVarSections) {
            for (let k = 0; k < lines.length; k++) {
                if (!isVarKeyword(lines[k].firstUpper)) {
                    continue;
                }
                let c = k;
                while (c > 0 && lines[c - 1].kind === 'comment' && lines[c].blankBefore === 0) {
                    c--;
                }
                if (c > 0 && lines[c - 1].firstUpper === 'END_VAR') {
                    lines[c].blankBefore = 1;
                }
            }
        }
        const out: string[] = [];
        lines.forEach((l, k) => {
            const blanks = k === 0 ? Math.min(l.blankBefore, o.maxBlankLines) : Math.min(l.blankBefore, Math.max(o.maxBlankLines, isVarKeyword(l.firstUpper) ? 1 : 0));
            for (let b = 0; b < blanks; b++) {
                out.push('');
            }
            const first = l.toks[0].tok;
            const multiLineComment = first.kind === 'blockComment' && /[\r\n]/.test(first.text);
            const indent = multiLineComment && l.firstOnOrigLine ? l.origIndent : o.indentUnit.repeat(l.indent);
            const text = l.code + (l.comment ? l.commentGap + l.comment : '');
            out.push((indent + text).replace(/[ \t]+$/, ''));
        });
        // also strips trailing whitespace inside multi-line block comments (verify tolerates this)
        const lastLine = lines[lines.length - 1];
        const lastTok = lastLine?.toks[lastLine.toks.length - 1].tok;
        const unterminated = lastTok?.kind === 'blockComment' && !/(\*\)|\*\/)$/.test(lastTok.text);
        return out.join(eol).replace(/[ \t]+(?=\r\n|\n|\r)/g, '') + (out.length && !unterminated ? eol : '');
    }

    format(eol: string): string {
        const lines = this.buildLines(this.computeBreaks());
        this.indentLines(lines);
        this.renderLines(lines);
        this.align(lines);
        return this.assemble(lines, eol);
    }
}
