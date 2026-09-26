/**
 * Single source of truth for all keyword sets. Used by the grammar generator
 * (scripts/build-grammars.ts), the formatter's casing pass and the linter.
 * All entries are UPPER case.
 */
import type { DialectId } from './dialect';

/** Control statements (code section). */
export const CONTROL_KEYWORDS = [
    'IF', 'THEN', 'ELSIF', 'ELSE', 'END_IF',
    'CASE', 'OF', 'END_CASE',
    'FOR', 'TO', 'BY', 'DO', 'END_FOR',
    'WHILE', 'END_WHILE',
    'REPEAT', 'UNTIL', 'END_REPEAT',
    'EXIT', 'CONTINUE', 'RETURN', 'JMP',
];
export const SCL_CONTROL_KEYWORDS = ['GOTO'];
export const ST_CONTROL_KEYWORDS = ['__TRY', '__CATCH', '__FINALLY', '__ENDTRY'];

/** Operator words. */
export const OPERATOR_KEYWORDS = ['AND', 'OR', 'XOR', 'NOT', 'MOD', 'AND_THEN', 'OR_ELSE'];
/** Boolean / bitwise operator words (highlighted separately from MOD). */
export const LOGICAL_OPERATOR_KEYWORDS = ['AND', 'OR', 'XOR', 'NOT', 'AND_THEN', 'OR_ELSE'];

/** Program organisation units and other blocks, with their END_ forms. */
export const POU_KEYWORDS = [
    'PROGRAM', 'END_PROGRAM',
    'FUNCTION', 'END_FUNCTION',
    'FUNCTION_BLOCK', 'END_FUNCTION_BLOCK',
    'CONFIGURATION', 'END_CONFIGURATION',
    'RESOURCE', 'END_RESOURCE',
    'TYPE', 'END_TYPE',
    'STRUCT', 'END_STRUCT',
    'BEGIN',
];
export const ST_POU_KEYWORDS = [
    'METHOD', 'END_METHOD',
    'PROPERTY', 'END_PROPERTY',
    'INTERFACE', 'END_INTERFACE',
    'ACTION', 'END_ACTION',
    'UNION', 'END_UNION',
    'NAMESPACE', 'END_NAMESPACE',
];
export const SCL_POU_KEYWORDS = [
    'ORGANIZATION_BLOCK', 'END_ORGANIZATION_BLOCK',
    'DATA_BLOCK', 'END_DATA_BLOCK',
    'REGION', 'END_REGION',
];

/** Variable section keywords. */
export const VAR_KEYWORDS = [
    'VAR', 'VAR_INPUT', 'VAR_OUTPUT', 'VAR_IN_OUT', 'VAR_TEMP',
    'VAR_GLOBAL', 'VAR_EXTERNAL', 'VAR_ACCESS', 'VAR_CONFIG',
    'VAR_STAT', 'VAR_INST',
    'END_VAR',
];

/** Declaration modifiers and type constructors. */
export const DECLARATION_MODIFIERS = [
    'CONSTANT', 'RETAIN', 'NON_RETAIN', 'PERSISTENT', 'AT',
    'ARRAY', 'POINTER', 'REFERENCE',
    'EXTENDS', 'IMPLEMENTS',
    'ABSTRACT', 'FINAL', 'PUBLIC', 'PRIVATE', 'PROTECTED', 'INTERNAL',
    'TASK', 'WITH', 'ON',
];
export const SCL_DECLARATION_MODIFIERS = ['DB_SPECIFIC', 'KNOW_HOW_PROTECT'];

/** SCL block header attribute keys (`VERSION : 0.1`). */
export const SCL_HEADER_ATTRIBUTES = ['TITLE', 'VERSION', 'AUTHOR', 'FAMILY', 'NAME', 'KNOW_HOW_PROTECT', 'NON_RETAIN'];

/** Elementary data types. */
export const DATA_TYPES = [
    'BOOL', 'BIT', 'BYTE', 'WORD', 'DWORD', 'LWORD',
    'SINT', 'USINT', 'INT', 'UINT', 'DINT', 'UDINT', 'LINT', 'ULINT',
    'REAL', 'LREAL',
    'TIME', 'LTIME', 'DATE', 'LDATE',
    'TIME_OF_DAY', 'TOD', 'LTIME_OF_DAY', 'LTOD',
    'DATE_AND_TIME', 'DT', 'LDATE_AND_TIME', 'LDT',
    'STRING', 'WSTRING', 'CHAR', 'WCHAR',
    'ANY', 'ANY_NUM', 'ANY_INT', 'ANY_REAL', 'ANY_BIT', 'ANY_STRING', 'ANY_DATE', 'ANY_ELEMENTARY', 'ANY_DERIVED',
];
export const ST_DATA_TYPES = ['__UXINT', '__XINT', '__XWORD', 'XINT', 'UXINT', 'XWORD'];
export const SCL_DATA_TYPES = [
    'S5TIME', 'DTL', 'VARIANT', 'VOID', 'DB_ANY', 'DB_WWW', 'DB_DYN',
    'TIMER', 'COUNTER', 'BLOCK_FC', 'BLOCK_FB', 'BLOCK_DB', 'BLOCK_SDB',
    'IEC_TIMER', 'IEC_LTIMER', 'IEC_COUNTER', 'HW_ANY', 'HW_IO', 'HW_DEVICE', 'CONN_ANY', 'EVENT_ANY',
];

