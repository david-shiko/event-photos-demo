'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import Lightbox from './Lightbox';
import PreEvent from './PreEvent';
import Shell from './Shell';
import Tile from './Tile';
import { asset, eventFor, frames, moments, periodsOf, sources } from '@/lib/data';
import { readUploaded, useCopy } from '@/lib/client';

type Tab = 'all' | 'photo' | 'guest';

export default function EventView({ id }: { id: string }) {
  const event = useMemo(() => eventFor(id), [id]);
  const moment = moments[id];
  const [tab, setTab] = useState<Tab>('all');
  const [period, setPeriod] = useState<string | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [find, setFind] = useState(false);
  /* время гостя появляется только после его загрузки: EXIF знает, когда снят кадр */
  const [wasThere, setWasThere] = useState<string | null>(null);
  const feed = useRef<HTMLDivElement | null>(null);
  const { done: copied, copy } = useCopy();

  useEffect(() => setWasThere(readUploaded(event.id)), [event.id]);

  const list = useMemo(
    () =>
      event.photos.filter(
        (p) =>
          (tab === 'all' || (tab === 'photo' && p.source === 'photo') || (tab === 'guest' && p.source === 'guest')) &&
          (!period || p.period === period),
      ),
    [tab, period, event],
  );

  /* чипс обязан считать кадры выбранной категории: под «фотограф» их 96, а не 168 */
  const chips = useMemo(() => {
    const from = event.periods[0]?.from ?? 0;
    const to = event.periods.at(-1)?.to ?? 0;
    const seen = new Map(periodsOf(event.photos, from, to, tab === 'all' ? undefined : tab).map((p) => [p.id, p.count]));
    return event.periods.map((p) => ({ ...p, count: seen.get(p.id) ?? 0 }));
  }, [event, tab]);

  /* Esc закрывает верхний слой: сначала лайтбокс, потом лист. Иначе с мыши путь назад один — мимо листа. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (open !== null) setOpen(null);
      else if (sheet) setSheet(false);
      else if (find) setFind(false);
      else if (selecting) {
        setSelecting(false);
        setPicked([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, sheet, find, selecting]);

  const toggle = (id: number) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const tap = (id: number) => {
    if (selecting) toggle(id);
    else setOpen(list.findIndex((p) => p.id === id));
  };

  const long = (id: number) => {
    setSelecting(true);
    setPicked((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  /* выбранное скачивается: по файлу на кадр, без сервера */
  const savePicked = () => {
    event.photos
      .filter((p) => picked.includes(p.id))
      .forEach((p, i) => {
        setTimeout(() => {
          const a = document.createElement('a');
          a.href = p.img;
          a.download = `vecher-${event.id}-${p.id + 1}.jpg`;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }, i * 120);
      });
  };

  /* «Найти себя»: лист по времени, потому что время — единственное, что гость помнит точно */
  const around = wasThere
    ? event.periods.find((p) => {
        const [h, m] = wasThere.split(':').map(Number);
        const t = (h % 24) * 60 + m;
        return t >= p.from && t < p.to;
      })
    : undefined;

  const showPeriod = (id: string | null) => {
    setPeriod(id);
    setFind(false);
    requestAnimationFrame(() => {
      const el = feed.current?.querySelector(`[data-period="${id ?? ''}"]`) ?? feed.current;
      el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };

  if (event.state === 'draft') {
    return (
      <Shell
        active="Вечер"
        title="Вечер"
        caption={`${event.title}: кадров ещё нет. Ссылка уже есть, открывать по ней пока нечего.`}
        note={
          <>
            <b>Пустой вечер — это экран, а не сетка-обманка.</b> Гость по такой ссылке видит дату,
            площадку и честное «кадры ещё не залиты»; счётчики из воздуха не рисуются.
          </>
        }
      >
        <PreEvent
          title={event.title}
          venue={event.venue}
          when={`${event.date}, ${event.window}`}
          cover={event.cover}
          kind="draft"
        />
      </Shell>
    );
  }

  const total = list.length;

  return (
    <Shell
      active="Вечер"
      title="Вечер"
      caption={`${frames(event.counts.all)} от ${event.sources} человек — в одном месте, по времени съёмки.`}
      note={
        <>
          <b>Гости принесли {event.counts.guests} кадров.</b> Фотограф не просил ни одного: они
          залили сами по ссылке из чата — и вечер стал полнее, чем снимал он один.
        </>
      }
    >
      <div className="ehead">
        <Link className="rb" href="/" aria-label="На карту">
          ‹
        </Link>
        <span className="sp" />
        <Link className="up" href="/u/">
          <i>↑</i> Загрузить
        </Link>
        <button className="qr" onClick={() => setSheet(true)} aria-label="Ссылка и QR">
          QR
        </button>
      </div>

      <div className="cover">
        <div className="img2" style={{ backgroundImage: `url(${event.cover})` }} />
        <div className="grad" />
        <div className="txt">
          <div className="t">{event.title}</div>
          <div className="l">
            {event.venue} · {event.date}, {event.window}
          </div>
          <div className="c">
            <span className="dot-ok" />
            {frames(event.counts.all)} · {sources(event.sources)} · {event.counts.guests} принесли
            гости
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
          {chips.map((p) => (
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
          {period ? (
            <button className="fake" onClick={() => setPeriod(null)}>
              сбросить фильтр
            </button>
          ) : wasThere ? (
            <button className="find" onClick={() => setFind(true)}>
              Найти себя · вы были в {wasThere}
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="feed"
        ref={feed}
        style={selecting ? { paddingBottom: 66 } : undefined}
      >
        {/* категория над кадрами: она же остаётся на экране, пока листаешь */}
        <div className="flab">
          {tab === 'all' ? 'всё' : tab === 'photo' ? 'фотограф' : 'гости'}
          <b>{frames(total)}</b>
        </div>

        {total === 0 && (
          <div className="fempty">
            <b>Здесь пусто</b>
            <span>
              {chips.some((c) => c.count > 0)
                ? 'В этом периоде нет кадров этой категории. Сбросьте фильтр.'
                : 'Кадров этой категории в вечере нет.'}
            </span>
          </div>
        )}

        {chunks(list).map((group) => (
          <div key={group[0].id} data-period={group[0].period ?? ''}>
            <div
              className={`glab ${
                moment && group[0].time.slice(0, 2) === moment.time.slice(0, 2) ? 'mom' : ''
              }`}
            >
              {group[0].time}
              {moment && group[0].time.slice(0, 2) === moment.time.slice(0, 2) && (
                <span className="mlab">{moment.text}</span>
              )}
            </div>
            {[0, 1].map((row) => {
              const slice = group.slice(row * 3, row * 3 + 3);
              if (slice.length === 0) return null;
              return (
                <div className="row3" key={row}>
                  {slice.map((q) => (
                    <Tile
                      key={q.id}
                      photo={q}
                      picked={picked.includes(q.id)}
                      onTap={tap}
                      onLong={long}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {selecting && (
        <div className="selbar">
          <span className="n">{picked.length > 0 ? `${picked.length} выбрано` : 'держите кадр'}</span>
          <button
            className="ghost2"
            onClick={() => {
              setSelecting(false);
              setPicked([]);
            }}
          >
            Готово
          </button>
          <button className="primary" disabled={picked.length === 0} onClick={savePicked}>
            Скачать {picked.length || ''}
          </button>
        </div>
      )}

      {open !== null && (
        <Lightbox photos={list} start={open} onClose={() => setOpen(null)} />
      )}

      {find && wasThere && (
        <>
          <button className="scrim" onClick={() => setFind(false)} aria-label="Закрыть" />
          <div className="sheet">
            <div className="grab" />
            <div className="st">Найти себя</div>
            <div className="hint3 left">
              Гость помнит время, а не номер кадра. Выберите, когда вы были на вечере, — лента
              откроется на этих часах.
            </div>
            <div className="chips">
              {chips.map((p) => (
                <button
                  key={p.id}
                  className={`chip2 ${period === p.id ? 'on' : ''}`}
                  onClick={() => showPeriod(p.id)}
                >
                  {p.label}
                  <b>{p.count}</b>
                </button>
              ))}
            </div>
            <div className="row2">
              <button className="primary" onClick={() => showPeriod(around?.id ?? event.periods[0]?.id ?? null)}>
                Кадры вокруг {wasThere}
              </button>
              <button className="ghost2" onClick={() => showPeriod(null)}>
                Весь вечер
              </button>
            </div>
            <div className="hint3">
              Были в {wasThere} — это отрезок {around?.label ?? event.window}.
            </div>
          </div>
        </>
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
              Ссылка живёт 90 дней с даты съёмки.
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}

function chunks<T>(items: T[], size = 6): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
