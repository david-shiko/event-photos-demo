'use client';

import Link from 'next/link';
import { useState } from 'react';
import Shell from './Shell';
import { asset, frames, mapEvents, event, sources } from '@/lib/data';

type Filter = 'all' | 'near' | 'photo' | 'video';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Сегодня' },
  { id: 'near', label: 'Рядом' },
  { id: 'photo', label: 'С кадрами' },
  { id: 'video', label: 'С видео' },
];

const VIDEO = ['vinzavod', 'kassety'];

export default function MapView() {
  const [filter, setFilter] = useState<Filter>('all');
  const [picked, setPicked] = useState(event.id);
  const [sheet, setSheet] = useState(false);
  const [asked, setAsked] = useState(false);

  const visible = mapEvents.filter((e) => {
    if (filter === 'near') return e.y > 40;
    if (filter === 'photo') return e.frames > 0;
    if (filter === 'video') return VIDEO.includes(e.id);
    return true;
  });

  const current = mapEvents.find((e) => e.id === picked) ?? mapEvents[0];

  return (
    <Shell
      active="Карта"
      title="Карта"
      caption="Вход с улицы: что было в этот вечер и где. Точка — вечер, внутри пина число кадров. Нажал пин — карточка и кнопка на страницу вечера."
      note={
        <>
          <b>Что проверить.</b> Понятно ли, что происходит в вечере, и хочется ли нажать
          «Открыть вечер»? Не мешает ли карта, если ссылка уже есть?
        </>
      }
    >
      <div className="mapwrap">
        <div className="mapimg" style={{ backgroundImage: `url(${asset('/img/map-ru.jpg')})` }} />

        <div className="maphead">
          <div className="mpills">
            <span className="city">◷ {`${event.city} · 11 июля`}</span>
            <span className="me">◎</span>
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

        {visible.map((e) => (
          <button
            key={e.id}
            className={`pin ${e.id === picked ? 'on' : ''} ${e.locked ? 'lock' : ''}`}
            style={{ left: `${e.x}%`, top: `${e.y}%` }}
            onClick={() => {
              setPicked(e.id);
              setAsked(false);
            }}
          >
            <span
              className="p"
              style={e.locked ? undefined : { backgroundImage: `url(${e.img})` }}
            >
              {e.locked ? '⌂' : ''}
            </span>
            <span className="stem" />
            {e.frames > 0 && <b>{e.frames}</b>}
            {e.id === picked && <span className="nm">{e.title}</span>}
          </button>
        ))}

        <div className="msheet">
          <div className="grab" />
          <div className="row">
            <div className="cv" style={{ backgroundImage: `url(${current.img})` }} />
            <div className="meta">
              <div className="t">{current.title}</div>
              <div className="l">
                {current.venue} · {current.when}
              </div>
              <div className="s">
                {current.locked ? (
                  <>⌂ кадры откроет организатор</>
                ) : (
                  <>
                    <span className="dot-ok" />
                    {frames(current.frames)} · {sources(current.sources)}
                  </>
                )}
              </div>
            </div>
          </div>

          {!current.locked && (
            <div className="thumbs">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{ backgroundImage: `url(${asset(`/img/p${(i % 8) + 1}.png`)})` }}
                />
              ))}
            </div>
          )}

          <div className="btns">
            {current.locked ? (
              <button className="cta" onClick={() => setAsked(true)}>
                {asked ? 'Запрос отправлен' : 'Просить доступ'}
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
          <div className="hint">
            {current.frames > 0
              ? `${frames(current.frames)} · ссылка живёт 90 дней`
              : 'вечер на карте, кадры закрыты'}
          </div>
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
            <div className="lnk">event.photos/s/7kd2qf9xm</div>
            <div className="row2">
              <button className="primary">Скопировать</button>
              <button className="ghost2">Скачать QR</button>
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
