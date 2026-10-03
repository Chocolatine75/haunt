import { afterEach, describe, expect, it } from 'vitest';
import { setSabotage } from '../sabotage.js';
import { SignalCollector, scrubUrls, withoutQuery } from './collector.js';

function collector(authenticated = false): SignalCollector {
  return new SignalCollector({
    authenticated,
    sandbox: {
      blocked: () => false,
      allowed: () => true,
      blockedCount: () => 0,
    },
  });
}

const consoleError = (step: number, message: string) => ({
  kind: 'console_error' as const,
  url: 'http://127.0.0.1:3000/page',
  step,
  message,
  severity: 'minor' as const,
});

afterEach(() => setSabotage(null));

describe('withoutQuery', () => {
  it('drops the query string and the fragment', () => {
    expect(withoutQuery('http://a.test/x?token=1#top')).toBe('http://a.test/x');
    expect(withoutQuery('http://a.test/x#top')).toBe('http://a.test/x');
    expect(withoutQuery('http://a.test/x')).toBe('http://a.test/x');
  });
});

describe('scrubUrls', () => {
  it('drops query strings from every URL in a text, keeping stack positions', () => {
    expect(
      scrubUrls(
        'at go (http://a.test/app.js?v=secret:12:5)\nGET http://a.test/api?q=1 failed',
      ),
    ).toBe('at go (http://a.test/app.js:12:5)\nGET http://a.test/api failed');
  });
});

describe('SignalCollector', () => {
  it('counts a repeat within a step, and keeps two steps apart', () => {
    const c = collector();
    c.startStep(1);
    c.raise(consoleError(1, 'boom'));
    c.raise(consoleError(1, 'boom'));
    c.startStep(2);
    c.raise(consoleError(2, 'boom'));
    const signals = c.deliver(1);
    expect(signals.map((s) => [s.step, s.count])).toEqual([
      [1, 2],
      [2, 1],
    ]);
  });

  it('hands a signal over once, and marks one from an earlier call late', () => {
    const c = collector();
    c.startStep(1);
    c.raise(consoleError(1, 'first'));
    expect(c.deliver(1)).toHaveLength(1);
    c.raise(consoleError(1, 'after its result'));
    c.startStep(2);
    const [late] = c.deliver(2);
    expect(late).toMatchObject({ step: 1, late: true });
    expect(c.deliver(2)).toEqual([]);
    expect(c.all()).toHaveLength(2);
  });

  it('removes a typed credential in every spelling a page may give it', () => {
    const c = collector();
    c.addSecret('Zq9 hunter2+xK');
    c.raise(
      consoleError(
        0,
        'sent Zq9 hunter2+xK to http://a.test/reset/Zq9%20hunter2%2BxK and Zq9+hunter2%2BxK',
      ),
    );
    const [signal] = c.all();
    expect(signal.message).toBe(
      'sent [redacted] to http://a.test/reset/[redacted] and [redacted]',
    );
    expect(c.redact('password Zq9 hunter2+xK')).toBe('password [redacted]');
  });

  it('ignores a value too short to be told apart from ordinary text', () => {
    const c = collector();
    c.addSecret('abc');
    expect(c.redact('abc')).toBe('abc');
  });

  it('keeps the secret when sabotaged, so that the gate can tell', () => {
    const c = collector();
    c.addSecret('hunter22');
    setSabotage('signals_secrets_kept');
    expect(c.redact('hunter22')).toBe('hunter22');
  });

  it('records feedback on the signals of a step once the step is over', () => {
    const c = collector();
    c.startStep(1);
    c.raise({
      kind: 'js_exception',
      url: 'http://127.0.0.1:3000/page',
      step: 1,
      message: 'boom',
      stack: 'boom',
      source: { url: 'http://127.0.0.1:3000/app.js', line: 1, column: 1 },
      severity: 'major',
    });
    c.endStep(1, false);
    expect(c.all()[0]).toMatchObject({ feedback: false });
  });

  it('knows whether a step set anything in motion', () => {
    const c = collector();
    c.startStep(1);
    expect(c.causedAnything(1)).toBe(false);
    c.raise(consoleError(1, 'boom'));
    expect(c.causedAnything(1)).toBe(true);
  });

  it('runs a navigation the tester typed and passes its result through', async () => {
    const c = collector();
    await expect(c.typed(Promise.resolve(7))).resolves.toBe(7);
    await expect(c.typed(Promise.reject(new Error('down')))).rejects.toThrow(
      'down',
    );
  });

  it('raises nothing while switched off', () => {
    const c = collector();
    setSabotage('signals_off');
    expect(c.raise(consoleError(0, 'boom'))).toBeUndefined();
    setSabotage(null);
    expect(c.all()).toEqual([]);
  });
});
