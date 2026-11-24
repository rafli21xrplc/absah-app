export const SOURCE: string;
export const TS_OUT: string;
export const CSS_OUT: string;
export const FONT_VARIABLE: string;
export function buildTs(tokens: unknown): string;
export function buildCss(tokens: unknown): string;
export function buildAll(tokens?: unknown): { ts: string; css: string };
