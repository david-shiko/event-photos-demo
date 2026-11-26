'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { clockOf, eventSpan, type MapEvent } from '@/lib/data';

const PX_PER_HOUR = 52;
const PX_PER_MIN = PX_PER_HOUR / 60;

export default function TimeRail({
  from,
  to,
  chosen,
  now,
  events,
  onChange,
}: {
  from: number;
  to: number;
  chosen: number;
  now: number;
  events: MapEvent[];
  onChange: (m: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const raf = useRef(0);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !first.current) return;
    first.current = false;
    el.scrollLeft = (chosen - from) * PX_PER_MIN - el.clientWidth / 2;
  }, [chosen, from]);

  const read = () => {
    const el = box.current;
    if (!el) return;
    const m = from + (el.scrollLeft + el.clientWidth / 2) / PX_PER_MIN;
    onChange(Math.round(m / 5) * 5);
  };

  const go = (m: number) => {
    const el = box.current;
    if (!el) return;
    el.scrollTo({ left: (m - from) * PX_PER_MIN - el.clientWidth / 2, behavior: 'smooth' });
  };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onScroll = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(read);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from]);

  const width = (to - from) * PX_PER_MIN;
  const at = (m: number) => (m - from) * PX_PER_MIN;

  const hours: number[] = [];
  for (let m = Math.ceil(from / 60) * 60; m <= to; m += 60) hours.push(m);

  const dots = events.map((e) => ({ e, ...eventSpan(e) })).filter((d) => d.start >= from && d.start <= to);

  return (
    <div className="rail">
      <div className="railline" />
      <div
        className="railscroll"
        ref={box}
        onWheel={(e) => {
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            const el = box.current;
            if (el) el.scrollLeft += e.deltaY;
          }
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

          {dots.map(({ e, start }) => (
            <button
              key={e.id}
              className={`raildot ${e.frames > 0 ? 'on' : ''}`}
              style={{ left: at(start) }}
              onClick={() => go(start + 40)}
              aria-label={e.title}
            />
          ))}

          <span className="railnow" style={{ left: at(now) }} />
        </div>
      </div>
      <span className="railpin">
        <i />
      </span>
    </div>
  );
}
