/** Accepts 0812..., 62812... or +62812... and returns +62812... */
export function toE164(input: string): string {
  const digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('62')) return `+${digits}`;
  if (digits.startsWith('0')) return `+62${digits.slice(1)}`;
  return digits;
}

/** What was typed after the fixed "+62": "0812 3456 7890", "812-3456-7890" or "62812..." all become +62812... */
export function parentNumber(typed: string): string {
  let digits = typed.replace(/\D/g, '');
  if (digits.startsWith('62')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return `+62${digits}`;
}

/** "+6281234567890" -> "+62 812 ••• ••90": enough to recognise the number, not enough to read it. */
export function maskNumber(e164: string): string {
  const d = e164.slice(3);
  return `+62 ${d.slice(0, 3)} ••• ••${d.slice(-2)}`;
}
