import { afterAll, mock } from "bun:test";

/**
 * Bun's `mock.module` registry is process-global and has no per-file teardown,
 * so a mock declared in one test file stays installed for every file that runs
 * after it in the same `bun test` process. A partial factory therefore replaces
 * the whole module for those later files and drops every export it does not
 * list, which surfaces as `SyntaxError: Export named 'x' not found in module`.
 *
 * Whether that bites depends on the order Bun walks the test files, which is
 * directory-read order: a fresh CI checkout writes `app/api` before `app/lib`,
 * so CI runs the route tests first, while a local working copy often runs them
 * last and stays green.
 *
 * `mockModule` keeps a mock scoped to the file that declares it: it snapshots
 * the real module first, then reinstalls that snapshot once the file's tests
 * finish. Call it at the top level of a test file, before importing the code
 * under test.
 */
export async function mockModule(
  specifier: string,
  factory: () => Record<string, unknown>,
): Promise<void> {
  const original = { ...(await import(specifier)) };

  mock.module(specifier, factory);

  afterAll(() => {
    mock.module(specifier, () => original);
  });
}
