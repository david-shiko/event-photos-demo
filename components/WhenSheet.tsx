'use client';

import { useState } from 'react';
import { evenings, windowMinutes, type MapEvent } from '@/lib/data';

const DATES = [
  { key: '10 июля', label: '10 июля', short: 'чт' },
  { key: '11 июля', label: '11 июля', short: 'пт' },
  { key: '12 июля', label: '12 июля', short: 'сб' },
];

const HOURS: number[] = Array.from({ length: 8 }, (_, i) => 19 * 60 + i * 60);

const clock = (m: number) => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':00';

export default function WhenSheet({
  events,
  date,
  hour,
  onClose,
  onApply,
}: {
  events: MapEvent[];
  date: string;
  hour: number | null;
  onClose: () => void;
  onApply: (date: string, hour: number | null) => void;
}) {
  const [d, setD] = useState(date);
  const [h, setH] = useState(hour);

  const live = events.filter((e) => {
    if (e.when.split(', ')[0] !== d) return false;
    if (h === null) return true;
    const { from, to } = windowMinutes(e.when);
    return h >= from && h < to;
  });
  const frames = live.reduce((s, e) => s + e.frames, 0);

  return (
    <>
      <button className="scrim" onClick={onClose} aria-label="Закрыть" />
      <div className="sheet whn">
        <div className="grab" />
        <div className="st">Когда</div>

        <div className="wlb">Дата</div>
        <div className="wdates">
          {DATES.map((x) => (
            <button key={x.key} className={d === x.key ? 'on' : ''} onClick={() => setD(x.key)}>
              <span>{x.label}</span>
              <i>{x.short}</i>
            </button>
          ))}
        </div>

        <div className="wlb wlbrow">
          Время
          <button className={`wall ${h === null ? 'on' : ''}`} onClick={() => setH(null)}>
            весь вечер
          </button>
        </div>
        <div className="whours">
          {HOURS.map((m) => (
            <button key={String(m)} className={h === m ? 'on' : ''} onClick={() => setH(m)}>
              {m === null ? 'весь вечер' : clock(m)}
            </button>
          ))}
        </div>

        <div className="wres">
          {live.length > 0 ? (
            <>
              {h === null ? 'за вечер' : `в ${clock(h)} идёт`} {evenings(live.length)} ·{' '}
              <b>{frames}</b> кадров
            </>
          ) : (
            <>в это время вечеров пока нет</>
          )}
        </div>

        <div className="row2">
          <button
            className="ghost2"
            onClick={() => {
              setD('11 июля');
              setH(null);
            }}
          >
            11 июля
          </button>
          <button className="primary" onClick={() => onApply(d, h)}>
            Показать
          </button>
        </div>
      </div>
    </>
  );
}
