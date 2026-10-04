import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readZip, redactZip, writeZip } from './zip.js';

describe('zip', () => {
  const dir = mkdtempSync(join(tmpdir(), 'haunt-zip-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('reads back what it wrote', () => {
    const path = join(dir, 'a.zip');
    const entries: Array<[string, Buffer]> = [
      ['trace.trace', Buffer.from('{"type":"fill","value":"x"}\n'.repeat(50))],
      ['resources/é.txt', Buffer.from('ünïcode')],
      ['empty', Buffer.alloc(0)],
    ];
    writeZip(path, entries);
    expect(readZip(path)).toEqual(entries);
  });

  it('rewrites the text entries and leaves images alone', () => {
    const path = join(dir, 'b.zip');
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x73, 0x65, 0x63]);
    writeZip(path, [
      ['trace.network', Buffer.from('password=secret-value&x=1')],
      ['page.png', image],
    ]);
    redactZip(path, (text) => text.replaceAll('secret-value', '[redacted]'));
    expect(readZip(path)).toEqual([
      ['trace.network', Buffer.from('password=[redacted]&x=1')],
      ['page.png', image],
    ]);
  });

  it('refuses what is not an archive', () => {
    const path = join(dir, 'c.zip');
    writeZip(path, []);
    expect(readZip(path)).toEqual([]);
    expect(() => readZip(__filename)).toThrow(/not a zip archive/);
  });
});
