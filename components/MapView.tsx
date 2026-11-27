'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from './Shell';
import LiveMap, { type Blank } from './LiveMap';
import Sheet from './Sheet';
import DayStrip from './DayStrip';
import TimeRail from './TimeRail';
import { asset, clockOf, DAYS, eventSpan, frames, mapEvents, plural, sources, type MapEvent } from '@/lib/data';
import { readCreated, type Created } from '@/lib/client';

const NOW = 1440 + 21 * 60 + 40; // 11 июля, 21:40 — «сейчас» в демо
const START = 0; // 10 июля, 00:00
const END = 7 * 1440; // 17 июля, 00:00
const DIM = 30; // минут до начала, когда пин бледнеет
const TAIL = 30; // минут после конца, когда пин ещё виден

const onMap = mapEvents.filter((e) => !e.hidden);

/* метры между точками: «рядом с этим вечером» — не «в этом вечере» */
const meters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const dx = (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  const dy = (a.lat - b.lat) * 110_540;
  return Math.round(Math.hypot(dx, dy));
};

export default function MapView() {
  const router = useRouter();
  const [chosen, setChosen] = useState(NOW);
  const [picked, setPicked] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [cluster, setCluster] = useState<MapEvent[] | null>(null);
  /* точка, где держали палец: вечер встанет ровно сюда, а не в чужой */
  const [blank, setBlank] = useState<Blank | null>(null);
  const [created, setCreated] = useState<Created[]>([]);

  useEffect(() => setCreated(readCreated()), []);

  const all = useMemo<MapEvent[]>(
    () => [
      ...onMap,
      ...created
        .filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number')
        .filter((c) => !onMap.some((e) => e.id === c.id))
        .map((c) => ({
          id: c.id,
          title: c.title,
          venue: c.venue,
          when: `${c.when.split(', ')[0]}, ${c.window ?? '19:00–02:00'}`,
          frames: 0,
          sources: 0,
          img: asset(c.cover ?? '/img/p4.jpg'),
          lat: c.lat as number,
          lng: c.lng as number,
          soon: true,
          href: `/e/demo/?id=${c.id}`,
        })),
    ],
    [created],
  );

  const clock = clockOf(chosen);
  const day = Math.max(0, Math.min(6, clock.day));
  const dayEvents = all.filter((e) => e.when.split(', ')[0] === DAYS[day].label);

  const spans = all.map((e) => ({ e, ...eventSpan(e) }));
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

  const ready = dayEvents.filter((e) => e.frames > 0);
  const people = dayEvents.reduce((s, e) => s + e.sources, 0);

  /* приход по ссылке: ?pin=<id> — карта подъезжает, время встаёт на вечер, пин раскрыт */
  const pinned = useRef(false);
  useEffect(() => {
    if (pinned.current) return;
    const id = new URLSearchParams(window.location.search).get('pin');
    if (!id) return;
    const ev = all.find((e) => e.id === id);
    if (!ev) return;
    pinned.current = true;
    setPicked(ev.id);
    setOpen(true);
    setChosen(eventSpan(ev).start + 20);
  }, [all]);

  const pickPin = (id: string) => {
    setPicked(id);
    setOpen(true);
    setCluster(null);
    setBlank(null);
  };

  /* рядом — только чтобы написать «зал тот же, вечер ваш»: сам вечер встаёт в точку пальца */
  const near = blank
    ? all
        .map((e) => ({ e, d: meters(blank, e) }))
        .sort((a, b) => a.d - b.d)[0] ?? null
    : null;

  const createHere = () => {
    if (!blank) return;
    const q = new URLSearchParams({
      at: `${blank.lat.toFixed(5)},${blank.lng.toFixed(5)}`,
      near: near && near.d < 400 ? near.e.venue : '',
      day: DAYS[day].label,
    });
    router.push(`/new/?${q.toString()}`);
  };

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
          activeId={open ? picked : null}
          open={open}
          blank={blank}
          onPick={pickPin}
          onCollapse={() => setOpen(false)}
          onCluster={(items) => setCluster(items)}
          onBlank={(p) => {
            setOpen(false);
            setCluster(null);
            setBlank(p);
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
          {shown.length === 0 && (
            <div className="mempty">
              <b>{clock.time} — пока пусто</b>
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
            events={all}
            onPick={(d) => setChosen(d * 1440 + (chosen % 1440))}
          />

          <TimeRail
            from={START}
            to={END}
            chosen={chosen}
            now={NOW}
            events={all}
            onChange={setChosen}
            onEvent={pickPin}
          />
        </div>
      </div>

      {blank && (
        <Sheet onClose={() => setBlank(null)} closeLabel="Отмена">
          <div className="st">Новый вечер здесь</div>
          <div className="hint3 left">
            {near && near.d < 400
              ? `Зал тот же — «${near.e.venue}», ${near.d} м. Но вечер будет ваш: чужие кадры сюда не попадут.`
              : 'Вокруг никого. Вечер встанет ровно в эту точку и появится на карте со своей афишей.'}
          </div>
          <button className="primary solo" onClick={createHere}>
            Создать вечер здесь
          </button>
          <div className="hint3">Дальше — название, дата и 690 ₽. Ссылка и QR появятся сразу после оплаты.</div>
        </Sheet>
      )}

      {cluster && (
        <Sheet onClose={() => setCluster(null)} className="clist">
          <div className="st">
            {cluster[0].venue} · {cluster.length} {plural(cluster.length, 'вечер', 'вечера', 'вечеров')}
          </div>
          {cluster.slice(0, 15).map((e) => (
            <button key={e.id} className="srow" onClick={() => pickPin(e.id)}>
              <span className="cv" style={{ backgroundImage: `url(${e.img})` }} />
              <span className="m">
                <b>{e.title}</b>
                <i>
                  {e.when.split(', ')[1]} · {e.frames > 0 ? frames(e.frames) : 'кадров пока нет'}
                </i>
              </span>
              <span className="ch">›</span>
            </button>
          ))}
        </Sheet>
      )}

    </Shell>
  );
}
