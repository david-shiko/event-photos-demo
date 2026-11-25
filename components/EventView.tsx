'use client';

import { useMemo, useState } from 'react';
import Lightbox from './Lightbox';
import Shell from './Shell';
import { asset, eventFor, frames, sources, type Photo } from '@/lib/data';
import { useCopy } from '@/lib/client';

type Tab = 'all' | 'photo' | 'guest';

export default function EventView({ id }: { id: string }) {
  const event = useMemo(() => eventFor(id), [id]);
  const [tab, setTab] = useState<Tab>('all');
  const [period, setPeriod] = useState<string | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const { done: copied, copy } = useCopy();

  const list = useMemo(
    () =>
      event.photos.filter(
        (p) =>
          (tab === 'all' || (tab === 'photo' && p.source === 'photo') || (tab === 'guest' && p.source === 'guest')) &&
          (!period || p.period === period),
      ),
    [tab, period, event],
  );

  const toggle = (id: number) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const tap = (id: number) => {
    if (selecting) toggle(id);
    else setOpen(list.findIndex((p) => p.id === id));
  };

  return (
    <Shell
      active="Вечер"
      title="Вечер"
      caption="Страница, куда ведёт ссылка из чата: обложка, вкладки фотограф и гости, периоды вечера с числом кадров, сетка по времени. Тап — кадр целиком, «Выбрать» — пачка и скачивание."
      note={
        <>
          <b>Что проверить.</b> Хочется ли отдать такую ссылку гостям? Видно ли, что кадры
          разные, а не один фотограф? Понятно ли, где ваши кадры?
        </>
      }
    >
      <div className="cover">
        <div className="img2" style={{ backgroundImage: `url(${event.cover})` }} />
        <div className="grad" />
        <div className="bar2">
          <span className="rb">‹</span>
          <span className="rb">⋯</span>
        </div>
        <div className="txt">
          <div className="t">{event.title}</div>
          <div className="l">
            {event.venue} · {event.date}, {event.window}
          </div>
          <div className="c">
            <span className="dot-ok" />
            {frames(event.counts.all)} · {sources(event.sources)} · фото готовы
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'all' ? 'on' : ''}`} onClick={() => setTab('all')}>
          всё <b>{event.counts.all}</b>
        </button>
        <button className={`tab ${tab === 'photo' ? 'on' : ''}`} onClick={() => setTab('photo')}>
          фотограф <b>{event.counts.photographer}</b>
        </button>
        <button className={`tab ${tab === 'guest' ? 'on' : ''}`} onClick={() => setTab('guest')}>
          гости <b>{event.counts.guests}</b>
        </button>
      </div>

      <div className="strip">
        <div className="chips">
          {event.periods.map((p) => (
            <button
              key={p.id}
              className={`chip2 ${period === p.id ? 'on' : ''}`}
              onClick={() => setPeriod(period === p.id ? null : p.id)}
            >
              {p.label}
              <b>{p.count}</b>
            </button>
          ))}
        </div>
        <div className="hint2">
          <span>весь вечер {event.window}</span>
          <button className="fake" onClick={() => setPeriod(period ? null : 'b')}>
            вы были в {event.wasThere} · сбросить
          </button>
        </div>
      </div>

      <div className="feed">
        {chunks(list).map((group) => (
          <div key={group[0].id}>
            <div className="glab">{group[0].time}</div>
            {[0, 1].map((row) => {
              const slice = group.slice(row * 3, row * 3 + 3);
              if (slice.length === 0) return null;
              return (
                <div className="row3" key={row}>
                  {slice.map((q) => (
                    <Thumb key={q.id} photo={q} picked={picked.includes(q.id)} onTap={tap} />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="foot">
        <button className="ghost2" onClick={() => setSheet(true)}>
          Ссылка
        </button>
        <button
          className="ghost2"
          onClick={() => {
            setSelecting(!selecting);
            setPicked([]);
          }}
        >
          {selecting ? 'Готово' : 'Выбрать'}
        </button>
        <span className="cnt">{picked.length > 0 ? `${picked.length} выбрано` : event.window}</span>
        <button className="dl" onClick={() => setOpen(0)} aria-label="Кадр">
          ↓
        </button>
      </div>

      {open !== null && (
        <Lightbox photos={list} start={open} onClose={() => setOpen(null)} />
      )}

      {sheet && (
        <>
          <button className="scrim" onClick={() => setSheet(false)} aria-label="Закрыть" />
          <div className="sheet">
            <div className="grab" />
            <div className="st">Ссылка и QR</div>
            <div className="qrw">
              <img src={asset('/img/qr.png')} width={168} height={168} alt="QR вечера" />
            </div>
            <div className="lnk">event.photos/s/{event.id}</div>
            <div className="row2">
              <button className="primary" onClick={() => copy(`https://event.photos/s/${event.id}`)}>
                {copied ? 'Скопировано ✓' : 'Скопировать'}
              </button>
              <a className="ghost2" href={asset('/img/qr.png')} download="vecher-qr.png">
                Скачать QR
              </a>
            </div>
            <div className="hint3">
              Гости открывают без регистрации и приложения.
              <br />
              Ссылка работает до 9 октября.
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}

function Thumb({
  photo,
  picked,
  onTap,
}: {
  photo: Photo;
  picked: boolean;
  onTap: (id: number) => void;
}) {
  return (
    <button className={`th ${picked ? 'picked' : ''}`} onClick={() => onTap(photo.id)}>
      <span className="im" style={{ backgroundImage: `url(${photo.img})`, backgroundPosition: photo.pos }} />
      {photo.source === 'guest' && <span className="g">гость</span>}
      {photo.likes > 40 && <span className="lk">♥ {photo.likes}</span>}
      {picked && <span className="sel">✓</span>}
    </button>
  );
}

function chunks<T>(items: T[], size = 6): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
