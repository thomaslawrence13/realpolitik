import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCsv } from './csv';

test('parses quoted fields, embedded commas and quoted newlines', () => {
  const csv = 'a,b,c\n1,"x, y",3\n2,"line\nbreak",4\n';
  const rows = parseCsv(csv);
  assert.deepEqual(rows, [
    ['a', 'b', 'c'],
    ['1', 'x, y', '3'],
    ['2', 'line\nbreak', '4'],
  ]);
});

test('handles escaped quotes and CRLF endings', () => {
  const csv = 'name,note\r\n"A ""quoted"" name","with, comma"\r\n';
  const rows = parseCsv(csv);
  assert.deepEqual(rows, [
    ['name', 'note'],
    ['A "quoted" name', 'with, comma'],
  ]);
});

test('strips the UTF-8 BOM and skips empty trailing rows', () => {
  const rows = parseCsv('\uFEFFa,b\n1,2\n');
  assert.deepEqual(rows, [['a', 'b'], ['1', '2']]);
});