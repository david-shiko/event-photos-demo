'use client';

import { useRef } from 'react';

export type Bucket = { from: number; count: number };

const clock = (m: number) =>
  `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export default function Timeline({
  from,
  to,
  buckets,
  at,
  onChange,
  wasThere,
  moment,
  guests,
}: {
  from: number;
  to: number;
  buckets: Bucket[];
  at: number | null;
  onChange: (m: number | null) => void;
  wasThere: number;
  moment?: { time: string; text: string };
  guests: number;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const pos = (m: number) => `${Math.min(100, Math.max(0, ((m - from) / (to - from)) * 100))}%`;

  const pick = (clientX: number) => {
    const el = rail.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onChange(from + Math.round((f * (to - from)) / 15) * 15);
  };

  const momentAt = moment ? clockToMinutes(moment.time) : null;
  const active = at !== null;

  return (
    <div className="tl">
      <div className="tlhead">
        <span>{clock(from)}</span>
        <span className="tltime">{active ? clock(at) : 'весь вечер'}</span>
        <span>{clock(to)}</span>
      </div>

      <div
        className="tlrail"
        ref={rail}
        role="slider"
        aria-label="Время вечера"
        aria-valuemin={from}
        aria-valuemax={to}
        aria-valuenow={at ?? from}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) pick(e.clientX);
        }}
      >
        <div className="tlbars">
          {buckets.map((b, i) => (
            <i
              key={i}
              className={active && Math.abs(b.from - at) <= 40 ? 'on' : ''}
              style={{ height: `${Math.max(8, (b.count / max) * 100)}%` }}
            />
          ))}
        </div>

        {[0, 1, 2, 3].map((k) => {
          const hour = 120 * k;
          return <span key={k} className="tltick" style={{ left: `${(hour / (to - from)) * 100}%` }} />;
        })}

        {momentAt !== null && (
          <span
            className={`tlmom ${
              (momentAt - from) / (to - from) > 0.62
                ? 'right'
                : (momentAt - from) / (to - from) < 0.2
                  ? 'left'
                  : ''
            }`}
            style={{ left: pos(momentAt) }}
            title={moment?.text}
          >
            <b>{moment?.text}</b>
          </span>
        )}

        <span className="tlwas" style={{ left: pos(wasThere) }} title="вы были здесь" />

        {active && (
          <span className="tlknob" style={{ left: pos(at) }}>
            <i />
          </span>
        )}
      </div>

      <div className="tlfoot">
        <button className={active ? 'on' : ''} onClick={() => onChange(null)}>
          весь вечер
        </button>
        <button onClick={() => onChange(wasThere)}>я был(а) в {clock(wasThere)}</button>
        <span className="tlg">{guests} принесли гости</span>
      </div>
    </div>
  );
}

function clockToMinutes(t: string) {
  const h = Number(t.slice(0, 2));
  return (h < 12 ? h + 24 : h) * 60 + Number(t.slice(3, 5));
}
