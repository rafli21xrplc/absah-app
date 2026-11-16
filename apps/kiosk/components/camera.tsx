'use client';

import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (options: { formats: string[] }) => Detector;

const FRAME_MS = 150;

/** Rear camera reading QR codes: BarcodeDetector where the browser has it, jsQR otherwise. */
export function Camera({ onCode, className }: { onCode: (text: string) => void; className?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const handler = useRef(onCode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handler.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const Ctor = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    const detector = Ctor ? new Ctor({ formats: ['qr_code'] }) : null;

    const read = async (el: HTMLVideoElement): Promise<string | null> => {
      if (detector) return (await detector.detect(el))[0]?.rawValue ?? null;
      if (!ctx || el.videoWidth === 0) return null;
      canvas.width = el.videoWidth;
      canvas.height = el.videoHeight;
      ctx.drawImage(el, 0, 0);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
    };
    const loop = async () => {
      const el = video.current;
      if (stopped || !el) return;
      const text = el.readyState >= 2 ? await read(el).catch(() => null) : null;
      if (text) handler.current(text);
      timer = setTimeout(() => void loop(), FRAME_MS);
    };

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(async (s) => {
        stream = s;
        if (stopped || !video.current) return s.getTracks().forEach((t) => t.stop());
        video.current.srcObject = s;
        await video.current.play();
        void loop();
      })
      .catch(() => setError('Kamera tidak bisa dibuka. Izinkan kamera, atau pakai pemindai USB.'));

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return error ? <p className={className}>{error}</p> : <video ref={video} className={className} muted playsInline aria-label="Kamera pemindai" />;
}
