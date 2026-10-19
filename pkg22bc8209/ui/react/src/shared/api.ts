/*
 * Re-export shim — `@/shared/api` resolves to this file (a file named `api.ts` wins over
 * the `api/` directory in module resolution), so it forwards everything from `./api/index`.
 * The real module lives in ./api/index.ts (owner: Arnav; docs/CONTRACT.md §5.2). Anuva's
 * and Vibhrav's call files are ./api/anuva.ts and ./api/forecast.ts — import those directly.
 */

export * from './api/index';
