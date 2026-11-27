'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import Link from 'next/link';
import Supercluster from 'supercluster';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { asset, plural, type MapEvent } from '@/lib/data';

export type Blank = { lat: number; lng: number };

type Props = {
  events: MapEvent[];
  dim?: string[];
  activeId: string | null;
  open: boolean;
  /** точка, где держали палец: на ней же встанет новый вечер */
  blank: Blank | null;
  onPick: (id: string) => void;
  onCollapse: () => void;
  onCluster: (items: MapEvent[]) => void;
  onBlank: (point: Blank) => void;
};

const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const CENTER: [number, number] = [37.628, 55.7505];
/* два и больше вечера в одном пятне — стопка (design.md §3.5).
   Одиночный пин из кластера прятал соседей: их не было видно и некуда нажать. */
const STACK_MIN = 2;
/* держим 600 мс: короче — срабатывает при панораме, длиннее — палец устаёт */
const HOLD = 600;
/* кольцо появляется через 160 мс: на короткий тап его не видно вовсе */
const SHOW_RING = 160;
const SLOP = 10;
/* пин растёт с зумом: на общем плане города он 48, на близком — 78.
   Верхняя граница — «в два раза крупнее прежних 38» (design.md §3.3). */
const PIN = (zoom: number) =>
  2 * Math.round(Math.max(48, Math.min(78, 48 + (zoom - 11) * 7.2)) / 2);
/* под пальцем кнопка, пин или карточка — это уже не «пустое место» */
const BUSY = 'a, button, .maplibregl-ctrl, .maplibregl-marker';
/* название под пином режем по символам: длинный заголовок расползается по карте */
const MAP_NAME = 40;
const mapName = (s: string) => (s.length > MAP_NAME ? `${s.slice(0, MAP_NAME - 1).trimEnd()}…` : s);

type Group = { items: MapEvent[]; lat: number; lng: number };

const overlap = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const spread = (items: MapEvent[]): Group => ({
  items,
  lat: items.reduce((s, e) => s + e.lat, 0) / items.length,
  lng: items.reduce((s, e) => s + e.lng, 0) / items.length,
});

