# Structured Text & SCL for Visual Studio Code

Language support for PLC programming in **IEC 61131-3 Structured Text** (CODESYS / TwinCAT flavour, `.st`) and **Siemens SCL** (TIA Portal, `.scl`):

- **Syntax highlighting** for both dialects
- **Formatter** that follows the *Structured Text Programming in CodeSys 3.5 (and TwinCat XAE)* guideline (rev. A1)
- **Lint**: guideline violations reported as diagnostics
- **Outline, breadcrumbs and folding**
- **Snippets** based on the guideline's templates

## Syntax highlighting

| | ST (`iec-st`) | SCL (`siemens-scl`) |
|---|---|---|
| Comments | `//`, `(* *)` (nested), `/* */`, `///` doc comments with XML tags | `//`, `(* *)`, `/* */` |
| Pragmas | `{attribute 'hide'}`, `{IF defined(...)}` | `{ S7_Optimized_Access := 'TRUE' }` |
| Strings | `'STRING'`, `"WSTRING"` with `$` escapes | `'STRING'` |
| Identifiers | | `#local`, `#"quoted local"`, `"GlobalDB".member` |
| Literals | `16#FF_FF`, `2#1011`, `INT#5`, `T#2d4h`, `LTIME#…`, `D#…`, `TOD#…`, `DT#…` | plus `S5T#…`, `B#16#…`, `DW#16#…`, `P#…` |
| Addresses | `%IX0.0`, `%QW4`, `%MD10`, `%I*` | `%I0.0`, `%DB1.DBX0.1` |
| Blocks | PROGRAM, FUNCTION_BLOCK, FUNCTION, METHOD, PROPERTY, INTERFACE, ACTION, TYPE/STRUCT/UNION | ORGANIZATION_BLOCK, DATA_BLOCK, BEGIN, REGION, `TITLE =`, `VERSION :` |
| OOP | EXTENDS, IMPLEMENTS, THIS^, SUPER^, `__NEW`, REFERENCE TO, POINTER TO, `S=`/`R=`/`REF=` | |

Both grammars are generated from one keyword table (`src/language/keywords.ts`). The formatter and linter use the same table.

## Formatter

Run **Format Document** (`Shift+Alt+F`), **Format Selection**, or enable `editor.formatOnSave`. Every setting can be overridden per language, for example to keep TIA's upper-case keywords in SCL:

```jsonc
"[siemens-scl]": {
    "structuredText.format.keywordCase": "upper"
}
```

| Rule | Guideline |
|---|---|
| Block indentation for IF / CASE / FOR / WHILE / REPEAT / VAR / STRUCT / TYPE / REGION. VAR sections and code stay at column 0 inside a POU (`indentPouBody` changes this) | 4.1.1.2.5 |
| CASE labels are indented one level and their statements two levels. The code after a label moves to its own line; a trailing comment stays on the label line | 4.1.1.2.4, 4.1.1.2.12 |
| One statement per line. `IF a THEN b := 1; END_IF` becomes three lines | 4.1.1.2.1 |
| Code keywords `If / ElsIf / End_If`, `And / Not` (or lower case). Declaration keywords `VAR_INPUT / END_VAR` UPPER. Data types `Bool / LReal / LTime`. Built-ins `Abs / Sqrt / LTime_To_LInt` | 4.1.1.2, 4.1.1.2.2 |
| `:=` vertically aligned in runs of consecutive assignments (or at a fixed column) | 4.1.1.2.1 |
| Declarations laid out in three columns: name, `: Type := init;`, `//comment` | 4.1.1.2.2 |
| Exactly one blank line between VAR sections. Optional reordering into VAR CONSTANT, VAR_INPUT, VAR_OUTPUT, VAR_IN_OUT, VAR, VAR_TEMP | 4.1.1.2.2 |
| Multi-line calls with named arguments are laid out like the guideline's examples (below) | 4.1.1.2.6, 4.1.1.2.7 |
| Consistent spacing around operators, commas and brackets. Blank lines are limited, trailing whitespace is removed, and the file's line endings are kept | |
| Block comments (e.g. the header with its version table) are never re-wrapped | 4.1.1.1 |

```
sFilter( //Filter Analogue Input          sFilter
ilrInput := trY, ibReset := tbRestart,        ( //Filter Analogue Input
ilrSubstituteValue := 0.0);          ─►       ilrInput           := trY,
                                              ibReset            := tbRestart,
                                              ilrSubstituteValue := 0.0
                                              );
```

**Safety net:** after formatting, the result is tokenized again and compared with the input. If anything other than whitespace or the casing of keywords changed, the document is left untouched and a warning is shown. The formatter only ever *splits* lines; it never joins them. User identifiers are never recased.

### Formatter settings (`structuredText.format.*`)

