/** Fills `{name}` holes in a message from messages/id.ts: fill(messages.x.y, { n: 3 }). A missing value leaves the hole empty. */
export const fill = (text: string, values: Record<string, string | number>): string =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
