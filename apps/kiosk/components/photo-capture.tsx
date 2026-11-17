'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from '@/app/page.module.css';

const MAX_SIDE = 640;

/** One camera frame as a small JPEG (about 40-80 KB): enough to recognise a face at the gate. */
async function snapshot(video: HTMLVideoElement): Promise<Blob | null> {
  if (video.videoWidth === 0) return null;
  const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
}

/**
 * Optional guest photo from the front camera. Opens only when asked, stops the camera as soon as
 * the photo is taken, and never blocks the visit: no camera simply means no photo.
 */
export function PhotoCapture({ photo, onPhoto }: { photo: Blob | null; onPhoto: (blob: Blob | null) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then(async (s) => {
        stream = s;
        if (stopped || !video.current) return s.getTracks().forEach((t) => t.stop());
        video.current.srcObject = s;
        await video.current.play();
      })
      .catch(() => {
        setError('Kamera tidak bisa dibuka. Foto boleh dilewati.');
        setOpen(false);
      });
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open]);

  async function take() {
    const blob = video.current ? await snapshot(video.current) : null;
    if (blob) {
      onPhoto(blob);
      setOpen(false);
    } else {
      setError('Foto belum berhasil. Coba lagi.');
    }
  }

  return (
    <div className={styles.photo}>
      {open ? (
        <>
          <video ref={video} className={styles.pairCamera} muted playsInline aria-label="Kamera foto tamu" />
          <button type="button" className={styles.primary} onClick={() => void take()}>
            Ambil foto
          </button>
        </>
      ) : preview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: URL, nothing to optimise */}
          <img src={preview} alt="Foto tamu" className={styles.pairCamera} />
          <button type="button" className={styles.secondary} onClick={() => onPhoto(null)}>
            Hapus foto
          </button>
        </>
      ) : (
        <button type="button" className={styles.secondary} onClick={() => setOpen(true)}>
          Ambil foto (boleh dilewati)
        </button>
      )}
      {error ? (
        <p role="alert" className={styles.alert}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
