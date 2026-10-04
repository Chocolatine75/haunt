import { describe, expect, it } from 'vitest';
import { tokensIn } from './replay.js';

const network = (...records: unknown[]): Array<[string, Buffer]> => [
  [
    'trace.network',
    Buffer.from(records.map((r) => JSON.stringify(r)).join('\n')),
  ],
];
const resource = (request: unknown[], response: unknown[]) => ({
  type: 'resource-snapshot',
  snapshot: { request: { headers: request }, response: { headers: response } },
});

describe('tokensIn', () => {
  it('finds the cookies sent, the ones set and the bearer token', () => {
    const tokens = tokensIn(
      network(
        resource(
          [
            { name: 'Cookie', value: 'theme=dark; session=abc123def456' },
            { name: 'Authorization', value: 'Bearer eyJhbGciOi.payload.sig' },
          ],
          [
            {
              name: 'Set-Cookie',
              value:
                'session=rolled0987654321; Path=/; HttpOnly\ncsrf=tok%2Fen%3D99; Path=/',
            },
          ],
        ),
      ),
    );
    expect(tokens).toEqual(
      expect.arrayContaining([
        'abc123def456',
        'eyJhbGciOi.payload.sig',
        'rolled0987654321',
        'tok%2Fen%3D99',
        'tok/en=99',
        'dark',
      ]),
    );
    expect(tokens).not.toContain('Path');
  });

  it('reads only the network records, and skips what is not JSON', () => {
    const tokens = tokensIn([
      ['resources/page.html', Buffer.from('{"name":"cookie","value":"a=x"}')],
      ['trace.trace', Buffer.from('not json\n')],
    ]);
    expect(tokens).toEqual([]);
  });
});