| Setting | Default | Description |
|---|---|---|
| `enable` | `true` | Enable the formatter |
| `keywordCase` | `pascal` | `pascal` \| `lower` \| `upper` \| `preserve`: control statements and operator words |
| `declarationKeywordCase` | `upper` | FUNCTION_BLOCK, VAR_INPUT, END_VAR, STRUCT, ARRAY … OF, BEGIN |
| `dataTypeCase` | `pascal` | Elementary data types |
| `builtinFunctionCase` | `pascal` | Built-in and conversion functions (only when called) |
| `booleanLiteralCase` | `lower` | `true` / `false` |
| `indentPouBody` | `false` | Indent VAR sections and code inside a POU |
| `splitStatements` | `true` | One statement per line |
| `alignAssignments` | `true` | Align `:=` in consecutive assignments |
| `assignmentAlignColumn` | `0` | `0` aligns per run; a column number aligns all `:=` to that column |
| `assignmentMaxColumn` | `60` | Lines whose `:=` would land beyond this column are left unaligned |
| `alignDeclarations` | `true` | Three-column declaration layout |
| `declarationMaxColumn` | `48` | Maximum column for the `:` of declarations |
| `alignTrailingComments` | `true` | Align trailing comments in aligned groups |
| `blankLineBetweenVarSections` | `true` | One blank line between VAR sections |
| `reorderVarSections` | `false` | Reorder VAR sections into the guideline order |
| `maxBlankLines` | `1` | Maximum number of consecutive blank lines |
| `callStyle` | `guideline` | `guideline` (multi-line calls) \| `guideline-always` \| `preserve` |
| `callExpandMinArgs` | `3` | Minimum named arguments for `guideline-always` |

Indentation size and tabs vs. spaces come from the editor (`editor.tabSize`, `editor.insertSpaces`). The extension defaults these to 4 spaces for both languages.

## Lint

Findings appear in the Problems view. For rules the formatter can fix, the quick fix *Format document to fix* is offered. Set severities with `structuredText.lint.rules` (`off` \| `hint` \| `information` \| `warning` \| `error`):

| Rule | Default | Guideline |
|---|---|---|
| `keyword-case`: keyword casing differs from the formatter settings | warning | 4.1.1.2 |
| `one-statement-per-line` | warning | 4.1.1.2.1 |
| `var-section-order`: wrong order, or no blank line between VAR sections | warning | 4.1.1.2.2 |
| `no-direct-address`: `%I` / `%Q` / `%M` used in code | warning | 4.1.1.1 |
| `no-jump`: JMP / GOTO | warning | 4.1.1.2.2 |
| `case-numeric-label`: plain numbers as CASE labels | warning | 4.1.1.2.4 |
| `explicit-parentheses`: operators of different precedence mixed without parentheses | information | 4.1.1.2 |
| `for-counter-modified`: FOR counter assigned in the loop body | warning | 4.1.1.2.11 |
| `prefer-for-loop`: WHILE / REPEAT used | hint | 4.1.1.2.11 |
| `variable-prefix`: Hungarian notation (memory prefix `i q iq s t c g gc`, then a type prefix such as `b by w dw i di r lr t lt s`, then an upper-case letter) | warning | 4.1.1.1, 6.1 |
| `pou-prefix`: `fb` / `fc` / `prg` for POUs, `t` for types, `u` for unions | warning | 3.3 |
| `no-underscore-in-names`: use CamelCase | hint | 6.1 |
| `missing-header`: the file doesn't start with a header comment | off | 4.1.1.1 |

More lint settings:
- `structuredText.lint.enable`: turns lint on or off.
- `structuredText.lint.allowCfcStyleIo` (default `true`): accepts all-caps input/output names of up to 8 characters, such as IEC PAS 63131 terminal names like `XGH` or `PTDH`.
- `structuredText.lint.checkStructMembers` (default `false`): also checks type prefixes of STRUCT/UNION members.

## Outline and folding

- The outline and breadcrumbs show POUs, methods, properties, VAR sections with their variables, types and SCL regions.
- Folding covers POUs, VAR sections, control structures, TYPE/STRUCT blocks, SCL `REGION`, CODESYS `{region}` / `{endregion}` pragmas, block comments and runs of line comments.

## Snippets

| Prefix | ST | SCL |
|---|---|---|
| `header` | Source file header with version table (4.1.1.1) | ✓ |
| `fb`, `fc`, `prg` / `ob`, `db` | POU skeletons with sections in the mandated order | ✓ |
| `method` | METHOD | |
| `type`, `union` | STRUCT type (4.2), bit-access union (4.1.1.2.10) | `type` |
| `fsm` | CASE state machine (4.1.1.2.12) | ✓ |
| `edge`, `edgechange` | Edge detection (4.1.1.2.9) | `edge` |
| `timing` | Timing with a time tick (4.1.1.2.8) | ✓ |
| `fbcall`, `fccall` | Call layout (4.1.1.2.6/7) | `fbcall` |
| `if`, `ifelse`, `ifelsif`, `case`, `for` | Control structures | ✓ |
| `section`, `summary`, `param`, `returns` | Documentation comments (4.1.1.2.3, 6.4, 6.5) | `section` |
| `region` | | REGION block |

## Limitations

- The formatter is layout-based, not a full compiler front end. On unusual constructs it falls back to leaving lines as they are, and the safety net guarantees the code itself is unchanged.
- TwinCAT `.TcPOU` XML files and CODESYS PLCopenXML exports are not supported. Use plain-text `.st` exports.

## Development

```bash
npm install
npm run build          # generate grammars, typecheck, bundle to dist/
npm test               # unit tests (lexer, structure, formatter fixtures, lint, outline, snippets, wiring)
npm run test:grammar   # TextMate scope tests in test/grammar
npm run fmt -- file.st # format a file from the command line (prints to stdout)
npm run package        # build a .vsix
```

Press `F5` in VS Code to start an Extension Development Host with the files in `samples/`.

Layout:
- `src/language`: dialects, keyword tables, lexer, structure parser, outline.
- `src/formatter`: casing, layout, reordering, verifier.
- `src/lint`: rules.
- `scripts/build-grammars.ts`: generates `syntaxes/*.tmLanguage.json`.
- Golden formatter tests live in `test/format/fixtures` (`*.input.*` → `*.expected.*`).
