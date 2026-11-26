'use client';

import { DAYS, type MapEvent } from '@/lib/data';

export default function DayStrip({
  day,
  events,
  onPick,
}: {
  day: number;
  events: MapEvent[];
  onPick: (day: number) => void;
}) {
  return (
    <div className="days">
      {DAYS.map((d, i) => {
        const n = events.filter((e) => e.when.split(', ')[0] === d.label).length;
        return (
          <button key={d.label} className={i === day ? 'on' : ''} onClick={() => onPick(i)}>
            <b>{d.label.split(' ')[0]}</b>
            <i>{d.short}</i>
            <span className={`load ${n > 4 ? 'hi' : n > 0 ? 'mid' : ''}`} />
          </button>
        );
      })}
    </div>
  );
}
