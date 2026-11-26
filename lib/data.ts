export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const asset = (path: string) => `${BASE}${path}`;

export const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

export const frames = (n: number) => `${n} ${plural(n, 'кадр', 'кадра', 'кадров')}`;
export const evenings = (n: number) => `${n} ${plural(n, 'вечер', 'вечера', 'вечеров')}`;
export const sources = (n: number) => `${n} ${plural(n, 'источник', 'источника', 'источников')}`;

export type Period = { id: string; label: string; count: number; from: number; to: number };
export type Photo = {
  id: number;
  img: string;
  time: string;
  hour: number;
  source: 'photo' | 'guest';
  likes: number;
  pos: string;
  period: string;
};

const IMGS = [
  'p1', 'p3', 'vp2', 'p5', 'vl1', 'p2', 'vp5', 'p7',
  'vl3', 'p4', 'vp1', 'p6', 'vl5', 'p8', 'vp7', 'vl2',
  'p3', 'vp4', 'vl7', 'p1', 'vp8', 'vl4', 'p5', 'vl8',
];

const fmt = (minutes: number) => {
  const m = Math.round(minutes) % (24 * 60);
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** «11 июля, 19:00–02:00» → минуты от полуночи, конец переезжает через полночь. */
const parseWindow = (when: string) => {
  const m = when.match(/(\d{1,2}):(\d{2})\D+(\d{1,2}):(\d{2})/);
  if (!m) return { from: 19 * 60, to: 26 * 60 };
  const from = Number(m[1]) * 60 + Number(m[2]);
  let to = Number(m[3]) * 60 + Number(m[4]);
  while (to <= from) to += 24 * 60;
  return { from, to };
};

/** «19:00–02:00» → минуты от полуночи; конец переезжает через полночь. */
export const windowMinutes = (when: string) => parseWindow(when);

/** «21:40» → минуты, после полуночи продолжает счёт. */
export const clockMinutes = (t: string) => {
  const h = Number(t.slice(0, 2));
  const m = Number(t.slice(3, 5));
  return (h < 12 ? h + 24 : h) * 60 + m;
};

/** Вечер режется на двухчасовые куски, последний — до конца. */
const bucketsOf = (from: number, to: number) => {
  const out: { from: number; to: number }[] = [];
  for (let b = from; b < to; b += 120) out.push({ from: b, to: Math.min(b + 120, to) });
  return out;
};

const splitByTime = (n: number, from: number, to: number) => {
  const list = bucketsOf(from, to);
  const total = to - from;
  let acc = 0;
  return list.map((b, i) => {
    const count =
      i === list.length - 1
        ? n - acc
        : Math.round((n * (b.to - b.from)) / total);
    acc += count;
    return { ...b, count: Math.max(0, count) };
  });
};

/** Как гуляет вечер: тише в начале, пик к полуночи, всплеск на тосте в час. */
const weight = (minute: number) => {
  const h = Math.floor(minute / 60);
  if (h < 20) return 0.55;
  if (h < 21) return 1.05;
  if (h < 23) return 1.4;
  if (h < 24) return 1.05;
  if (h < 25) return 1.2;
  return 1.95;
};

/** Раскладывает n кадров по 15-минутным слотам так, чтобы сумма сошлась. */
const spread = (n: number, from: number, to: number) => {
  const step = 15;
  const slots: { from: number; to: number; count: number }[] = [];
  for (let t = from; t < to; t += step) slots.push({ from: t, to: Math.min(t + step, to), count: 0 });
  const weights = slots.map((s) => weight(s.from) * (s.to - s.from));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const exact = weights.map((w) => (n * w) / total);
  const base = exact.map((x) => Math.floor(x));
  let left = n - base.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, r: x - base[i] })).sort((a, b) => b.r - a.r);
  order.forEach((o) => {
    if (left <= 0) return;
    base[o.i] += 1;
    left -= 1;
  });
  return slots.map((s, i) => ({ from: s.from, to: s.to, count: Math.max(0, base[i]) }));
};

export const makePhotos = (n: number, from: number, to: number): Photo[] => {
  const out: Photo[] = [];
  spread(n, from, to).forEach((b, bi) => {
    for (let k = 0; k < b.count; k += 1) {
      const i = out.length;
      const minute = b.from + ((k + 0.5) * (b.to - b.from)) / b.count;
      const isGuest = i % 7 === 2 || i % 7 === 4 || i % 7 === 6;
      out.push({
        id: i,
        img: asset(`/img/${IMGS[i % IMGS.length]}.png`),
        time: fmt(minute),
        hour: Math.floor(minute / 60),
        source: isGuest ? 'guest' : 'photo',
        likes: (i * 37) % 47,
        pos: `${20 + ((i * 13) % 60)}% ${25 + ((i * 17) % 50)}%`,
        period: `p${bi}`,
      });
    }
  });
  return out;
};

const periodsFor = (n: number, from: number, to: number): Period[] =>
  splitByTime(n, from, to)
    .map((b, i) => ({
      id: `p${i}`,
      label: `${fmt(b.from)}–${fmt(b.to)}`,
      count: b.count,
      from: b.from,
      to: b.to,
    }))
    .filter((p) => p.count > 0);

export type MapEvent = {
  id: string;
  title: string;
  venue: string;
  when: string;
  frames: number;
  sources: number;
  img: string;
  lat: number;
  lng: number;
  locked?: boolean;
  soon?: boolean;
  featured?: boolean;
};

