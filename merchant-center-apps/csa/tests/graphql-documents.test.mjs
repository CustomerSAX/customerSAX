import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Script } from 'node:vm';
import { parse } from 'graphql';

const source = readFileSync(
  new URL('../src/graphql.ts', import.meta.url),
  'utf8'
);

test('all tagged GraphQL documents parse after JavaScript string escaping', () => {
  const documents = [...source.matchAll(/gql`([\s\S]*?)`/g)];
  assert.ok(documents.length > 0, 'Expected at least one gql document');

  documents.forEach((match, index) => {
    const rawDocument = match[1];
    assert.equal(
      rawDocument.includes('${'),
      false,
      'This test expects GraphQL documents without interpolation'
    );
    const cookedDocument = new Script(
      `\`${rawDocument.replaceAll('`', '\\`')}\``
    ).runInNewContext();
    assert.doesNotThrow(
      () => parse(cookedDocument),
      `GraphQL document ${index + 1} should parse`
    );
  });
});
