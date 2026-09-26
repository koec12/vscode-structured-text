import * as vscode from 'vscode';
import { formatEnabled, formatOptions, lintEnabled, lintOptions, SELECTOR, LANGUAGES } from './config';
import { format } from './formatter';
import { computeChanges } from './formatter/edits';
import { dialectForLanguage } from './language/dialect';
import { tokenize } from './language/lexer';
import { documentSymbols, foldingRanges, type SymbolKindName, type SymbolNode } from './language/outline';
import { parseStructure } from './language/structure';
import { FORMATTER_FIXABLE, lint, type LintDiagnostic, type RuleId } from './lint';

const DIAGNOSTIC_SOURCE = 'structured-text';

let output: vscode.OutputChannel | undefined;

function log(message: string): void {
    output ??= vscode.window.createOutputChannel('Structured Text');
    output.appendLine(`[${new Date().toISOString()}] ${message}`);
}

function formatEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, range?: vscode.Range): vscode.TextEdit[] {
    if (!formatEnabled(document)) {
        return [];
    }
    const src = document.getText();
    const result = format(src, dialectForLanguage(document.languageId), formatOptions(document, options));
    if (!result.ok) {
        log(`Formatting ${document.uri.fsPath} aborted: ${result.error}`);
        void vscode.window.showWarningMessage('Structured Text formatter aborted: the output would have changed the code. See the "Structured Text" output channel for details.');
        return [];
    }
    const edits: vscode.TextEdit[] = [];
    for (const c of computeChanges(src, result.text)) {
        const r = new vscode.Range(document.positionAt(c.start), document.positionAt(c.end));
        if (range && !range.intersection(r) && !(c.start === c.end && range.contains(r.start))) {
            continue;
        }
        edits.push(new vscode.TextEdit(r, c.text));
    }
    return edits;
}

const SYMBOL_KINDS: Record<SymbolKindName, vscode.SymbolKind> = {
    class: vscode.SymbolKind.Class,
    function: vscode.SymbolKind.Function,
    module: vscode.SymbolKind.Module,
    method: vscode.SymbolKind.Method,
    property: vscode.SymbolKind.Property,
    interface: vscode.SymbolKind.Interface,
    event: vscode.SymbolKind.Event,
    namespace: vscode.SymbolKind.Namespace,
    struct: vscode.SymbolKind.Struct,
    enum: vscode.SymbolKind.Enum,
    typeParameter: vscode.SymbolKind.TypeParameter,
    variable: vscode.SymbolKind.Variable,
    constant: vscode.SymbolKind.Constant,
    field: vscode.SymbolKind.Field,
    object: vscode.SymbolKind.Object,
    package: vscode.SymbolKind.Package,
};

function toDocumentSymbol(n: SymbolNode): vscode.DocumentSymbol {
    const range = new vscode.Range(n.range.startLine, n.range.startCol, n.range.endLine, n.range.endCol);
    let selection = new vscode.Range(n.selection.startLine, n.selection.startCol, n.selection.endLine, n.selection.endCol);
    if (!range.contains(selection)) {
        selection = new vscode.Range(range.start, range.start);
    }
    const s = new vscode.DocumentSymbol(n.name || '?', n.detail, SYMBOL_KINDS[n.kind], range, selection);
    s.children = n.children.map(toDocumentSymbol).filter((c) => range.contains(c.range));
    return s;
}

const SEVERITIES: Record<LintDiagnostic['severity'], vscode.DiagnosticSeverity> = {
    hint: vscode.DiagnosticSeverity.Hint,
    information: vscode.DiagnosticSeverity.Information,
    warning: vscode.DiagnosticSeverity.Warning,
    error: vscode.DiagnosticSeverity.Error,
};

export function activate(context: vscode.ExtensionContext): void {
    const diagnostics = vscode.languages.createDiagnosticCollection('structured-text');
    context.subscriptions.push(diagnostics);

    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(SELECTOR, {
            provideDocumentFormattingEdits: (document, options) => formatEdits(document, options),
        }),
        vscode.languages.registerDocumentRangeFormattingEditProvider(SELECTOR, {
            provideDocumentRangeFormattingEdits: (document, range, options) => formatEdits(document, options, range),
        }),
        vscode.languages.registerFoldingRangeProvider(SELECTOR, {
            provideFoldingRanges(document) {
                const dialect = dialectForLanguage(document.languageId);
                const tokens = tokenize(document.getText(), dialect);
                return foldingRanges(tokens, parseStructure(tokens, dialect)).map(
                    (r) =>
                        new vscode.FoldingRange(
                            r.start,
                            r.end,
                            r.kind === 'comment' ? vscode.FoldingRangeKind.Comment : r.kind === 'region' ? vscode.FoldingRangeKind.Region : undefined,
                        ),
                );
            },
        }),
        vscode.languages.registerDocumentSymbolProvider(SELECTOR, {
            provideDocumentSymbols(document) {
                const dialect = dialectForLanguage(document.languageId);
                return documentSymbols(parseStructure(tokenize(document.getText(), dialect), dialect)).map(toDocumentSymbol);
            },
        }),
        vscode.languages.registerCodeActionsProvider(
            SELECTOR,
            {
                provideCodeActions(_document, _range, ctx) {
                    const fixable = ctx.diagnostics.filter((d) => d.source === DIAGNOSTIC_SOURCE && FORMATTER_FIXABLE.has(String(d.code) as RuleId));
                    if (fixable.length === 0) {
                        return [];
                    }
                    const action = new vscode.CodeAction('Format document to fix', vscode.CodeActionKind.QuickFix);
                    action.command = { command: 'editor.action.formatDocument', title: 'Format Document' };
                    action.diagnostics = fixable;
                    return [action];
                },
            },
            { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
        ),
    );

    // diagnostics
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const refresh = (document: vscode.TextDocument) => {
        if (!LANGUAGES.includes(document.languageId)) {
            return;
        }
        if (!lintEnabled(document)) {
            diagnostics.delete(document.uri);
            return;
        }
        const found = lint(document.getText(), dialectForLanguage(document.languageId), lintOptions(document));
        diagnostics.set(
            document.uri,
            found.map((f) => {
                const d = new vscode.Diagnostic(new vscode.Range(f.line, f.col, f.endLine, f.endCol), f.message, SEVERITIES[f.severity]);
                d.source = DIAGNOSTIC_SOURCE;
                d.code = f.rule;
                return d;
            }),
        );
    };
    const schedule = (document: vscode.TextDocument) => {
        const key = document.uri.toString();
        clearTimeout(timers.get(key));
        timers.set(
            key,
            setTimeout(() => {
                timers.delete(key);
                refresh(document);
            }, 300),
        );
    };
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(refresh),
        vscode.workspace.onDidChangeTextDocument((e) => schedule(e.document)),
        vscode.workspace.onDidCloseTextDocument((d) => diagnostics.delete(d.uri)),
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('structuredText')) {
                vscode.workspace.textDocuments.forEach(refresh);
            }
        }),
        { dispose: () => timers.forEach((t) => clearTimeout(t)) },
    );
    vscode.workspace.textDocuments.forEach(refresh);
}

export function deactivate(): void {
    output?.dispose();
}
