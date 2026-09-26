import type { CaseStyle } from '../language/keywords';

export type CallStyle = 'multiline' | 'always' | 'preserve';

export interface FormatOptions {
    /** One indentation level, e.g. four spaces or a tab. */
    indentUnit: string;
    /** Visual width of a tab, used for column limits. */
    tabSize: number;
    keywordCase: CaseStyle;
    declarationKeywordCase: CaseStyle;
    dataTypeCase: CaseStyle;
    builtinFunctionCase: CaseStyle;
    booleanLiteralCase: CaseStyle;
    indentPouBody: boolean;
    splitStatements: boolean;
    alignAssignments: boolean;
    assignmentAlignColumn: number;
    assignmentMaxColumn: number;
    alignDeclarations: boolean;
    declarationMaxColumn: number;
    alignTrailingComments: boolean;
    blankLineBetweenVarSections: boolean;
    reorderVarSections: boolean;
    maxBlankLines: number;
    callStyle: CallStyle;
    callExpandMinArgs: number;
}

export const DEFAULT_FORMAT_OPTIONS: FormatOptions = {
    indentUnit: '    ',
    tabSize: 4,
    keywordCase: 'pascal',
    declarationKeywordCase: 'upper',
    dataTypeCase: 'pascal',
    builtinFunctionCase: 'pascal',
    booleanLiteralCase: 'pascal',
    indentPouBody: false,
    splitStatements: true,
    alignAssignments: true,
    assignmentAlignColumn: 41,
    assignmentMaxColumn: 60,
    alignDeclarations: true,
    declarationMaxColumn: 48,
    alignTrailingComments: true,
    blankLineBetweenVarSections: true,
    reorderVarSections: false,
    maxBlankLines: 1,
    callStyle: 'multiline',
    callExpandMinArgs: 3,
};
