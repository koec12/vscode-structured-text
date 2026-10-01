# Structured Text & SCL for Visual Studio Code

Language support for PLC programming in **IEC 61131-3 Structured Text** (CODESYS / TwinCAT flavour, `.st`) and **Siemens SCL** (TIA Portal, `.scl`):

- **Syntax highlighting** for both dialects
- **Formatter** for a consistent code layout (indentation, casing, alignment)
- **Lint**: coding convention violations reported as diagnostics
- **Outline, breadcrumbs and folding**
- **Snippets** for file headers, POU skeletons and common patterns

## Installation

The extension is not on the Marketplace. Install it from a `.vsix` file:

1. Download the `.vsix` file from the latest release on the [Releases page](https://github.com/koec12/vscode-structured-text/releases/latest). Every merge to `main` publishes a release, tagged `v<version>-build.<number>` (for example `v0.1.0-build.1`).
2. In VS Code, open the Extensions view (`Ctrl+Shift+X`), click the `...` menu at the top and choose **Install from VSIX...**. Select the downloaded file.
3. Reload the window if VS Code asks for it.

Or install it from a terminal:

```bash
code --install-extension vscode-structured-text-0.1.0-build.1.vsix
```

To update, install the newer `.vsix` the same way. VS Code 1.85 or later is required.

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

### Operator colours

Operators get their own colours so they are easy to spot, whatever colour theme you use:

| Operators | Dark themes | Light themes |
|---|---|---|
| Assignment `:=` (also `=>`, `S=`, `R=`, `REF=`) | bold orange | bold dark orange |
| Comparison `=` `<>` `<` `>` `<=` `>=` | green | dark green |
| Logical `And` `Or` `Xor` `Not` `And_Then` `Or_Else` `&` | pink | dark pink |

The colours are default values of `editor.tokenColorCustomizations`. The light variants apply to themes with "Light" in their name. To use other colours, add your own rules for the scopes `keyword.operator.assignment.st`, `keyword.operator.comparison.st` and `keyword.operator.logical.st` (`.scl` for SCL) in your settings. Note that your own `textMateRules` list replaces the default list:

```jsonc
"editor.tokenColorCustomizations": {
    "textMateRules": [
        { "scope": ["keyword.operator.assignment.st", "keyword.operator.assignment.scl"], "settings": { "foreground": "#E06C75", "fontStyle": "bold" } }
    ]
}
```

Both grammars are generated from one keyword table (`src/language/keywords.ts`). The formatter and linter use the same table.

## Formatter

Run **Format Document** (`Shift+Alt+F`), **Format Selection**, or enable `editor.formatOnSave`. Every setting can be overridden per language, for example to keep TIA's upper-case keywords in SCL:

```jsonc
"[siemens-scl]": {
    "structuredText.format.keywordCase": "upper"
}
```

| Formatting rule |
|---|
| Block indentation for IF / CASE / FOR / WHILE / REPEAT / VAR / STRUCT / TYPE / REGION. VAR sections and code stay at column 0 inside a POU (`indentPouBody` changes this) |
| CASE labels are indented one level and their statements two levels. The code after a label moves to its own line; a trailing comment stays on the label line |
| One statement per line. `IF a THEN b := 1; END_IF` becomes three lines |
| Code keywords `If / Elsif / End_If`, `And / Not` (or lower case). Declaration keywords `VAR_INPUT / END_VAR` UPPER. Data types and type definitions `Bool / LReal / LTime / Array[..] Of / Pointer To`. Literals `True / False`. Built-ins `Abs / Sqrt / LTime_To_LInt` |
| `:=` of every assignment statement vertically aligned on one column (41 by default). Named call arguments align within their call |
| Declarations laid out in three columns: name, `: Type := init;`, `//comment` |
| Exactly one blank line between VAR sections. Optional reordering into VAR CONSTANT, VAR_INPUT, VAR_OUTPUT, VAR_IN_OUT, VAR, VAR_TEMP |
| Multi-line calls with named arguments get one argument per line, with the parentheses on their own lines (below) |
| Consistent spacing around operators, commas and brackets. Blank lines are limited, trailing whitespace is removed, and the file's line endings are kept |
| Block comments (e.g. the header with its version table) are never re-wrapped |

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
| `declarationKeywordCase` | `upper` | FUNCTION_BLOCK, VAR_INPUT, END_VAR, STRUCT, BEGIN |
| `dataTypeCase` | `pascal` | Data types and type definitions (`Array … Of`, `Pointer To`, `Reference To`) |
| `builtinFunctionCase` | `pascal` | Built-in and conversion functions (only when called) |
| `booleanLiteralCase` | `pascal` | `True` / `False` |
| `indentPouBody` | `false` | Indent VAR sections and code inside a POU |
| `splitStatements` | `true` | One statement per line |
| `alignAssignments` | `true` | Align `:=` in consecutive assignments |
| `assignmentAlignColumn` | `41` | Column for `:=` in assignment statements; a left-hand side that doesn't fit gets one space. `0` aligns per run of consecutive assignments instead |
| `assignmentMaxColumn` | `60` | With per-run alignment (`assignmentAlignColumn: 0`): lines whose `:=` would land beyond this column are left unaligned |
| `alignDeclarations` | `true` | Three-column declaration layout |
| `declarationMaxColumn` | `48` | Maximum column for the `:` of declarations |
| `alignTrailingComments` | `true` | Align trailing comments in aligned groups |
| `blankLineBetweenVarSections` | `true` | One blank line between VAR sections |
| `reorderVarSections` | `false` | Reorder VAR sections to VAR CONSTANT, VAR_INPUT, VAR_OUTPUT, VAR_IN_OUT, VAR, VAR_TEMP |
| `maxBlankLines` | `1` | Maximum number of consecutive blank lines |
| `callStyle` | `multiline` | `multiline` (multi-line calls) \| `always` \| `preserve` |
| `callExpandMinArgs` | `3` | Minimum named arguments for `always` |

Indentation size and tabs vs. spaces come from the editor (`editor.tabSize`, `editor.insertSpaces`). The extension defaults these to 4 spaces for both languages.

## Lint

Findings appear in the Problems view. For rules the formatter can fix, the quick fix *Format document to fix* is offered. Set severities with `structuredText.lint.rules` (`off` \| `hint` \| `information` \| `warning` \| `error`):

| Rule | Default |
|---|---|
| `keyword-case`: keyword casing differs from the formatter settings | warning |
| `one-statement-per-line` | warning |
| `var-section-order`: wrong order, or no blank line between VAR sections | warning |
| `no-direct-address`: `%I` / `%Q` / `%M` used in code | warning |
| `no-jump`: JMP / GOTO | warning |
| `case-numeric-label`: plain numbers as CASE labels | warning |
| `explicit-parentheses`: operators of different precedence mixed without parentheses | information |
| `for-counter-modified`: FOR counter assigned in the loop body | warning |
| `prefer-for-loop`: WHILE / REPEAT used | hint |
| `variable-prefix`: Hungarian notation (memory prefix `i q iq s t c g gc`, then a type prefix such as `b by w dw i di r lr t lt s`, then an upper-case letter) | warning |
| `pou-prefix`: `fb` / `fc` / `prg` for POUs, `t` for types, `u` for unions | warning |
| `no-underscore-in-names`: use CamelCase | hint |
| `missing-header`: the file doesn't start with a header comment | off |

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
| `header` | Source file header with version table | ✓ |
| `fb`, `fc`, `prg` / `ob`, `db` | POU skeletons with sections in the mandated order | ✓ |
| `method` | METHOD | |
| `type`, `union` | STRUCT type, bit-access union | `type` |
| `fsm` | CASE state machine | ✓ |
| `edge`, `edgechange` | Edge detection | `edge` |
| `timing` | Timing with a time tick | ✓ |
| `fbcall`, `fccall` | Call layout | `fbcall` |
| `if`, `ifelse`, `ifelsif`, `case`, `for` | Control structures | ✓ |
| `section`, `summary`, `param`, `returns` | Documentation comments | `section` |
| `region` | | REGION block |

## Limitations

- The formatter is layout-based, not a full compiler front end. On unusual constructs it falls back to leaving lines as they are, and the safety net guarantees the code itself is unchanged.
- TwinCAT `.TcPOU` XML files and CODESYS PLCopenXML exports are not supported. Use plain-text `.st` exports.

## License

[MIT](LICENSE)

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
