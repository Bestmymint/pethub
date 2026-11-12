import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const compose = readFileSync(new URL('../../infra/compose.demo.yml', import.meta.url), 'utf8');

describe('the demo tools flag in compose', () => {
  it('is set to true on the app service only, never in the shared environment', () => {
    expect(compose.match(/DEMO_TOOLS_ENABLED/gu)).toHaveLength(1);
    const shared = compose.slice(compose.indexOf('x-demo-env:'), compose.indexOf('services:'));
    expect(shared).not.toContain('DEMO_TOOLS_ENABLED');
    const app = compose.slice(compose.indexOf('\n  app:'), compose.indexOf('\n  worker:'));
    expect(app).toContain("DEMO_TOOLS_ENABLED: 'true'");
    const worker = compose.slice(compose.indexOf('\n  worker:'));
    expect(worker).not.toContain('DEMO_TOOLS_ENABLED');
  });
});
