let fails = 0, passes = 0; const prefix: string[] = [];
export function describe(n: string, f: () => void) { prefix.push(n); f(); prefix.pop(); }
export function it(n: string, f: () => void) { const t = Date.now(); try { f(); passes++; console.log('✓', n, `${Date.now() - t}ms`); } catch (e) { fails++; console.log('✗', [...prefix, n].join(' > '), (e as Error).message); } }
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function make(v: any, not: boolean, label?: string): any {
  const ok = (c: boolean, m: string) => { if (c === not) throw new Error(`${label ? label + ': ' : ''}${not ? 'not ' : ''}${m}`); };
  return {
    toBe: (b: any) => ok(Object.is(v, b), `toBe ${JSON.stringify(v)} vs ${JSON.stringify(b)}`),
    toEqual: (b: any) => ok(eq(v, b), `toEqual ${JSON.stringify(v)} vs ${JSON.stringify(b)}`),
    toContain: (b: any) => ok(v.includes(b), `toContain ${JSON.stringify(b)}`),
    toHaveLength: (n: number) => ok(v.length === n, `length ${v.length} vs ${n}`),
    toBeGreaterThan: (n: number) => ok(v > n, `${v} > ${n}`),
    toBeLessThan: (n: number) => ok(v < n, `${v} < ${n}`),
    toBeNull: () => ok(v === null, `null, got ${JSON.stringify(v)}`),
    toBeUndefined: () => ok(v === undefined, `undefined, got ${JSON.stringify(v)}`),
    toBeDefined: () => ok(v !== undefined, 'defined'),
    toMatchObject: (b: any) => ok(Object.entries(b).every(([k, x]) => eq(v?.[k], x)), `toMatchObject ${JSON.stringify(v)}`),
    toThrow: () => { let t = false; try { v(); } catch { t = true; } ok(t, 'throw'); },
    get not() { return make(v, !not, label); },
  };
}
export const expect = (v: any, label?: string) => make(v, false, label);
process.on('exit', () => console.log(`passed ${passes}, failed ${fails}`));
