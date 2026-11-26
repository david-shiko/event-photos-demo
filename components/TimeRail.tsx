'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clockOf, eventSpan, type MapEvent } from '@/lib/data';

const PX_PER_HOUR = 52;
const PX_PER_MIN = PX_PER_HOUR / 60;
const SNAP = 5;
const ANIM = 480;

export default function TimeRail({
  from,
  to,
  chosen,
  now,
  events,
  onChange,
  onEvent,
}: {
  from: number;
  to: number;
  chosen: number;
  now: number;
  events: MapEvent[];
  onChange: (m: number) => void;
  onEvent?: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  /* половина ширины ленты: столько отступа с двух сторон, чтобы любое время
     можно было поставить под стрелку — иначе вечер 16 июля упирается в край */
  const [pad, setPad] = useState(0);
  // Время, которое лента показывает сама. Расходится с `chosen` только когда
  // время пришло снаружи: день, точка вечера, «к нему».
  const mine = useRef(chosen);
  const animating = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raf = useRef(0);
  const drag = useRef<{ x: number; left: number; id: number; grabbed: boolean } | null>(null);
  const moved = useRef(false);

  const center = useCallback((m: number) => (m - from) * PX_PER_MIN, [from]);

  const read = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const m = from + el.scrollLeft / PX_PER_MIN;
    const snapped = Math.round(m / SNAP) * SNAP;
    if (Math.abs(snapped - mine.current) < SNAP) return;
    mine.current = snapped;
    onChange(snapped);
  }, [from, onChange]);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setPad(el.clientWidth / 2);
    el.scrollLeft = center(chosen);
    mine.current = chosen;
    const ro = new ResizeObserver(() => setPad(el.clientWidth / 2));
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Время снаружи: лента едет к нему сама, а свои scroll-события на это время глушим.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (Math.abs(chosen - mine.current) < 1) return;
    mine.current = chosen;
    animating.current = true;
    const target = center(chosen);
    el.scrollTo({ left: target, behavior: 'smooth' });
    if (timer.current) clearTimeout(timer.current);
    /* ждём, пока лента реально доедет: таймер срабатывал посреди анимации
       и день «16 июля» вставал на 20:40 вместо 21:40 */
    const started = Date.now();
    const settle = () => {
      const done = Math.abs(el.scrollLeft - target) < 2 || Date.now() - started > 1400;
      if (!done) {
        timer.current = setTimeout(settle, 60);
        return;
      }
      animating.current = false;
      read();
    };
    timer.current = setTimeout(settle, 60);
  }, [chosen, center, read]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onScroll = () => {
      if (animating.current) return;
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(read);
    };
    const end = () => {
      if (!animating.current) return;
      animating.current = false;
      read();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('scrollend', end);
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('scrollend', end);
      cancelAnimationFrame(raf.current);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [read]);

  const width = (to - from) * PX_PER_MIN + pad * 2;
  const at = (m: number) => pad + (m - from) * PX_PER_MIN;

  const hours: number[] = [];
  for (let m = Math.ceil(from / 60) * 60; m <= to; m += 60) hours.push(m);

  const marks: { start: number; items: MapEvent[] }[] = [];
  for (const e of events) {
    const { start } = eventSpan(e);
    if (start < from || start > to) continue;
    const same = marks.find((m) => m.start === start);
    if (same) same.items.push(e);
    else marks.push({ start, items: [e] });
  }

  return (
    <div className="rail">
      <div className="railline" />
      <div
        className="railscroll"
        ref={box}
        role="slider"
        tabIndex={0}
        aria-label="Время суток"
        aria-valuemin={from}
        aria-valuemax={to}
        aria-valuenow={chosen}
        aria-valuetext={clockOf(chosen).time}
        onWheel={(e) => {
          if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
          const el = box.current;
          if (el) el.scrollLeft += e.deltaY;
        }}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          const step = (e.shiftKey ? 60 : 15) * (e.key === 'ArrowLeft' ? -1 : 1);
          onChange(mine.current + step);
        }}
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse' || e.button !== 0) return;
          const el = box.current;
          if (!el) return;
          moved.current = false;
          // Захват ставим только на движении: с захватом сразу pointerup уходит
          // в контейнер, и click по точке вечера до кнопки не доходит.
          drag.current = { x: e.clientX, left: el.scrollLeft, id: e.pointerId, grabbed: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          const el = box.current;
          if (!el) return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) <= 4) return;
          if (!d.grabbed) {
            d.grabbed = true;
            moved.current = true;
            el.setPointerCapture(e.pointerId);
            el.classList.add('drag');
          }
          el.scrollLeft = d.left - dx;
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          const el = box.current;
          drag.current = null;
          el?.classList.remove('drag');
          if (!d.grabbed) return;
          try {
            el?.releasePointerCapture(e.pointerId);
          } catch {
            /* уже отпущено */
          }
        }}
        onPointerCancel={() => {
          drag.current = null;
          box.current?.classList.remove('drag');
        }}
      >
        <div className="railtrack" style={{ width }}>
          {hours.map((m) => {
            const c = clockOf(m);
            const two = Number(c.time.slice(0, 2)) % 2 === 0 && c.time.endsWith(':00');
            return (
              <span key={m} className={`railhour ${two ? 'two' : ''}`} style={{ left: at(m) }}>
                <i />
                {two && <em>{c.time}</em>}
              </span>
            );
          })}

          {Array.from({ length: Math.ceil((to - from) / 1440) }, (_, i) => {
            const m = Math.ceil(from / 1440) * 1440 + i * 1440;
            if (m > to) return null;
            const c = clockOf(m);
            return (
              <span key={`d${m}`} className="railday" style={{ left: at(m) }}>
                <b>{c.label}</b>
              </span>
            );
          })}

          {marks.map(({ start, items }) => {
            const lead = items.find((i) => i.frames > 0) ?? items[0];
            return (
              <button
                key={start}
                className={`raildot ${items.some((i) => i.frames > 0) ? 'on' : ''} ${items.length > 1 ? 'multi' : ''}`}
                style={{ left: at(start) }}
                onClick={() => {
                  if (moved.current) return;
                  onEvent?.(lead.id);
                  onChange(start + 40);
                }}
                aria-label={lead.title}
                title={items.map((i) => i.title).join(' · ')}
              />
            );
          })}

          <span className="railnow" style={{ left: at(now) }} />
        </div>
      </div>
      <span className="railpin">
        <i />
      </span>
    </div>
  );
}
