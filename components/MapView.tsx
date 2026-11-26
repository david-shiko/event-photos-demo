'use client';

import Link from 'next/link';
import { useState } from 'react';
import Shell from './Shell';
import LiveMap from './LiveMap';
import { asset, frames, mapEvents, sources } from '@/lib/data';
import { useCopy } from '@/lib/client';

type Filter = 'all' | 'near' | 'live' | 'video';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Сегодня' },
  { id: 'near', label: 'Рядом' },
  { id: 'live', label: 'С кадрами' },
  { id: 'video', label: 'С видео' },
];

const VIDEO = ['vinzavod', 'kassety'];
const CENTER = { lat: 55.7522, lng: 37.6300 };

export default function MapView() {
  const [filter, setFilter] = useState<Filter>('all');
  const [picked, setPicked] = useState('7kd2qf9xm');
  const [sheet, setSheet] = useState(false);
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(false);
  const { done: copied, copy } = useCopy();

  const visible = mapEvents.filter((e) => {
    if (filter === 'near') {
      const d = Math.hypot(e.lat - CENTER.lat, e.lng - CENTER.lng);
      return d < 0.045;
    }
    if (filter === 'live') return e.frames > 0;
    if (filter === 'video') return VIDEO.includes(e.id);
    return true;
  });

  const current = mapEvents.find((e) => e.id === picked) ?? mapEvents[0];
  const total = mapEvents.reduce((s, e) => s + e.frames, 0);

  return (
    <Shell
      active="Карта"
      title="Карта"
      caption="Ссылку кидают в чат и через месяц не находят. Карта — единственное место, где вечера остаются и находятся."
      note={
        <>
          <b>{total} кадров с {mapEvents.length} вечеров</b> в одну ночь, и это только Москва. То,
          что было вчера в баре на Солянке, видно сегодня. Ссылкой такого не получить.
        </>
      }
    >
      <div className="mapwrap">
        <LiveMap
          events={visible}
          activeId={picked}
          onPick={(id) => {
            setPicked(id);
            setOpen(false);
          }}
        />

        <div className="maphead">
          <div className="mpills">
            <span className="city">◷ Москва · 11 июля</span>
            <span className="me">◎</span>
          </div>
          <div className="mlive">
            <span className="dot-ok" />
            сейчас снимают <b>12</b> человек · {mapEvents.length} вечеров
          </div>
          <div className="mchips">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={`mchip ${filter === f.id ? 'on' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`msheet ${open ? 'open' : ''}`}>
          <button className="grab" onClick={() => setOpen(!open)} aria-label="Развернуть карточку" />
          <div className="row" onClick={() => setOpen(!open)}>
            <div className="cv" style={{ backgroundImage: `url(${current.img})` }} />
            <div className="meta">
              <div className="t">{current.title}</div>
              <div className="l">
                {current.venue} · {current.when}
              </div>
              <div className="s">
                {current.locked ? (
                  <>⌂ кадры откроет организатор</>
                ) : current.soon ? (
                  <>◷ вечер начнётся в 20:00</>
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

          {open && !current.locked && !current.soon && (
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
            {current.locked ? (
              <button className="cta" onClick={() => setAsked(true)}>
                {asked ? 'Запрос отправлен' : 'Просить доступ'}
              </button>
            ) : current.soon ? (
              <button className="cta off">Откроется в 20:00</button>
            ) : (
              <Link className="cta" href={`/e/${current.id}/`}>
                Открыть вечер
              </Link>
            )}
            {!current.soon && (
              <button className="ghost" onClick={() => setSheet(true)}>
                Ссылка
              </button>
            )}
          </div>
          )}
          {open && (
          <div className="hint">
            {current.soon
              ? 'точка появилась заранее — гости уже знают, где искать кадры'
              : current.locked
                ? 'вечер на карте, кадры закрыты'
                : `${frames(current.frames)} · ссылка живёт 90 дней`}
          </div>
          )}
          {!open && (
            <div className="peek">
              {current.soon ? 'вечер начнётся в 20:00' : current.locked ? 'кадры закрыты' : 'нажмите, чтобы открыть вечер'}
            </div>
          )}
          <div className="mcredit">карта © OpenStreetMap, © OpenFreeMap</div>
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
              <button
                className="primary"
                onClick={() => copy(`https://event.photos/s/${current.id}`)}
              >
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
