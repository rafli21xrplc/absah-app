/** Up to two capital letters for an avatar: first letters of the first two words. "Gilang Ramadhan" -> "GR". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length === 1 ? [...(words[0] ?? '')].slice(0, 2) : words.slice(0, 2).map((w) => [...w][0] ?? '');
  return letters.join('').toLocaleUpperCase('id-ID');
}
