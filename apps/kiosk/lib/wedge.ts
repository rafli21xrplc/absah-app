/**
 * USB/Bluetooth QR scanners act as keyboards: characters arrive a few ms apart and end with Enter.
 * People type far slower, so a gap longer than maxGapMs starts a new buffer.
 */
export function wedgeReader(onCode: (code: string) => void, maxGapMs = 80) {
  let buffer = '';
  let last = 0;
  return (key: string, at: number) => {
    if (at - last > maxGapMs) buffer = '';
    last = at;
    if (key === 'Enter') {
      const code = buffer;
      buffer = '';
      if (code.length >= 8) onCode(code);
      return;
    }
    if (key.length === 1) buffer += key;
  };
}
