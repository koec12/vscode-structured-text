/**
 * Minimal line-based edits between two texts, so formatting keeps cursor
 * positions and markers outside the changed lines.
 */
import { diffArrays } from 'diff';

export interface TextChange {
    /** Offsets in the old text. */
    start: number;
    end: number;
    text: string;
}

function splitKeepEol(text: string): string[] {
    return text.match(/[^\r\n]*(?:\r\n|\n|\r)|[^\r\n]+$/g) ?? [];
}

export function computeChanges(oldText: string, newText: string): TextChange[] {
    if (oldText === newText) {
        return [];
    }
    const changes: TextChange[] = [];
    let offset = 0;
    let pending: TextChange | undefined;
    for (const part of diffArrays(splitKeepEol(oldText), splitKeepEol(newText))) {
        const len = part.value.reduce((n, l) => n + l.length, 0);
        if (part.added) {
            pending ??= { start: offset, end: offset, text: '' };
            pending.text += part.value.join('');
        } else if (part.removed) {
            pending ??= { start: offset, end: offset, text: '' };
            pending.end = offset + len;
            offset += len;
        } else {
            if (pending) {
                changes.push(pending);
                pending = undefined;
            }
            offset += len;
        }
    }
    if (pending) {
        changes.push(pending);
    }
    return changes;
}
