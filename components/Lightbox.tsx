'use client';

import { useState } from 'react';
import type { Photo } from '@/lib/data';

export default function Lightbox({
  photos,
  start,
  onClose,
}: {
  photos: Photo[];
  start: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(Math.min(start, photos.length - 1));
  const [liked, setLiked] = useState<number[]>([]);

  const photo = photos[i];
  if (!photo) return null;

  const step = (d: number) => setI((prev) => Math.min(photos.length - 1, Math.max(0, prev + d)));
  const isLiked = liked.includes(photo.id);

  return (
    <div className="lb">
      <div className="bg" style={{ backgroundImage: `url(${photo.img})` }} />
      <div className="ph" style={{ backgroundImage: `url(${photo.img})` }} />
      <div className="top3">
        <button className="rb" onClick={onClose} aria-label="Закрыть">
          ✕
        </button>

      </div>

      {i > 0 && (
        <button className="nav l" onClick={() => step(-1)} aria-label="Назад">
          ‹
        </button>
      )}
      {i < photos.length - 1 && (
        <button className="nav r" onClick={() => step(1)} aria-label="Вперёд">
          ›
        </button>
      )}

      <div className="meta">
        <div className="t">
          {photo.time} · {photo.source === 'guest' ? 'гость' : 'фотограф'}
        </div>
        <div className="s">
          {i + 1} из {photos.length} · {photo.likes + (isLiked ? 1 : 0)} ♥ · 2400 × 3600
        </div>
        <div className="acts">
          <button
            className={isLiked ? 'liked' : ''}
            onClick={() =>
              setLiked((prev) => (prev.includes(photo.id) ? prev.filter((x) => x !== photo.id) : [...prev, photo.id]))
            }
          >
            ♥ {photo.likes + (isLiked ? 1 : 0)}
          </button>
          <a className="save" href={photo.img} download={`vecher-${photo.id + 1}.jpg`}>
            ↓ Скачать
          </a>
        </div>
      </div>
    </div>
  );
}
