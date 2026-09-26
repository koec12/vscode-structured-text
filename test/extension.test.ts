/**
 * Smoke test of the VS Code wiring with a minimal mock of the `vscode` API:
 * activation registers the providers and they produce sensible results.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

const registered: Record<string, any> = {};
const diagnosticsSet = new Map<string, any[]>();
const settings: Record<string, unknown> = {};

vi.mock('vscode', () => {
    class Position {
        constructor(public line: number, public character: number) {}
        isBefore(o: Position) { return this.line < o.line || (this.line === o.line && this.character < o.character); }
        isAfter(o: Position) { return o.isBefore(this); }
    }
    class Range {
        start: Position;
        end: Position;
        constructor(a: any, b: any, c?: any, d?: any) {
            this.start = a instanceof Position ? a : new Position(a, b);
            this.end = a instanceof Position ? b : new Position(c, d);
        }
        contains(x: any) {
            const r = x instanceof Range ? x : new Range(x, x);
            return !r.start.isBefore(this.start) && !r.end.isAfter(this.end);
        }
        intersection(o: Range) {
            const s = this.start.isAfter(o.start) ? this.start : o.start;
            const e = this.end.isBefore(o.end) ? this.end : o.end;
            return s.isAfter(e) ? undefined : new Range(s, e);
        }
    }
    const disposable = { dispose() {} };
    const reg = (name: string) => (_sel: unknown, provider: unknown) => ((registered[name] = provider), disposable);
    return {
        Position,
        Range,
        TextEdit: class { constructor(public range: Range, public newText: string) {} },
        FoldingRange: class { constructor(public start: number, public end: number, public kind?: number) {} },
        FoldingRangeKind: { Comment: 1, Imports: 2, Region: 3 },
        DocumentSymbol: class { children: unknown[] = []; constructor(public name: string, public detail: string, public kind: number, public range: Range, public selectionRange: Range) {} },
        SymbolKind: new Proxy({}, { get: (_t, p) => String(p) }),
        Diagnostic: class { source?: string; code?: string; constructor(public range: Range, public message: string, public severity: number) {} },
        DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
        CodeAction: class { command?: unknown; diagnostics?: unknown; constructor(public title: string, public kind: unknown) {} },
        CodeActionKind: { QuickFix: 'quickfix' },
        languages: {
            registerDocumentFormattingEditProvider: reg('format'),
            registerDocumentRangeFormattingEditProvider: reg('rangeFormat'),
            registerFoldingRangeProvider: reg('folding'),
            registerDocumentSymbolProvider: reg('symbols'),
            registerCodeActionsProvider: reg('codeActions'),
            createDiagnosticCollection: () => ({ set: (uri: any, d: any[]) => diagnosticsSet.set(uri.toString(), d), delete() {}, dispose() {} }),
        },
        workspace: {
            getConfiguration: () => ({ get: (k: string, d: unknown) => (k in settings ? settings[k] : d) }),
            onDidOpenTextDocument: () => disposable,
            onDidChangeTextDocument: () => disposable,
            onDidCloseTextDocument: () => disposable,
            onDidChangeConfiguration: () => disposable,
            textDocuments: [],
        },
        window: { createOutputChannel: () => ({ appendLine() {}, dispose() {} }), showWarningMessage: vi.fn() },
    };
});

let vscode: any;

function doc(text: string, languageId = 'iec-st') {
    return {
        languageId,
        uri: { toString: () => 'file:///test', fsPath: '/test' },
        getText: () => text,
        positionAt(offset: number) {
            const before = text.slice(0, offset).split(/\r\n|\n|\r/);
            return new vscode.Position(before.length - 1, before[before.length - 1].length);
        },
    };
}

function applyEdits(text: string, edits: any[]): string {
    const lines = text.split('\n');
    const offset = (p: any) => lines.slice(0, p.line).reduce((n, l) => n + l.length + 1, 0) + p.character;
    for (const e of [...edits].sort((a, b) => offset(b.range.start) - offset(a.range.start))) {
        text = text.slice(0, offset(e.range.start)) + e.newText + text.slice(offset(e.range.end));
    }
    return text;
}

describe('extension wiring', () => {
    beforeAll(async () => {
        vscode = await import('vscode');
        const ext = await import('../src/extension');
        ext.activate({ subscriptions: [] } as any);
    });

    it('registers all providers', () => {
        expect(Object.keys(registered).sort()).toEqual(['codeActions', 'folding', 'format', 'rangeFormat', 'symbols']);
    });

    it('formats a document with editor indentation settings', () => {
        const src = 'IF a THEN\nx:=1;\nEND_IF\n';
        const edits = registered.format.provideDocumentFormattingEdits(doc(src), { tabSize: 2, insertSpaces: true });
        expect(applyEdits(src, edits)).toBe('If a Then\n  x := 1;\nEnd_If\n');
    });

    it('honours language-scoped settings', () => {
        settings['format.keywordCase'] = 'upper';
        const src = 'if a then\nend_if\n';
        const edits = registered.format.provideDocumentFormattingEdits(doc(src, 'siemens-scl'), { tabSize: 4, insertSpaces: true });
        expect(applyEdits(src, edits)).toBe('IF a THEN\nEND_IF\n');
        delete settings['format.keywordCase'];
    });

    it('range formatting only returns edits inside the range', () => {
        const src = 'a:=1;\nb:=2;\nc:=3;\n';
        const edits = registered.rangeFormat.provideDocumentRangeFormattingEdits(doc(src), new vscode.Range(1, 0, 1, 5), { tabSize: 4, insertSpaces: true });
        expect(edits.every((e: any) => e.range.start.line <= 1 && e.range.end.line >= 1)).toBe(true);
    });

    it('provides folding ranges and symbols', () => {
        const src = 'FUNCTION_BLOCK fbX\nVAR_INPUT\n    ibA : BOOL;\nEND_VAR\nEND_FUNCTION_BLOCK\n';
        expect(registered.folding.provideFoldingRanges(doc(src)).map((r: any) => [r.start, r.end])).toEqual([[0, 3], [1, 2]]);
        const syms = registered.symbols.provideDocumentSymbols(doc(src));
        expect(syms[0].name).toBe('fbX');
        expect(syms[0].children[0].children[0].name).toBe('ibA');
    });

    it('offers a format quick fix for fixable diagnostics', () => {
        const actions = registered.codeActions.provideCodeActions(doc(''), null, { diagnostics: [{ source: 'st-guideline', code: 'keyword-case' }] });
        expect(actions[0].command.command).toBe('editor.action.formatDocument');
        expect(registered.codeActions.provideCodeActions(doc(''), null, { diagnostics: [{ source: 'st-guideline', code: 'no-jump' }] })).toEqual([]);
    });
});