export default function LiveMap({
  events,
  dim = [],
  activeId,
  open,
  blank,
  onPick,
  onCollapse,
  onCluster,
  onBlank,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<import('maplibre-gl').Map | null>(null);
  const lib = useRef<typeof import('maplibre-gl') | null>(null);
  const pins = useRef<Map<string, import('maplibre-gl').Marker>>(new Map());
  const groups = useRef<Group[]>([]);
  const [loaded, setLoaded] = useState(false);
  /* карточка живёт в маркере карты, поэтому её положение задаёт не React, а сама карта */
  const [cardHost, setCardHost] = useState<HTMLDivElement | null>(null);
  const [below, setBelow] = useState(false);
  const cardMark = useRef<import('maplibre-gl').Marker | null>(null);
  /* кольцо под пальцем, пока идёт удержание */
  const [press, setPress] = useState<{ x: number; y: number } | null>(null);
  const [ring, setRing] = useState<{ x: number; y: number } | null>(null);
  const pick = useRef(onPick);
  const cluster = useRef(onCluster);
  const blankFn = useRef(onBlank);
  const collapse = useRef(onCollapse);
  const ready = useRef(false);
  const initial = useRef(events);
  const observer = useRef<ResizeObserver | null>(null);
  const startZoom = useRef(13);
  /* выбранный вечер читаем из ref: подписи расставляются без пересборки пинов */
  const activeRef = useRef<string | null>(activeId);
  activeRef.current = activeId;
  pick.current = onPick;
  cluster.current = onCluster;
  blankFn.current = onBlank;
  collapse.current = onCollapse;

  /* подпись под пином не должна наезжать на соседние пины и на другие подписи.
     Коллизии MapLibre считает только для symbol-слоёв, а пины здесь — DOM-маркеры,
     поэтому расставляем жадно по экранным прямоугольникам: первый занял, второй уступил. */
  const placeNames = () => {
    const marks = [...pins.current.values()].map((mk) => mk.getElement());
    if (!marks.length) return;
    const view = box.current?.getBoundingClientRect();
    const sel = activeRef.current;
    const circles = new Map(marks.map((el) => [el, el.getBoundingClientRect()]));
    const taken: DOMRect[] = [];
    for (const el of marks) {
      if (el.classList.contains('lstack')) continue;
      const chip = el.querySelector<HTMLElement>('.nm');
      if (!chip) continue;
      /* открытая карточка называет вечер сама: подпись под пином уступает ей место */
      if (sel && el.dataset.ids?.split('+').includes(sel)) {
        chip.classList.add('nm-off');
        continue;
      }
      chip.classList.remove('nm-off');
      const r = chip.getBoundingClientRect();
      /* обрезанная краем экрана подпись читается как мусор — лучше не показывать */
      const cut = !!view && (r.left < view.left + 2 || r.right > view.right - 2);
      const clash = taken.some((t) => overlap(r, t)) || marks.some((o) => o !== el && overlap(r, circles.get(o)!));
      if (clash || cut) chip.classList.add('nm-off');
      else taken.push(r);
    }
  };

  useEffect(() => {
    let dead = false;

    (async () => {
      const maplibregl = await import('maplibre-gl');
      if (dead || !box.current) return;

      maplibregl.setWorkerUrl(asset('/maplibre-gl-worker.mjs'));

      const m = new maplibregl.Map({
        container: box.current,
        style: STYLE,
        center: CENTER,
        zoom: 12.6,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
      map.current = m;
      lib.current = maplibregl;
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

      /* нажатие по пустому месту закрывает карточку — обычное поведение карты.
         Клик по пину или карточке приходит сюда же через контейнер: его не трогаем. */
      m.on('click', (e) => {
        const t = e.originalEvent?.target;
        if (t instanceof Element && t.closest('.maplibregl-marker')) return;
        collapse.current();
      });

      const ro = new ResizeObserver(() => m.resize());
      ro.observe(box.current);
      observer.current = ro;

      m.on('load', () => {
        ready.current = true;
        setLoaded(true);

        m.setPadding({ top: 124, bottom: 208, left: 14, right: 14 });

        m.getStyle()?.layers?.forEach((l) => {
          if (l.type !== 'symbol') return;
          const field = (l.layout as Record<string, unknown> | undefined)?.['text-field'];
          if (!field) return;
          try {
            m.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:ru'], ['get', 'name']]);
          } catch {
            /* слой не поддерживает — оставляем как есть */
          }
        });

        const pts = initial.current.map((e) => [e.lng, e.lat] as [number, number]);
        if (pts.length > 1) {
          const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
          pts.slice(1).forEach((pt) => b.extend(pt));
          /* охват считаем по размеру полотна: fitBounds до первого resize врёт */
          const cam = m.cameraForBounds(b, { padding: 0 });
          if (cam?.center) {
            /* пины крупные: на общем плане города они слипаются, поэтому стартуем ближе */
            startZoom.current = Math.min((cam.zoom ?? 13) + 0.85, 13.4);
            m.jumpTo({ center: cam.center, zoom: startZoom.current });
          }
        }

        m.resize();
        window.dispatchEvent(new Event('lmap-ready'));
      });

    })();

    return () => {
      dead = true;
      observer.current?.disconnect();
      ready.current = false;
      pins.current.clear();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  /* пины: одна группа — один маркер. Пять и больше в пятне — стопка со счётчиком. */
  useEffect(() => {
    let dead = false;

    const sync = async () => {
      const maplibregl = await import('maplibre-gl');
      const m = map.current;
      if (dead || !m || !ready.current) return;

      /* один адрес — одна группа */
      const byVenue = new Map<string, MapEvent[]>();
      for (const e of events) {
        const key = e.venue;
        const bucket = byVenue.get(key);
        if (bucket) bucket.push(e);
        else byVenue.set(key, [e]);
      }
      const merged = [...byVenue.values()].map(spread);

      /* группировку считает supercluster — тот движок, что MapLibre держит внутри.
         Свой обход пикселей умел залипать: стопка не раскрывалась при зуме. */
      /* радиус стопки чуть больше пина: соседи не перекрывают друг друга, а кучкуются */
      const index = new Supercluster<{ ids: string[] }, { ids: string[] }>({
        radius: Math.max(34, PIN(m.getZoom()) / 2 + 14),
        maxZoom: 15,
        /* копия обязательна: reduce мутирует аккумулятор, а он же — массив точки */
        map: (p) => ({ ids: [...p.ids] }),
        reduce: (acc, p) => {
          acc.ids = acc.ids.concat(p.ids);
        },
      });
      index.load(
        merged.map((g) => ({
          type: 'Feature' as const,
          properties: { ids: g.items.map((i) => i.id) },
          geometry: { type: 'Point' as const, coordinates: [g.lng, g.lat] },
        })),
      );

      /* зум наружу: по нему меряют размер пина и отлаживают кластеры */
      if (box.current) box.current.dataset.zoom = m.getZoom().toFixed(2);

      const byId = new Map(events.map((e) => [e.id, e]));
      const shown = index.getClusters([-180, -85, 180, 85], Math.round(m.getZoom()));
      const next: Group[] = shown.map((f) => {
        const ids = f.properties.ids ?? [];
        const items = ids.map((id) => byId.get(id)).filter((e): e is MapEvent => !!e);
        const [lng, lat] = f.geometry.coordinates;
        return { items, lng, lat };
      });
      groups.current = next;

      const keys = new Set(next.map((g) => g.items.map((i) => i.id).sort().join('+')));
      pins.current.forEach((marker, key) => {
        if (!keys.has(key)) {
          marker.remove();
          pins.current.delete(key);
        }
      });

      next.forEach((g) => {
        const key = g.items.map((i) => i.id).sort().join('+');
        const stack = g.items.length >= STACK_MIN;
        const lead = g.items[0];
        let marker = pins.current.get(key);
        if (!marker) {
          const el = document.createElement('button');
          el.type = 'button';
          /* какие вечера в этой метке: по ним включается выделение без пересборки */
          el.dataset.ids = key;
          el.className = stack ? 'lstack' : `lpin ${lead.soon ? 'soon' : ''} ${lead.locked ? 'lock' : ''}`;
          if (stack) {
            const venues = new Set(g.items.map((i) => i.venue));
            const label = venues.size > 1 ? 'Москва' : lead.venue;
            el.dataset.venue = lead.venue;
            el.innerHTML = `<b>${g.items.length}</b><span class="nm">${mapName(label)}</span>`;
            el.addEventListener('click', () => cluster.current(g.items));
          } else {
            const time = lead.when.split(', ')[1]?.split('–')[0] ?? '';
            el.innerHTML =
              `<span class="pc" ${lead.locked ? '' : `style="background-image:url('${lead.img}')"`}>` +
              `${lead.locked ? '⌂' : ''}</span>` +
              (lead.frames > 0 ? `<b>${lead.frames}</b>` : lead.soon ? `<b class="t">${time}</b>` : '') +
              `<span class="nm">${mapName(lead.title)}</span>`;
            el.addEventListener('click', () => pick.current(lead.id));
          }
          marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([g.lng, g.lat]).addTo(m);
          pins.current.set(key, marker);
        }
        const el = marker.getElement();
        el.style.setProperty('--pin', `${PIN(m.getZoom())}px`);
        el.classList.toggle('dim', g.items.every((i) => dim.includes(i.id)));
      });

      placeNames();
    };

    sync();
    /* плотность стопок зависит от зума: без пересчёта стопка не раскрывается.
       Карта создаётся в другом эффекте, поэтому вешаем обработчик и сразу,
       и по её готовности — сработает первый. */
    const onZoom = () => sync();
    let hooked = false;
    const attach = () => {
      const mm = map.current;
      if (!mm || hooked) return;
      mm.on('zoomend', onZoom);
      /* подписи переезжают вместе с пинами: край экрана и соседи меняются и при панораме */
      mm.on('moveend', placeNames);
      hooked = true;
    };
    const onReady = () => {
      attach();
      sync();
    };
    attach();
    window.addEventListener('lmap-ready', onReady);
    return () => {
      dead = true;
      window.removeEventListener('lmap-ready', onReady);
      if (hooked) {
        map.current?.off('zoomend', onZoom);
        map.current?.off('moveend', placeNames);
      }
    };
  }, [events, dim]);


  /* выбранный пин: только класс на уже нарисованных маркерах.
     Пересобирать стопки из-за одного выделения незачем — это и был лишний ререндер. */
  useEffect(() => {
    pins.current.forEach((marker) => {
      const el = marker.getElement();
      const on = activeId ? el.dataset.ids?.split('+').includes(activeId) : false;
      el.classList.toggle('on', !!on);
    });
    placeNames();
  }, [activeId, open, events]);

  /* карточка — маркер карты: её двигает та же трансформация, что и пин,
     иначе она отстаёт от пина на кадр и «плывёт» при панораме.
     Сторону (над пином или под ним) пересчитываем только в конце жеста. */
  useEffect(() => {
    const m = map.current;
    const L = lib.current;
    if (!m || !L) return;
    const e = open ? events.find((x) => x.id === activeId) : null;

    if (!e) {
      cardMark.current?.remove();
      cardMark.current = null;
      return;
    }

    if (!cardMark.current) {
      const host = document.createElement('div');
      host.className = 'pincard-host';
      cardMark.current = new L.Marker({ element: host, anchor: 'center' })
        .setLngLat([e.lng, e.lat])
        .addTo(m);
      setCardHost(host);
    }
    const mark = cardMark.current;
    mark.setLngLat([e.lng, e.lat]);
    const host = mark.getElement();
    /* карточка шире пина: у края экрана её сдвигаем внутрь, а хвостик оставляем на пине */
    const shift = () => {
      const w = m.getCanvas().clientWidth;
      const half = 126 + 12;
      const p = m.project([e.lng, e.lat]);
      const x = Math.min(Math.max(p.x, half), w - half);
      host.style.setProperty('--shift', `${Math.round(x - p.x)}px`);
    };

    const place = () => {
      const r = PIN(m.getZoom()) / 2 + 8;
      const p = m.project([e.lng, e.lat]);
      /* у верхнего края места над пином нет — карточка идёт под него */
      const down = p.y < 210;
      mark.setOffset([0, down ? r : -r]);
      setBelow(down);
      shift();
    };

    let raf = 0;
    const onMove = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(shift);
    };

    place();
    m.on('move', onMove);
    m.on('moveend', place);
    m.on('zoomend', place);
    m.on('resize', place);
    return () => {
      cancelAnimationFrame(raf);
      m.off('move', onMove);
      m.off('moveend', place);
      m.off('zoomend', place);
      m.off('resize', place);
    };
  }, [activeId, open, events]);

  /* точка создания держится за картой сама: кольцо — обычный DOM, его надо двигать */
  useEffect(() => {
    const m = map.current;
    if (!m || !blank) {
      setRing(null);
      return;
    }
    let id = 0;
    const show = () => {
      cancelAnimationFrame(id);
      id = requestAnimationFrame(() => {
        const p = m.project([blank.lng, blank.lat]);
        setRing({ x: p.x, y: p.y });
      });
    };
    show();
    m.on('move', show);
    m.on('zoom', show);
    m.on('resize', show);
    return () => {
      cancelAnimationFrame(id);
      m.off('move', show);
      m.off('zoom', show);
      m.off('resize', show);
    };
  }, [blank, loaded]);

  /* выбранный вечер — в центр, если уехал за край.
     Отступ по бокам больше половины карточки: она шире пина и иначе липнет к краю. */
  useEffect(() => {
    const e = events.find((x) => x.id === activeId);
    const m = map.current;
    if (!m || !e || !ready.current) return;
    const p = m.project([e.lng, e.lat]);
    const pad = 100;
    const out = p.x < pad || p.y < 120 || p.x > m.getCanvas().clientWidth - pad || p.y > 420;
    if (out) m.easeTo({ center: [e.lng, e.lat], duration: 450 });
  }, [activeId, events]);

  /* длинное нажатие на пустую карту: новый вечер встаёт ровно в эту точку.
     Жест уступает панораме, пинчу и любому элементу под пальцем. */
  useEffect(() => {
    const m = map.current;
    const el = box.current;
    if (!m || !el || !loaded) return;

    let timer = 0;
    let ringTimer = 0;
    let from: { id: number; x: number; y: number } | null = null;
    let fired = 0;
    /* пальцы на экране: второй — это уже пинч, удержание уступает */
    const fingers = new Set<number>();

    const stop = () => {
      if (timer) window.clearTimeout(timer);
      if (ringTimer) window.clearTimeout(ringTimer);
      timer = 0;
      ringTimer = 0;
      from = null;
      setPress(null);
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      fingers.add(e.pointerId);
      if (fingers.size > 1) {
        stop();
        return;
      }
      if ((e.target as Element | null)?.closest(BUSY)) return;
      stop();
      const id = e.pointerId;
      from = { id, x: e.clientX, y: e.clientY };
      const r0 = el.getBoundingClientRect();
      /* кольцо показываем только когда нажатие уже похоже на удержание:
         на короткий тап не должно быть ни точки, ни вспышки */
      ringTimer = window.setTimeout(() => setPress({ x: e.clientX - r0.left, y: e.clientY - r0.top }), SHOW_RING);
      timer = window.setTimeout(() => {
        timer = 0;
        /* таймер, переживший свой палец, не должен ничего создавать */
        if (from?.id !== id) return;
        from = null;
        const r = el.getBoundingClientRect();
        const p = m.unproject([e.clientX - r.left, e.clientY - r.top]);
        fired = Date.now();
        navigator.vibrate?.(15);
        setPress(null);
        blankFn.current({ lat: p.lat, lng: p.lng });
      }, HOLD);
    };

    const move = (e: PointerEvent) => {
      if (!from || e.pointerId !== from.id) return;
      if (Math.abs(e.clientX - from.x) > SLOP || Math.abs(e.clientY - from.y) > SLOP) stop();
    };

    const up = (e: PointerEvent) => {
      fingers.delete(e.pointerId);
      if (from?.id === e.pointerId) stop();
    };

    const leave = (e: PointerEvent) => {
      if (from?.id === e.pointerId) stop();
    };

    /* после удержания браузер всё равно шлёт click — он открыл бы чужой вечер под пальцем */
    const swallow = (e: MouseEvent) => {
      if (Date.now() - fired > 700) return;
      e.stopPropagation();
      e.preventDefault();
    };
    const menu = (e: Event) => e.preventDefault();

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('click', swallow, true);
    el.addEventListener('contextmenu', menu);
    /* панорама и зум гасят удержание, даже если палец почти не сдвинулся */
    m.on('movestart', stop);
    m.on('dragstart', stop);
    m.on('zoomstart', stop);
    return () => {
      stop();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('click', swallow, true);
      el.removeEventListener('contextmenu', menu);
      m.off('movestart', stop);
      m.off('dragstart', stop);
      m.off('zoomstart', stop);
    };
  }, [loaded]);

  const active = open ? events.find((e) => e.id === activeId) ?? null : null;
  const stat = active
    ? active.frames > 0
      ? `${active.frames} фото · ${active.sources} ${plural(active.sources, 'источник', 'источника', 'источников')} · фото готовы`
      : 'кадров пока нет — вечер впереди'
    : '';
  const byline = active
    ? active.by
      ? `снимали: ${active.by}${active.sources > 1 ? ` и ещё ${active.sources - 1}` : ''}`
      : 'снимали: пока никто'
    : '';

  return (
    <>
      <div ref={box} className="lmap" aria-label="Карта вечеров" />
      {!loaded && <span className="lmap-load">карта загружается…</span>}

      {/* кольцо растёт, пока держишь: видно, что жест поймался и где встанет вечер */}
      {press && (
        <span
          key={`${press.x}-${press.y}`}
          className="lpress"
          style={{ left: press.x, top: press.y, animationDuration: `${HOLD - SHOW_RING}ms` }}
        />
      )}
      {ring && <span className="lring" style={{ left: ring.x, top: ring.y }} />}

      {/* карточка целиком — ссылка: второй тап по ней уже открывает вечер,
          кнопки «открыть» и крестика нет (закрывает тап по пустой карте).
          Название одно: пока карточка открыта, оно здесь, а подпись под пином уходит. */}
      {active &&
        cardHost &&
        createPortal(
          <Link
            key={active.id}
            className={`pincard ${below ? 'below' : ''}`}
            data-id={active.id}
            href={active.href ?? `/e/${active.id}/`}
            aria-label={`Открыть ${active.title}`}
          >
            <span className="ar" aria-hidden="true">
              ›
            </span>
            <div className="pt">{active.title}</div>
            <div className="pl">
              {active.venue} · {active.when.split(', ')[1]}
            </div>
            <div className="ps">{stat}</div>
            <div className="pa">{byline}</div>
            <i className="tail" />
          </Link>,
          cardHost,
        )}
    </>
  );
}
