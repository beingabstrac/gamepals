/**
 * A small stand-in for vitest, so the rules tests can run on a machine with no node_modules
 * (scripts/run-rules-tests.sh). It covers exactly what the suite uses; anything else should be
 * added here rather than worked around in a test, or the local run quietly lies.
 */
let fails = 0;
let passes = 0;
const prefix: string[] = [];

export function describe(name: string, body: () => void): void {
  prefix.push(name);
  body();
  prefix.pop();
}

type Body = () => void | Promise<void>;

/** `it(name, body)` and `it(name, { timeout }, body)` are both used in the suite. */
export function it(name: string, optionsOrBody: Body | Record<string, unknown>, maybeBody?: Body): void {
  const body = (typeof optionsOrBody === 'function' ? optionsOrBody : maybeBody) as Body;
  const started = Date.now();
  try {
    body();
    passes++;
    console.log('✓', name, `${Date.now() - started}ms`);
  } catch (error) {
    fails++;
    console.log('✗', [...prefix, name].join(' > '), (error as Error).message);
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function make(value: any, negated: boolean, label?: string): any {
  const check = (ok: boolean, message: string) => {
    if (ok === negated) throw new Error(`${label ? label + ': ' : ''}${negated ? 'not ' : ''}${message}`);
  };
  return {
    toBe: (other: any) => check(Object.is(value, other), `toBe ${JSON.stringify(value)} vs ${JSON.stringify(other)}`),
    toEqual: (other: any) => check(same(value, other), `toEqual ${JSON.stringify(value)} vs ${JSON.stringify(other)}`),
    toContain: (item: any) => check(value.includes(item), `toContain ${JSON.stringify(item)}`),
    toHaveLength: (n: number) => check(value.length === n, `length ${value.length} vs ${n}`),
    toBeGreaterThan: (n: number) => check(value > n, `${value} > ${n}`),
    toBeGreaterThanOrEqual: (n: number) => check(value >= n, `${value} >= ${n}`),
    toBeLessThan: (n: number) => check(value < n, `${value} < ${n}`),
    toBeLessThanOrEqual: (n: number) => check(value <= n, `${value} <= ${n}`),
    toBeNull: () => check(value === null, `null, got ${JSON.stringify(value)}`),
    toBeUndefined: () => check(value === undefined, `undefined, got ${JSON.stringify(value)}`),
    toBeDefined: () => check(value !== undefined, 'defined'),
    toMatchObject: (shape: any) =>
      check(
        Object.entries(shape).every(([key, want]) => same(value?.[key], want)),
        `toMatchObject ${JSON.stringify(value)} vs ${JSON.stringify(shape)}`,
      ),
    toThrow: () => {
      let threw = false;
      try {
        value();
      } catch {
        threw = true;
      }
      check(threw, 'throw');
    },
    get not() {
      return make(value, !negated, label);
    },
  };
}

export const expect = (value: any, label?: string) => make(value, false, label);

process.on('exit', () => console.log(`passed ${passes}, failed ${fails}`));
