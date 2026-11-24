'use client';

import { useState } from 'react';

/**
 * The class that shakes a box (Motion-UI 1). `trigger` is a counter the page raises on each wrong answer: every change plays the shake
 * again, because the class alternates between two animation names with the same frames. 0 (or no change yet) shakes nothing.
 * Under reduced motion base.css switches both off; the wrong answer is then shown by the red border and the message alone.
 */
export function useShake(trigger: number): string {
  const [seen, setSeen] = useState({ trigger, plays: 0 });
  if (seen.trigger !== trigger) setSeen({ trigger, plays: trigger > 0 ? seen.plays + 1 : seen.plays });
  if (seen.plays === 0) return '';
  return seen.plays % 2 === 1 ? 'motion-shake-a' : 'motion-shake-b';
}
