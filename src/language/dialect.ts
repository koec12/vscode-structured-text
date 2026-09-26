/**
 * Dialect feature flags. The same lexer / formatter / linter serves both
 * IEC 61131-3 Structured Text (CODESYS / TwinCAT flavour) and Siemens SCL.
 */
export type DialectId = 'st' | 'scl';

export interface Dialect {
    id: DialectId;
    /** `"..."` is a quoted identifier (SCL) instead of a WSTRING literal (ST). */
    doubleQuoteIsIdentifier: boolean;
    /** `#name` / `#"name"` denote block-local variables (SCL). */
    hashLocals: boolean;
    /** `(* (* *) *)` nests (CODESYS). */
    nestedComments: boolean;
    /** `REGION <free text>` / `END_REGION` and `TITLE = <free text>` lines (SCL). */
    regions: boolean;
    /** `S=`, `R=` and `REF=` assignment operators (CODESYS). */
    setResetOperators: boolean;
    /** Block header attribute lines (`VERSION : 0.1`, `AUTHOR : x`) before the declarations (SCL). */
    headerAttributes: boolean;
}

export const ST: Dialect = {
    id: 'st',
    doubleQuoteIsIdentifier: false,
    hashLocals: false,
    nestedComments: true,
    regions: false,
    setResetOperators: true,
    headerAttributes: false,
};

export const SCL: Dialect = {
    id: 'scl',
    doubleQuoteIsIdentifier: true,
    hashLocals: true,
    nestedComments: false,
    regions: true,
    setResetOperators: false,
    headerAttributes: true,
};

export function dialectForLanguage(languageId: string): Dialect {
    return languageId === 'siemens-scl' ? SCL : ST;
}
