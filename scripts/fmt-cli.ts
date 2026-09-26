import { readFileSync } from 'node:fs';
import { format } from '../src/formatter/index';
import { SCL, ST } from '../src/language/dialect';
const f = process.argv[2];
const opts = process.argv[3] ? JSON.parse(process.argv[3]) : {};
const r = format(readFileSync(f, 'utf8'), f.endsWith('.scl') ? SCL : ST, opts);
if (!r.ok) console.error('ERROR', r.error);
process.stdout.write(r.text);