export const mapEvents: MapEvent[] = [
  {
    id: '7kd2qf9xm',
    title: 'Свадьба Ани',
    venue: 'Лофт «Красный Октябрь»',
    when: '11 июля, 19:00–02:00',
    frames: 168,
    sources: 24,
    img: asset('/img/vp2.png'),
    lat: 55.7394,
    lng: 37.6078,
    featured: true,
  },
  {
    id: 'jazz-sol',
    title: 'Джаз в «Соли»',
    venue: 'Бар «Соль»',
    when: '11 июля, 20:00–01:00',
    frames: 84,
    sources: 11,
    img: asset('/img/vl3.png'),
    lat: 55.7529,
    lng: 37.6377,
  },
  {
    id: 'vinzavod',
    title: 'Открытие «Винзавода»',
    venue: 'ЦСИ Винзавод',
    when: '11 июля, 18:00–23:00',
    frames: 240,
    sources: 38,
    img: asset('/img/p5.png'),
    lat: 55.7553,
    lng: 37.6642,
  },
  {
    id: 'mark-bday',
    title: 'День рождения Марка',
    venue: 'Крыша на Солянке',
    when: '11 июля, 21:00–03:00',
    frames: 56,
    sources: 9,
    img: asset('/img/vp6.png'),
    lat: 55.7536,
    lng: 37.6402,
  },
  {
    id: 'kassety',
    title: '«Кассеты»: концерт',
    venue: 'Клуб «Кассеты»',
    when: '11 июля, 22:00–02:00',
    frames: 132,
    sources: 17,
    img: asset('/img/vl5.png'),
    lat: 55.7602,
    lng: 37.6241,
  },
  {
    id: 'tochki',
    title: 'Корпоратив «Точки»',
    venue: 'Офис на Ленинском',
    when: '11 июля, 19:00–23:00',
    frames: 0,
    sources: 0,
    img: asset('/img/p7.png'),
    lat: 55.7106,
    lng: 37.5798,
    locked: true,
  },
  {
    id: 'streletc',
    title: 'Открытие бара',
    venue: 'Бар «Стрелка»',
    when: '11 июля, 20:00–02:00',
    frames: 0,
    sources: 0,
    img: asset('/img/vl1.png'),
    lat: 55.7491,
    lng: 37.6272,
    soon: true,
  },
  {
    id: 'liza-bday',
    title: 'День рождения Лизы',
    venue: 'Лофт на Курской',
    when: '11 июля, 21:00–03:00',
    frames: 0,
    sources: 0,
    img: asset('/img/vp8.png'),
    lat: 55.7462,
    lng: 37.6472,
    soon: true,
  },
  {
    id: 'patriki',
    title: 'Ужин на Патриках',
    venue: 'Ресторан на Патриарших',
    when: '11 июля, 19:30–23:30',
    frames: 0,
    sources: 0,
    img: asset('/img/p1.png'),
    lat: 55.7638,
    lng: 37.5922,
    soon: true,
  },
];


export type Ev = {
  id: string;
  title: string;
  venue: string;
  date: string;
  window: string;
  counts: { all: number; photographer: number; guests: number };
  sources: number;
  cover: string;
  city: string;
  wasThere: string;
  photos: Photo[];
  periods: Period[];
};

/** Данные вечера по id: счётчики, куски вечера и кадры под них. */
export function eventFor(id: string): Ev {
  const m = mapEvents.find((e) => e.id === id) ?? mapEvents[0];
  const n = m.frames > 0 ? m.frames : 168;
  const { from, to } = parseWindow(m.when);
  const [datePart, timePart] = m.when.split(', ');
  const photographer = Math.round((n * 4) / 7);
  return {
    id: m.id,
    title: m.title,
    venue: m.venue,
    date: datePart,
    window: timePart,
    counts: { all: n, photographer, guests: n - photographer },
    sources: m.sources || 7,
    cover: m.id === '7kd2qf9xm' ? asset('/img/big.png') : m.img,
    city: 'Москва',
    wasThere: '21:40',
    photos: makePhotos(n, from, to),
    periods: periodsFor(n, from, to),
  };
}

export const cabinet = {
  name: 'Аня Смирнова',
  month: 'ноябрь',
  paid: 1380,
  shot: 252,
  downloaded: 88,
  events: [
    {
      id: '7kd2qf9xm',
      title: 'Свадьба Ани',
      date: '11 июля',
      state: 'опубликован',
      frames: 168,
      sources: 24,
      views: 214,
      downloads: 61,
      money: '690 ₽ оплачено',
      img: asset('/img/vp2.png'),
    },
    {
      id: 'jazz-sol',
      title: 'Джаз в «Соли»',
      date: '3 ноября',
      state: 'опубликован',
      frames: 84,
      sources: 11,
      views: 95,
      downloads: 27,
      money: '690 ₽ оплачено',
      img: asset('/img/vl3.png'),
    },
    {
      id: 'ny-tochki',
      title: 'Новогодний корпоратив',
      date: '20 декабря',
      state: 'черновик',
      frames: 0,
      sources: 0,
      views: 0,
      downloads: 0,
      money: 'ссылка ещё не создана',
      img: asset('/img/p4.png'),
    },
  ],
};

/** Моменты вечера: подпись к самому запомнившемуся часу. */
export const moments: Record<string, { time: string; text: string }> = {
  '7kd2qf9xm': { time: '01:00', text: 'тот самый тост' },
  'jazz-sol': { time: '22:00', text: 'соло на саксофоне' },
  'vinzavod': { time: '20:00', text: 'первый зал' },
  'kassety': { time: '23:00', text: 'вышли на бис' },
  'mark-bday': { time: '23:00', text: 'торт на крыше' },
};
