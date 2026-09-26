import * as vscode from 'vscode';
import type { FormatOptions } from './formatter/options';
import { DEFAULT_FORMAT_OPTIONS } from './formatter/options';
import { DEFAULT_LINT_OPTIONS, type LintOptions } from './lint';

export const LANGUAGES = ['iec-st', 'siemens-scl'];
export const SELECTOR: vscode.DocumentSelector = LANGUAGES.map((language) => ({ language }));

function section(document: vscode.TextDocument) {
    return vscode.workspace.getConfiguration('structuredText', document);
}

export function formatEnabled(document: vscode.TextDocument): boolean {
    return section(document).get<boolean>('format.enable', true);
}

export function lintEnabled(document: vscode.TextDocument): boolean {
    return section(document).get<boolean>('lint.enable', true);
}

/** Accepts the setting values of version 0.1.0 ('guideline', 'guideline-always'). */
function normaliseCallStyle(value: string): FormatOptions['callStyle'] {
    if (value === 'guideline') {
        return 'multiline';
    }
    if (value === 'guideline-always') {
        return 'always';
    }
    return value === 'always' || value === 'preserve' ? value : 'multiline';
}

export function formatOptions(document: vscode.TextDocument, editor: vscode.FormattingOptions): FormatOptions {
    const c = section(document);
    const d = DEFAULT_FORMAT_OPTIONS;
    const get = <K extends keyof FormatOptions>(key: K): FormatOptions[K] => c.get<FormatOptions[K]>(`format.${key}`, d[key]);
    return {
        indentUnit: editor.insertSpaces ? ' '.repeat(editor.tabSize) : '\t',
        tabSize: editor.tabSize,
        keywordCase: get('keywordCase'),
        declarationKeywordCase: get('declarationKeywordCase'),
        dataTypeCase: get('dataTypeCase'),
        builtinFunctionCase: get('builtinFunctionCase'),
        booleanLiteralCase: get('booleanLiteralCase'),
        indentPouBody: get('indentPouBody'),
        splitStatements: get('splitStatements'),
        alignAssignments: get('alignAssignments'),
        assignmentAlignColumn: get('assignmentAlignColumn'),
        assignmentMaxColumn: get('assignmentMaxColumn'),
        alignDeclarations: get('alignDeclarations'),
        declarationMaxColumn: get('declarationMaxColumn'),
        alignTrailingComments: get('alignTrailingComments'),
        blankLineBetweenVarSections: get('blankLineBetweenVarSections'),
        reorderVarSections: get('reorderVarSections'),
        maxBlankLines: get('maxBlankLines'),
        callStyle: normaliseCallStyle(get('callStyle')),
        callExpandMinArgs: get('callExpandMinArgs'),
    };
}

export function lintOptions(document: vscode.TextDocument): LintOptions {
    const c = section(document);
    const d = DEFAULT_FORMAT_OPTIONS;
    return {
        keywordCase: c.get('format.keywordCase', d.keywordCase),
        declarationKeywordCase: c.get('format.declarationKeywordCase', d.declarationKeywordCase),
        dataTypeCase: c.get('format.dataTypeCase', d.dataTypeCase),
        builtinFunctionCase: c.get('format.builtinFunctionCase', d.builtinFunctionCase),
        booleanLiteralCase: c.get('format.booleanLiteralCase', d.booleanLiteralCase),
        rules: c.get('lint.rules', {}),
        allowCfcStyleIo: c.get('lint.allowCfcStyleIo', DEFAULT_LINT_OPTIONS.allowCfcStyleIo),
        checkStructMembers: c.get('lint.checkStructMembers', DEFAULT_LINT_OPTIONS.checkStructMembers),
    };
}
