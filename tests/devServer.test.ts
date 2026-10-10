import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('middleware development server wiring', () => {
  it('attaches Vite HMR to the same HTTP server as Express and Socket.IO', () => {
    const source = readFileSync(resolve(process.cwd(), 'server.ts'), 'utf8');
    expect(source).toMatch(/middlewareMode:\s*true,\s*hmr:\s*\{\s*server:\s*httpServer\s*\}/);
    expect(source).toMatch(/httpServer\.listen\(PORT/);
  });
});