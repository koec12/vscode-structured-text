/**
 * Generates the TextMate grammars in ./syntaxes from the keyword lists in
 * src/language/keywords.ts, so highlighting and formatter casing never drift.
 *
 *   npm run gen:grammars
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as K from '../src/language/keywords';

type Pattern = Record<string, unknown>;

function alt(list: string[]): string {
    return [...new Set(list)].sort((a, b) => b.length - a.length).join('|');
}

function words(list: string[]): string {
    return `(?i)\\b(?:${alt(list)})\\b`;
}

interface Flavour {
    id: 'st' | 'scl';
    name: string;
    scopeName: string;
}

function build(f: Flavour): Pattern {
    const st = f.id === 'st';
    const s = (scope: string) => `${scope}.${f.id}`;

    const control = [...K.CONTROL_KEYWORDS, ...(st ? K.ST_CONTROL_KEYWORDS : K.SCL_CONTROL_KEYWORDS)];
    const pouKeywords = [...K.POU_KEYWORDS, ...(st ? K.ST_POU_KEYWORDS : K.SCL_POU_KEYWORDS)];
    const pouHeads = st
        ? ['PROGRAM', 'FUNCTION_BLOCK', 'FUNCTION', 'METHOD', 'PROPERTY', 'INTERFACE', 'ACTION', 'CONFIGURATION', 'RESOURCE', 'NAMESPACE']
        : ['PROGRAM', 'FUNCTION_BLOCK', 'FUNCTION', 'ORGANIZATION_BLOCK', 'DATA_BLOCK', 'CONFIGURATION', 'RESOURCE'];
    const accessModifiers = ['PUBLIC', 'PRIVATE', 'PROTECTED', 'INTERNAL', 'ABSTRACT', 'FINAL'];
    const types = [...K.DATA_TYPES, ...(st ? K.ST_DATA_TYPES : K.SCL_DATA_TYPES)];
    const builtins = [...K.BUILTIN_FUNCTIONS, ...(st ? K.ST_BUILTIN_FUNCTIONS : K.SCL_BUILTIN_FUNCTIONS)];
    const modifiers = [...K.DECLARATION_MODIFIERS, ...(st ? [] : K.SCL_DECLARATION_MODIFIERS)];
    const name = st ? '[A-Za-z_]\\w*' : '(?:"[^"]*"|[A-Za-z_]\\w*)';

    const repository: Record<string, Pattern> = {
        comments: {
            patterns: [
                {
                    name: s('comment.line.documentation'),
                    begin: '///',
                    end: '$',
                    patterns: [
                        {
                            name: s('meta.tag.documentation'),
                            match: '(</?)(summary|param|returns|para|remarks|example|c|code|see|value)\\b([^>]*)(>)',
                            captures: {
                                1: { name: s('punctuation.definition.tag') },
                                2: { name: s('entity.name.tag') },
                                3: { patterns: [{ match: '(name)\\s*=\\s*("[^"]*"|“[^”]*”)', captures: { 1: { name: s('entity.other.attribute-name') }, 2: { name: s('string.quoted.double') } } }] },
                                4: { name: s('punctuation.definition.tag') },
                            },
                        },
                    ],
                },
                { name: s('comment.line.double-slash'), match: '//.*$' },
                {
                    name: s('comment.block'),
                    begin: '\\(\\*',
                    end: '\\*\\)',
                    patterns: st ? [{ include: '#nestedComment' }] : [],
                },
                { name: s('comment.block'), begin: '/\\*', end: '\\*/' },
            ],
        },
        nestedComment: {
            begin: '\\(\\*',
            end: '\\*\\)',
            patterns: [{ include: '#nestedComment' }],
        },
        pragmas: {
            patterns: [
                {
                    name: s('meta.preprocessor'),
                    begin: '\\{',
                    end: '\\}',
                    beginCaptures: { 0: { name: s('punctuation.definition.preprocessor') } },
                    endCaptures: { 0: { name: s('punctuation.definition.preprocessor') } },
                    patterns: [
                        { name: s('keyword.control.directive'), match: '(?i)\\b(?:attribute|IF|ELSIF|ELSE|END_IF|define|undefine|region|endregion|info|warning|error|text|library|flag|message|S7_Optimized_Access|S7_m_c)\\b' },
                        { name: s('string.quoted.single'), match: "'[^']*'" },
                        { name: s('string.quoted.double'), match: '"[^"]*"' },
                    ],
                },
            ],
        },
        strings: {
            patterns: [
                {
                    name: s('string.quoted.single'),
                    begin: "'",
                    end: "'|$",
                    patterns: [{ name: s('constant.character.escape'), match: "\\$(?:[$'\"LNPRTlnprt]|[0-9A-Fa-f]{2})" }],
                },
                ...(st
                    ? [
                          {
                              name: s('string.quoted.double'),
                              begin: '"',
                              end: '"|$',
                              patterns: [{ name: s('constant.character.escape'), match: "\\$(?:[$'\"LNPRTlnprt]|[0-9A-Fa-f]{4})" }],
                          },
                      ]
                    : []),
            ],
        },
        sclHeader: {
            patterns: [
                {
                    match: '(?i)^\\s*(TITLE)\\s*(=)(.*)$',
                    captures: { 1: { name: s('keyword.other.attribute') }, 2: { name: s('keyword.operator') }, 3: { name: s('string.unquoted.title') } },
                },
                {
                    match: '(?i)^\\s*(VERSION|AUTHOR|FAMILY|NAME)\\s*(:)\\s*([^;]*?)\\s*$',
                    captures: { 1: { name: s('keyword.other.attribute') }, 2: { name: s('punctuation.separator') }, 3: { name: s('string.unquoted.attribute') } },
                },
                {
                    match: '(?i)^\\s*(REGION)\\b(.*)$',
                    captures: { 1: { name: s('keyword.other.region') }, 2: { name: s('entity.name.section.region') } },
                },
                { name: s('keyword.other.region'), match: '(?i)\\bEND_REGION\\b' },
            ],
        },
        locals: {
            patterns: [
                {
                    match: '(?<![\\w#])(#)("[^"]*"|[A-Za-z_]\\w*)',
                    captures: { 1: { name: s('punctuation.definition.variable') }, 2: { name: s('variable.other.local') } },
                },
                {
                    name: s('variable.other.global'),
                    match: '"[^"]*"',
                },
            ],
        },
        literals: {
            patterns: [
                { name: s('constant.numeric.time'), match: '(?i)\\b(?:T|TIME|LT|LTIME|S5T|S5TIME)#[-+]?[0-9a-z_.]+' },
                { name: s('constant.numeric.date'), match: '(?i)\\b(?:D|DATE|LD|LDATE|TOD|TIME_OF_DAY|LTOD|LTIME_OF_DAY|DT|DATE_AND_TIME|LDT|LDATE_AND_TIME|DTL)#[0-9_:.\\-]+' },
                {
                    match: "(?i)\\b([A-Z_]\\w*)(#)((?:\\d+#)?[-+]?[0-9A-Z_.]+|'[^']*')",
                    captures: { 1: { name: s('support.type.literal-prefix') }, 2: { name: s('punctuation.separator.literal') }, 3: { name: s('constant.numeric.typed') } },
                },
                { name: s('constant.numeric.based'), match: '\\b\\d+#[0-9A-Fa-f_]+\\b' },
                { name: s('constant.numeric.decimal'), match: '\\b\\d[\\d_]*(?:\\.\\d[\\d_]*)?(?:[eE][+-]?\\d+)?\\b' },
                { name: s('constant.language.boolean'), match: words(K.BOOLEAN_LITERALS) },
            ],
        },
        addresses: {
            patterns: [{ name: s('variable.language.address'), match: '%[A-Za-z]+[\\w.*]*[\\w*]' }],
        },
        declarations: {
            patterns: [
                {
                    match: `(?i)\\b(${alt(pouHeads)})\\b((?:\\s+(?:${alt(accessModifiers)})\\b)*)\\s+(${name})`,
                    captures: {
                        1: { name: s('storage.type.pou') },
                        2: { name: s('storage.modifier') },
                        3: { name: s('entity.name.function') },
                    },
                },
                {
                    match: `(?i)\\b(TYPE)\\s+(${name})`,
                    captures: { 1: { name: s('storage.type.pou') }, 2: { name: s('entity.name.type') } },
                },
                {
                    match: `(?i)\\b(EXTENDS|IMPLEMENTS)\\s+(${name}(?:\\s*,\\s*${name})*)`,
                    captures: { 1: { name: s('storage.modifier') }, 2: { name: s('entity.other.inherited-class') } },
                },
            ],
        },
        keywords: {
            patterns: [
                { name: s('keyword.control'), match: words(control) },
                { name: s('keyword.operator.word'), match: words(K.OPERATOR_KEYWORDS) },
                { name: s('storage.type.pou'), match: words(pouKeywords) },
                { name: s('storage.modifier.var'), match: '(?i)\\b(?:VAR_[A-Z_]+|VAR|END_VAR)\\b' },
                { name: s('storage.modifier'), match: words(modifiers) },
                ...(st ? [{ name: s('variable.language'), match: words(K.ST_INSTANCE_KEYWORDS) }] : []),
            ],
        },
        types: {
            patterns: [
                { name: s('support.type.primitive'), match: words(types) },
                { name: s('support.class.standard-fb'), match: words(K.STANDARD_FUNCTION_BLOCKS) },
            ],
        },
        functions: {
            patterns: [
                { name: s('support.function.conversion'), match: `(?i)\\b(?:(?:${alt(types)}|BCD)_TO_(?:BCD_)?(?:${alt(types)}|BCD)|TO_(?:${alt(types)}))\\b` },
                { name: s('support.function.builtin'), match: `(?i)\\b(?:${alt(builtins)})\\b(?=\\s*\\()` },
            ],
        },
        calls: {
            patterns: [{ name: s('entity.name.function.call'), match: '\\b[A-Za-z_]\\w*(?=\\s*\\()' }],
        },
        typeAnnotation: {
            patterns: [
                {
                    // `name : Type` - starts right after the colon, so it must also know the primitive types
                    match: `(?i)(?<=[^:]:)\\s*(?:\\b(${alt(types)})\\b|(?!(?:${alt([...modifiers, ...pouKeywords, ...K.VAR_KEYWORDS, ...control, ...K.OPERATOR_KEYWORDS])})\\b)([A-Za-z_]\\w*)\\b)(?!\\s*(?::=|\\(|\\.|#))`,
                    captures: { 1: { name: s('support.type.primitive') }, 2: { name: s('entity.name.type') } },
                },
            ],
        },
        operators: {
            patterns: [
                ...(st ? [{ name: s('keyword.operator.assignment'), match: '(?i)\\b(?:S|R|REF)=(?![=>])' }] : []),
                { name: s('keyword.operator.assignment'), match: ':=|=>|\\?=' },
                { name: s('keyword.operator.comparison'), match: '<>|<=|>=|=|<|>' },
                { name: s('keyword.operator.arithmetic'), match: '\\*\\*|[-+*/]' },
                { name: s('keyword.operator'), match: '[&^]' },
                { name: s('punctuation.separator.range'), match: '\\.\\.' },
                { name: s('punctuation.terminator.statement'), match: ';' },
                { name: s('punctuation.separator'), match: '[,:.]' },
                { name: s('punctuation.bracket'), match: '[()\\[\\]]' },
            ],
        },
    };

    const patterns = [
        { include: '#comments' },
        { include: '#pragmas' },
        ...(st ? [] : [{ include: '#sclHeader' }]),
        { include: '#strings' },
        ...(st ? [] : [{ include: '#locals' }]),
        { include: '#addresses' },
        { include: '#literals' },
        { include: '#declarations' },
        { include: '#functions' },
        { include: '#keywords' },
        { include: '#types' },
        { include: '#calls' },
        { include: '#typeAnnotation' },
        { include: '#operators' },
    ];

    return {
        $schema: 'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
        name: f.name,
        scopeName: f.scopeName,
        comment: 'GENERATED by scripts/build-grammars.ts - do not edit by hand.',
        patterns,
        repository,
    };
}

const root = join(__dirname, '..');
const flavours: Flavour[] = [
    { id: 'st', name: 'Structured Text (IEC 61131-3)', scopeName: 'source.iec-st' },
    { id: 'scl', name: 'Siemens SCL', scopeName: 'source.siemens-scl' },
];
for (const f of flavours) {
    const file = join(root, 'syntaxes', `${f.id}.tmLanguage.json`);
    writeFileSync(file, JSON.stringify(build(f), null, 2) + '\n');
    console.log(`wrote ${file}`);
}
