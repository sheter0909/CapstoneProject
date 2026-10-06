import { router } from '../src/routes.js';

type Entry = { method: string; path: string; middlewares: number };

function collect(stack: unknown[], prefix: string, out: Entry[]): void {
  for (const layer of stack as {
    route?: { path: string | string[]; methods: Record<string, boolean>; stack: unknown[] };
    handle?: { stack?: unknown[] };
  }[]) {
    if (layer.route) {
      const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
      const methods = Object.keys(layer.route.methods).filter((m) => m !== '_all' && layer.route?.methods[m]);
      for (const p of paths) {
        for (const m of methods) {
          out.push({ method: m.toUpperCase(), path: `${prefix}${p}`, middlewares: (layer.route.stack as unknown[]).length });
        }
      }
    } else if (layer.handle?.stack) {
      collect(layer.handle.stack, prefix, out);
    }
  }
}

const entries: Entry[] = [];
collect((router as unknown as { stack: unknown[] }).stack, '', entries);
entries.sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`));
for (const e of entries) {
  console.log(`${e.method} ${e.path} [${e.middlewares}]`);
}
console.error(`total: ${entries.length}`);
