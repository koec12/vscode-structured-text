# Changelog

## Unreleased

- Distinct default colours for assignment (`:=`), comparison (`=`, `<>`, `<`, `>=`, …) and logical operators (`And`, `Or`, `Xor`, `Not`, `&`), with darker variants for light themes.
- `Array`, `Of`, `Pointer`, `Reference` and `To` in type definitions follow the data type casing (Pascal by default).
- `True` / `False` are Pascal case by default.
- `ELSIF` is written `Elsif` in Pascal case.
- Clearer naming messages: the suggested name keeps the existing base name (`qlrRemainingTime` instead of `qlrQltRemainingTime`) and says which type a wrong prefix belongs to.
- Removed guideline section references from messages, settings and snippets. `callStyle` values renamed to `multiline` / `always` (the old values still work).

## 0.1.0

- Syntax highlighting for IEC 61131-3 Structured Text (CODESYS / TwinCAT) and Siemens SCL.
- Formatter (assignments aligned on column 41 by default) with a verifier that rejects any change other than whitespace and keyword casing.
- 13 lint rules for coding convention violations.
- Outline, breadcrumbs and folding.
- ST and SCL snippets.
