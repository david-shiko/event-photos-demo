'use client';

import Link from 'next/link';
import { useState } from 'react';
import Shell from './Shell';
import LiveMap from './LiveMap';
import DayStrip from './DayStrip';
import TimeRail from './TimeRail';
import { asset, clockOf, DAYS, eventSpan, frames, mapEvents, plural, sources } from '@/lib/data';
import { useCopy } from '@/lib/client';

const NOW = 1440 + 21 * 60 + 40; // 11 июля, 21:40 — «сейчас» в демо
const START = 0; // 10 июля, 00:00
const END = 7 * 1440; // 17 июля, 00:00
const DIM = 30; // минут до начала, когда пин бледнеет
const TAIL = 30; // минут после конца, когда пин ещё виден

export default function MapView() {
  const [chosen, setChosen] = useState(NOW);
  const [picked, setPicked] = useState('7kd2qf9xm');
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [asked, setAsked] = useState(false);
  const { done: copied, copy } = useCopy();

  const clock = clockOf(chosen);
  const day = Math.max(0, Math.min(6, clock.day));
  const dayEvents = mapEvents.filter((e) => e.when.split(', ')[0] === DAYS[day].label);

  const spans = mapEvents.map((e) => ({ e, ...eventSpan(e) }));
  const shown = spans
    .filter((s) => chosen >= s.start - DIM && chosen <= s.end + TAIL)
    .map((s) => s.e);
  const dim = spans.filter((s) => s.start > chosen).map((s) => s.e.id);

  const next = spans
    .filter((s) => s.start > chosen)
    .sort((a, b) => a.start - b.start)[0];
  const last = spans
    .filter((s) => s.end < chosen)
    .sort((a, b) => b.end - a.end)[0];

  const current =
    mapEvents.find((e) => e.id === picked && shown.some((s) => s.id === picked)) ??
    shown[0] ??
    mapEvents[0];

  const ready = dayEvents.filter((e) => e.frames > 0);
  const people = dayEvents.reduce((s, e) => s + e.sources, 0);

  return (
    <Shell
      active="Карта"
      title="Карта"
      caption="Город, в котором прямо сейчас что-то происходит. Тяните ленту суток — под стрелкой встаёт новое время, пины зажигаются и гаснут."
      note={
        <>
          <b>Почему это работает.</b> Карта отвечает на «где и когда» — сайт вечера отвечает на
          «что там было». Ни у одного сервиса нет карты, которая живёт по времени.
        </>
      }
    >
      <div className="mapwrap">
        <LiveMap
          events={shown}
          dim={dim}
          activeId={current.id}
          onPick={(id) => {
            setPicked(id);
            setOpen(false);
          }}
        />

        <div className="mhead">
          <div className="mhdate">
            {DAYS[day].label}, {DAYS[day].dow}
          </div>
          <div className="mhrow">
            <div className="mhtime">{clock.time}</div>
            <div className="mhcount">
              {dayEvents.length} {plural(dayEvents.length, 'событие', 'события', 'событий')}
            </div>
          </div>
          <div className="mhsub">
            фото готовы у {ready.length} · {sources(people)}
          </div>
        </div>

        <div className="mbottom">
          {shown.length > 0 ? (
            <div className={`mcard ${open ? 'open' : ''}`}>
              <button className="grab" onClick={() => setOpen(!open)} aria-label="Развернуть карточку" />
              <div className="row" onClick={() => setOpen(!open)}>
                <div className="cv" style={{ backgroundImage: `url(${current.img})` }} />
                <div className="meta">
                  <div className="t">{current.title}</div>
                  <div className="l">
                    {current.venue} · {current.when.split(', ')[1]}
                  </div>
                  <div className="s">
                    {current.soon ? (
                      <>◷ вечер начнётся в {current.when.split(', ')[1].split('–')[0]}</>
                    ) : (
                      <>
                        <span className="dot-ok" />
                        {frames(current.frames)} · {sources(current.sources)}
                      </>
                    )}
                  </div>
                </div>
                <span className="chev">{open ? '⌄' : '⌃'}</span>
              </div>

              {open && !current.soon && (
                <div className="thumbs">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{ backgroundImage: `url(${asset(`/img/p${(i % 8) + 1}.png`)})` }}
                    />
                  ))}
                </div>
              )}

              {open && (
                <div className="btns">
                  {current.soon ? (
                    <button className="ghost" onClick={() => setAsked(true)}>
                      {asked ? 'напомним' : 'напомнить о начале'}
                    </button>
                  ) : (
                    <Link className="cta" href={`/e/${current.id}/`}>
                      Открыть вечер
                    </Link>
                  )}
                  <button className="ghost" onClick={() => setSheet(true)}>
                    Ссылка
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mempty">
              <b>
                {clock.time} — пока пусто
              </b>
              <span>
                {next
                  ? `Ближайший — «${next.e.title}» в ${clockOf(next.start).time}`
                  : last
                    ? `Последний был «${last.e.title}», закончился в ${clockOf(last.end).time}`
                    : 'В этот день вечеров нет.'}
              </span>
              {(next || last) && (
                <button onClick={() => setChosen(next ? next.start + 20 : last.start + 20)}>
                  {next ? 'к нему' : 'вернуться к нему'}
                </button>
              )}
            </div>
          )}

          <DayStrip
            day={day}
            events={mapEvents}
            onPick={(d) => setChosen(d * 1440 + (chosen % 1440))}
          />

          <TimeRail
            from={START}
            to={END}
            chosen={chosen}
            now={NOW}
            events={mapEvents}
            onChange={setChosen}
            onEvent={(id) => {
              setPicked(id);
              setOpen(false);
            }}
          />
        </div>
      </div>

      {sheet && (
        <>
          <button className="scrim" onClick={() => setSheet(false)} aria-label="Закрыть" />
          <div className="sheet">
            <div className="grab" />
            <div className="st">Ссылка и QR</div>
            <div className="qrw">
              <img src={asset('/img/qr.png')} width={168} height={168} alt="QR вечера" />
            </div>
            <div className="lnk">event.photos/s/{current.id}</div>
            <div className="row2">
              <button className="primary" onClick={() => copy(`https://event.photos/s/${current.id}`)}>
                {copied ? 'Скопировано ✓' : 'Скопировать'}
              </button>
              <a className="ghost2" href={asset('/img/qr.png')} download="vecher-qr.png">
                Скачать QR
              </a>
            </div>
            <div className="hint3">
              QR печатают на карточках и ставят на столах.
              <br />
              Работает до 11 октября.
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
