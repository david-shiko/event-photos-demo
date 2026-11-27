'use client';

import { useEffect, useRef } from 'react';
import type { Photo } from '@/lib/data';

/* Длинное нажатие — вход в выбор кадров. Кнопки «Выбрать» в панели нет:
   жест известен по галерее, а кнопка занимала место у всех, кому выбор не нужен. */
const HOLD = 450;
const SLOP = 10;

export default function Tile({
  photo,
  picked,
  onTap,
  onLong,
}: {
  photo: Photo;
  picked: boolean;
  onTap: (id: number) => void;
  onLong: (id: number) => void;
}) {
  const timer = useRef<number | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    from.current = null;
  };

  useEffect(() => clear, []);

  const down = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    from.current = { x: e.clientX, y: e.clientY };
    fired.current = false;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      fired.current = true;
      navigator.vibrate?.(12);
      onLong(photo.id);
    }, HOLD);
  };

  const move = (e: React.PointerEvent) => {
    if (!from.current) return;
    if (Math.abs(e.clientX - from.current.x) > SLOP || Math.abs(e.clientY - from.current.y) > SLOP) clear();
  };

  /* после жеста браузер всё равно присылает click — иначе он откроет лайтбокс поверх выбора */
  const tap = () => {
    if (fired.current) {
      fired.current = false;
      return;
    }
    onTap(photo.id);
  };

  return (
    <button
      className={`th ${picked ? 'picked' : ''}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={clear}
      onPointerCancel={clear}
      onPointerLeave={clear}
      onContextMenu={(e) => e.preventDefault()}
      onClick={tap}
      aria-label={`кадр ${photo.time}, ${photo.source === 'guest' ? 'гость' : 'фотограф'}${
        picked ? ', выбран' : ''
      }`}
    >
      <span className="im" style={{ backgroundImage: `url(${photo.img})`, backgroundPosition: photo.pos }} />
      {photo.source === 'guest' && <span className="g">гость</span>}
      {photo.likes > 40 && <span className="lk">♥ {photo.likes}</span>}
      {picked && <span className="sel">✓</span>}
    </button>
  );
}
