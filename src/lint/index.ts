/**
 * Programming-guideline lint. Pure - no VS Code dependencies.
 */
import { analyze } from '../language/analysis';
import type { Dialect } from '../language/dialect';
import { tokenize } from '../language/lexer';
import { parseStructure } from '../language/structure';
import type { CaseOptions } from '../formatter/casing';
import { DEFAULT_FORMAT_OPTIONS } from '../formatter/options';
import { RULES, type LintContext } from './rules';

export type Severity = 'off' | 'hint' | 'information' | 'warning' | 'error';

export type RuleId =
    | 'keyword-case'
    | 'one-statement-per-line'
    | 'var-section-order'
    | 'no-direct-address'
    | 'no-jump'
    | 'case-numeric-label'
    | 'explicit-parentheses'
    | 'for-counter-modified'
    | 'prefer-for-loop'
    | 'variable-prefix'
    | 'pou-prefix'
    | 'no-underscore-in-names'
    | 'missing-header';

export const DEFAULT_RULE_SEVERITY: Record<RuleId, Severity> = {
    'keyword-case': 'warning',
    'one-statement-per-line': 'warning',
    'var-section-order': 'warning',
    'no-direct-address': 'warning',
    'no-jump': 'warning',
    'case-numeric-label': 'warning',
    'explicit-parentheses': 'information',
    'for-counter-modified': 'warning',
    'prefer-for-loop': 'hint',
    'variable-prefix': 'warning',
    'pou-prefix': 'warning',
    'no-underscore-in-names': 'hint',
    'missing-header': 'off',
};

/** Rules whose findings "Format Document" fixes. */
export const FORMATTER_FIXABLE: ReadonlySet<RuleId> = new Set(['keyword-case', 'one-statement-per-line']);

export interface LintOptions extends CaseOptions {
    rules: Partial<Record<RuleId, Severity>>;
    allowCfcStyleIo: boolean;
    checkStructMembers: boolean;
}

export const DEFAULT_LINT_OPTIONS: LintOptions = {
    keywordCase: DEFAULT_FORMAT_OPTIONS.keywordCase,
    declarationKeywordCase: DEFAULT_FORMAT_OPTIONS.declarationKeywordCase,
    dataTypeCase: DEFAULT_FORMAT_OPTIONS.dataTypeCase,
    builtinFunctionCase: DEFAULT_FORMAT_OPTIONS.builtinFunctionCase,
    booleanLiteralCase: DEFAULT_FORMAT_OPTIONS.booleanLiteralCase,
    rules: {},
    allowCfcStyleIo: true,
    checkStructMembers: false,
};

export interface LintDiagnostic {
    rule: RuleId;
    severity: Exclude<Severity, 'off'>;
    message: string;
    line: number;
    col: number;
    endLine: number;
    endCol: number;
}

export function lint(src: string, dialect: Dialect, options: Partial<LintOptions> = {}): LintDiagnostic[] {
    const o: LintOptions = { ...DEFAULT_LINT_OPTIONS, ...options, rules: { ...options.rules } };
    const tokens = tokenize(src, dialect);
    const ctx: LintContext = {
        src,
        lines: src.split(/\r\n|\n|\r/),
        dialect,
        tokens,
        analysis: analyze(tokens, dialect),
        root: parseStructure(tokens, dialect),
        options: o,
    };
    const out: LintDiagnostic[] = [];
    for (const [id, rule] of Object.entries(RULES) as [RuleId, (typeof RULES)[RuleId]][]) {
        const severity = o.rules[id] ?? DEFAULT_RULE_SEVERITY[id];
        if (severity === 'off') {
            continue;
        }
        for (const f of rule(ctx)) {
            out.push({ rule: id, severity, ...f });
        }
    }
    return out.sort((a, b) => a.line - b.line || a.col - b.col);
}