/** Built-in functions (recased only when used as a call). */
export const BUILTIN_FUNCTIONS = [
    'ABS', 'SQRT', 'LN', 'LOG', 'EXP', 'EXPT', 'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN', 'ATAN2',
    'ADD', 'SUB', 'MUL', 'DIV', 'MOVE',
    'MIN', 'MAX', 'LIMIT', 'SEL', 'MUX',
    'SHL', 'SHR', 'ROL', 'ROR',
    'LEN', 'LEFT', 'RIGHT', 'MID', 'CONCAT', 'INSERT', 'DELETE', 'REPLACE', 'FIND',
    'TRUNC', 'ROUND', 'CEIL', 'FLOOR', 'FRAC',
    'SIZEOF', 'ADR', 'ADRINST', 'BITADR', 'INDEXOF', 'LOWER_BOUND', 'UPPER_BOUND',
];
export const ST_BUILTIN_FUNCTIONS = [
    '__NEW', '__DELETE', '__ISVALIDREF', '__QUERYINTERFACE', '__QUERYPOINTER', '__VARINFO', 'TEST_AND_SET', '__COMPARE_AND_SWAP', '__XADD',
];
export const SCL_BUILTIN_FUNCTIONS = [
    'SCALE_X', 'NORM_X', 'PEEK', 'PEEK_BOOL', 'PEEK_WORD', 'PEEK_DWORD', 'POKE', 'POKE_BOOL', 'POKE_BLK',
    'MOVE_BLK', 'MOVE_BLK_VARIANT', 'UMOVE_BLK', 'FILL_BLK', 'UFILL_BLK', 'SWAP',
    'T_ADD', 'T_SUB', 'T_DIFF', 'T_COMBINE', 'T_CONV',
    'RD_SYS_T', 'WR_SYS_T', 'RD_LOC_T', 'WR_LOC_T',
    'GET_ERR_ID', 'GET_ERROR', 'GETSYMBOLNAME', 'GETINSTANCENAME',
    'SERIALIZE', 'DESERIALIZE', 'STRG_VAL', 'VAL_STRG', 'S_CONV', 'CHARS_TO_STRG', 'STRG_TO_CHARS',
    'TYPEOF', 'TYPEOFELEMENTS', 'IS_ARRAY', 'COUNTOFELEMENTS', 'VARIANTGET', 'VARIANTPUT',
    'CTRL_PWM', 'RUNTIME', 'SET_TIMEZONE',
];

/** Standard function blocks (highlighted only; they are type names). */
export const STANDARD_FUNCTION_BLOCKS = [
    'TON', 'TOF', 'TP', 'TONR', 'LTON', 'LTOF', 'LTP', 'R_TRIG', 'F_TRIG',
    'CTU', 'CTD', 'CTUD', 'SR', 'RS', 'SEMA',
];

export const BOOLEAN_LITERALS = ['TRUE', 'FALSE'];

/** Keywords that refer to the current instance (ST OOP). */
export const ST_INSTANCE_KEYWORDS = ['THIS', 'SUPER'];

// ---------------------------------------------------------------------------
// Grouping by casing setting

export type CaseGroup = 'keyword' | 'declaration' | 'type' | 'builtin' | 'boolean';

function set(...lists: string[][]): Set<string> {
    return new Set(lists.flat());
}

export interface KeywordSets {
    control: Set<string>;
    operators: Set<string>;
    pou: Set<string>;
    vars: Set<string>;
    modifiers: Set<string>;
    types: Set<string>;
    builtins: Set<string>;
    booleans: Set<string>;
    instance: Set<string>;
}

const cache = new Map<DialectId, KeywordSets>();

export function keywordSets(dialect: DialectId): KeywordSets {
    let sets = cache.get(dialect);
    if (!sets) {
        const st = dialect === 'st';
        sets = {
            control: set(CONTROL_KEYWORDS, st ? ST_CONTROL_KEYWORDS : SCL_CONTROL_KEYWORDS),
            operators: set(OPERATOR_KEYWORDS),
            pou: set(POU_KEYWORDS, st ? ST_POU_KEYWORDS : SCL_POU_KEYWORDS),
            vars: set(VAR_KEYWORDS),
            modifiers: set(DECLARATION_MODIFIERS, st ? [] : SCL_DECLARATION_MODIFIERS),
            types: set(DATA_TYPES, st ? ST_DATA_TYPES : SCL_DATA_TYPES),
            builtins: set(BUILTIN_FUNCTIONS, st ? ST_BUILTIN_FUNCTIONS : SCL_BUILTIN_FUNCTIONS),
            booleans: set(BOOLEAN_LITERALS),
            instance: set(st ? ST_INSTANCE_KEYWORDS : []),
        };
        cache.set(dialect, sets);
    }
    return sets;
}

