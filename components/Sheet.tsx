'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/* Лист снизу: закрывается тапом по затемнению и свайпом вниз.
   Кнопки «Отмена» нет — вниз, и всё. */
const CLOSE_AFTER = 90; // px вниз, после которых лист уезжает

type Props = {
  onClose: () => void;
  className?: string;
  closeLabel?: string;
  children: ReactNode;
};

export default function Sheet({ onClose, className = '', closeLabel = 'Закрыть', children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const sheet = ref.current;
    if (!sheet) return;

    let id: number | null = null;
    let y0 = 0;
    let dy = 0;

    const end = (back: boolean) => {
      sheet.style.transition = 'transform 0.2s ease-out';
      sheet.style.transform = back ? '' : 'translateY(100%)';
      if (!back) window.setTimeout(() => close.current(), 170);
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      /* список прокручен — вниз листается список, а не лист */
      if (sheet.scrollTop > 0) return;
      id = e.pointerId;
      y0 = e.clientY;
      dy = 0;
    };

    const move = (e: PointerEvent) => {
      if (id !== e.pointerId) return;
      dy = Math.max(0, e.clientY - y0);
      sheet.style.transition = 'none';
      sheet.style.transform = dy ? `translateY(${dy}px)` : '';
    };

    const up = (e: PointerEvent) => {
      if (id !== e.pointerId) return;
      id = null;
      end(dy <= CLOSE_AFTER);
    };

    sheet.addEventListener('pointerdown', down);
    sheet.addEventListener('pointermove', move);
    sheet.addEventListener('pointerup', up);
    sheet.addEventListener('pointercancel', up);
    return () => {
      sheet.removeEventListener('pointerdown', down);
      sheet.removeEventListener('pointermove', move);
      sheet.removeEventListener('pointerup', up);
      sheet.removeEventListener('pointercancel', up);
    };
  }, []);

  return (
    <>
      <button className="scrim" onClick={onClose} aria-label={closeLabel} />
      <div ref={ref} className={`sheet ${className}`.trim()} role="dialog" aria-modal="true">
        <div className="grab" />
        {children}
      </div>
    </>
  );
}