/** `X_TO_Y` or `TO_Y` conversion function name. */
export const CONVERSION_FUNCTION = /^(?:([A-Z][A-Z0-9_]*?)_TO_([A-Z][A-Z0-9_]*)|TO_([A-Z][A-Z0-9_]*))$/;

function isConversionOperand(upper: string, types: Set<string>): boolean {
    return types.has(upper) || upper === 'BCD' || (upper.startsWith('BCD_') && types.has(upper.slice(4)));
}

/** True for type conversion functions such as `LTIME_TO_LINT` or `TO_INT` whose operands are known types. */
export function isConversionFunction(upper: string, dialect: DialectId): boolean {
    const m = CONVERSION_FUNCTION.exec(upper);
    if (!m) {
        return false;
    }
    const types = keywordSets(dialect).types;
    if (m[3] !== undefined) {
        return isConversionOperand(m[3], types);
    }
    return isConversionOperand(m[1], types) && isConversionOperand(m[2], types);
}

// ---------------------------------------------------------------------------
// Casing

export type CaseStyle = 'upper' | 'lower' | 'pascal' | 'preserve';

/** Irregular Pascal spellings. Everything else capitalises each `_`-separated part. */
const PASCAL_OVERRIDES: Record<string, string> = {
    // data types
    DWORD: 'DWord', LWORD: 'LWord',
    SINT: 'SInt', USINT: 'USInt', UINT: 'UInt', DINT: 'DInt', UDINT: 'UDInt', LINT: 'LInt', ULINT: 'ULInt',
    LREAL: 'LReal', LTIME: 'LTime', LDATE: 'LDate',
    WSTRING: 'WString', WCHAR: 'WChar',
    TOD: 'TOD', LTOD: 'LTOD', DT: 'DT', LDT: 'LDT', DTL: 'DTL',
    S5TIME: 'S5Time', XINT: 'XInt', UXINT: 'UXInt', XWORD: 'XWord',
    __UXINT: '__UXInt', __XINT: '__XInt', __XWORD: '__XWord',
    LTIME_OF_DAY: 'LTime_Of_Day', LDATE_AND_TIME: 'LDate_And_Time',
    DB_ANY: 'DB_Any', IEC_TIMER: 'IEC_Timer', IEC_LTIMER: 'IEC_LTimer', IEC_COUNTER: 'IEC_Counter',
    HW_ANY: 'HW_Any', HW_IO: 'HW_IO', HW_DEVICE: 'HW_Device',
    // built-ins
    SIZEOF: 'SizeOf', INDEXOF: 'IndexOf', BITADR: 'BitAdr', ADRINST: 'AdrInst', EXPT: 'Expt',
    __NEW: '__New', __DELETE: '__Delete', __ISVALIDREF: '__IsValidRef', __QUERYINTERFACE: '__QueryInterface',
    __QUERYPOINTER: '__QueryPointer', __VARINFO: '__VarInfo',
    GETSYMBOLNAME: 'GetSymbolName', GETINSTANCENAME: 'GetInstanceName',
    TYPEOF: 'TypeOf', TYPEOFELEMENTS: 'TypeOfElements', COUNTOFELEMENTS: 'CountOfElements',
    VARIANTGET: 'VariantGet', VARIANTPUT: 'VariantPut',
    // keywords
    __TRY: '__Try', __CATCH: '__Catch', __FINALLY: '__Finally', __ENDTRY: '__EndTry',
};

function capitalise(part: string): string {
    return part.length === 0 ? part : part[0].toUpperCase() + part.slice(1).toLowerCase();
}

export function pascalCase(upper: string): string {
    const override = PASCAL_OVERRIDES[upper];
    if (override) {
        return override;
    }
    const conv = CONVERSION_FUNCTION.exec(upper);
    if (conv) {
        if (conv[3] !== undefined) {
            return 'To_' + pascalCase(conv[3]);
        }
        return pascalCase(conv[1]) + '_To_' + pascalCase(conv[2]);
    }
    return upper.split('_').map(capitalise).join('_');
}

export function applyCase(text: string, style: CaseStyle): string {
    switch (style) {
        case 'upper':
            return text.toUpperCase();
        case 'lower':
            return text.toLowerCase();
        case 'pascal':
            return pascalCase(text.toUpperCase());
        default:
            return text;
    }
}
