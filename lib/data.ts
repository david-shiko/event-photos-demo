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

type Bucket = { from: number; to: number; count: number };

export const makePhotos = (buckets: Bucket[], from: number): Photo[] => {
  const out: Photo[] = [];
  buckets.forEach((b, bi) => {
    for (let k = 0; k < b.count; k += 1) {
      const i = out.length;
      const minute = b.from + ((k + 0.5) * (b.to - b.from)) / b.count;
      const isGuest = i % 7 === 2 || i % 7 === 4 || i % 7 === 6;
      out.push({
        id: i,
        img: asset(`/img/${IMGS[i % IMGS.length]}.jpg`),
        time: fmt(minute),
        hour: Math.floor(minute / 60),
        source: isGuest ? 'guest' : 'photo',
        likes: (i * 37) % 47,
        pos: `${20 + ((i * 13) % 60)}% ${25 + ((i * 17) % 50)}%`,
        period: `p${Math.floor((minute - from) / 120)}`,
      });
    }
  });
  return out;
};

/* куски по два часа: чипс и лента считаются из одного и того же поля period */
const periodsFor = (photos: Photo[], from: number, to: number): Period[] => {
  const out: Period[] = [];
  for (let i = 0; from + i * 120 < to; i += 1) {
    const id = `p${i}`;
    const count = photos.filter((p) => p.period === id).length;
    if (!count) continue;
    out.push({ id, label: `${fmt(from + i * 120)}–${fmt(Math.min(from + (i + 1) * 120, to))}`, count, from: from + i * 120, to: Math.min(from + (i + 1) * 120, to) });
  }
  return out;
};

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
  /** кто снимал — первая строка карточки над пином */
  by?: string;
  /** есть страница, но на карте и в ленте его нет */
  hidden?: boolean;
};

export const mapEvents: MapEvent[] = [
  {
    id: '7kd2qf9xm',
    title: 'Свадьба Ани',
    venue: 'Лофт «Красный Октябрь»',
    when: '11 июля, 19:00–02:00',
    frames: 168,
    sources: 24,
    by: 'Аня',
    img: asset('/img/vp2.jpg'),
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
    by: 'Марк',
    img: asset('/img/vl3.jpg'),
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
    by: 'Илья',
    img: asset('/img/p5.jpg'),
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
    by: 'Настя',
    img: asset('/img/vp6.jpg'),
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
    img: asset('/img/vl5.jpg'),
    lat: 55.7602,
    lng: 37.6241,
  },
  {
    id: 'vypusk',
    title: 'Выпускной',
    venue: 'Парк Горького',
    when: '12 июля, 18:00–01:00',
    frames: 210,
    sources: 32,
    img: asset('/img/vl2.jpg'),
    lat: 55.7306,
    lng: 37.6013,
  },
  {
    id: 'sosedi',
    title: 'Ужин соседей',
    venue: 'Таганка',
    when: '12 июля, 20:00–23:00',
    frames: 64,
    sources: 9,
    img: asset('/img/vp6.jpg'),
    lat: 55.7439,
    lng: 37.6492,
  },
  {
    id: 'kino',
    title: 'Кино на крыше',
    venue: 'Крыша на Пресне',
    when: '14 июля, 21:00–00:30',
    frames: 38,
    sources: 7,
    img: asset('/img/vl7.jpg'),
    lat: 55.7691,
    lng: 37.5931,
  },
  {
    id: 'tochki',
    title: 'Корпоратив «Точки»',
    venue: 'Офис на Ленинском',
    when: '11 июля, 19:00–23:00',
    frames: 0,
    sources: 0,
    img: asset('/img/p7.jpg'),
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
    img: asset('/img/vl1.jpg'),
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
    img: asset('/img/vp8.jpg'),
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
    img: asset('/img/p1.jpg'),
    lat: 55.7638,
    lng: 37.5922,
    soon: true,
  },
  {
    id: 'flakon-pokaz',
    title: 'Показ «Тихие комнаты»',
    venue: 'Дизайн-завод «Флакон»',
    when: '11 июля, 20:00–23:00',
    frames: 0,
    sources: 0,
    img: asset('/img/p2.jpg'),
    lat: 55.7611,
    lng: 37.5994,
    soon: true,
  },
  {
    id: 'flakon-lekciya',
    title: 'Лекция о плёнке',
    venue: 'Дизайн-завод «Флакон»',
    when: '11 июля, 20:00–23:00',
    frames: 0,
    sources: 0,
    img: asset('/img/p4.jpg'),
    lat: 55.7606,
    lng: 37.5998,
    soon: true,
  },
  {
    id: 'flakon-market',
    title: 'Маркет «Второй круг»',
    venue: 'Дизайн-завод «Флакон»',
    when: '11 июля, 20:00–23:00',
    frames: 0,
    sources: 0,
    img: asset('/img/vp4.jpg'),
    lat: 55.7613,
    lng: 37.6001,
    soon: true,
  },
  {
    id: 'flakon-dj',
    title: 'Сет диджея Мити',
    venue: 'Дизайн-завод «Флакон»',
    when: '11 июля, 20:00–23:00',
    frames: 0,
    sources: 0,
    img: asset('/img/vl6.jpg'),
    lat: 55.7604,
    lng: 37.5989,
    soon: true,
  },
  {
    id: 'gorky',
    title: 'Пикник в Парке Горького',
    venue: 'Парк Горького',
    when: '11 июля, 18:00–22:00',
    frames: 96,
    sources: 14,
    img: asset('/img/p1.jpg'),
    lat: 55.7298,
    lng: 37.6019,
    by: 'Лена',
  },
  {
    id: 'muzeon',
    title: 'Кино в «Музеоне»',
    venue: 'Парк «Музеон»',
    when: '11 июля, 20:00–23:00',
    frames: 44,
    sources: 8,
    img: asset('/img/vl2.jpg'),
    lat: 55.7352,
    lng: 37.6067,
    by: 'Тимур',
  },
  {
    id: 'depot',
    title: 'Ужин в «Депо»',
    venue: 'Депо Лесная',
    when: '11 июля, 19:00–00:00',
    frames: 122,
    sources: 19,
    img: asset('/img/p3.jpg'),
    lat: 55.7799,
    lng: 37.5885,
    by: 'Олег',
  },
  {
    id: 'zaryadye',
    title: 'Концерт в «Зарядье»',
    venue: 'Парк «Зарядье»',
    when: '11 июля, 20:00–23:30',
    frames: 158,
    sources: 21,
    img: asset('/img/vp5.jpg'),
    lat: 55.751,
    lng: 37.629,
    by: 'Кирилл',
  },
  {
    id: 'artplay',
    title: 'Маркет в «Артплее»',
    venue: 'Дизайн-квартал «Артплей»',
    when: '11 июля, 12:00–21:00',
    frames: 58,
    sources: 10,
    img: asset('/img/p8.jpg'),
    lat: 55.7545,
    lng: 37.6589,
    by: 'Даша',
  },
  {
    id: 'sky',
    title: 'Крыша на Ленинском',
    venue: 'Крыша «Скай»',
    when: '11 июля, 21:00–02:00',
    frames: 74,
    sources: 12,
    img: asset('/img/vl4.jpg'),
    lat: 55.7077,
    lng: 37.5837,
    by: 'Стас',
  },
  {
    id: 'vdnkh',
    title: 'Джаз на ВДНХ',
    venue: 'ВДНХ, Зелёный театр',
    when: '11 июля, 19:00–23:00',
    frames: 63,
    sources: 9,
    img: asset('/img/vp7.jpg'),
    lat: 55.8263,
    lng: 37.6377,
    by: 'Полина',
  },
  {
    id: 'kolomna',
    title: 'Свадьба Кати',
    venue: 'Коломенское',
    when: '11 июля, 17:00–23:00',
    frames: 210,
    sources: 31,
    img: asset('/img/big.jpg'),
    lat: 55.669,
    lng: 37.674,
    by: 'Катя',
  },
  {
    id: 'sokolniki',
    title: 'Выпускной школы 12',
    venue: 'Парк «Сокольники»',
    when: '11 июля, 21:00–03:00',
    frames: 188,
    sources: 27,
    img: asset('/img/vl8.jpg'),
    lat: 55.794,
    lng: 37.675,
    by: 'Соня',
  },
  {
    id: 'bauman',
    title: 'Фотопрогулка по Бауманской',
    venue: 'Бауманская',
    when: '11 июля, 18:00–21:00',
    frames: 51,
    sources: 7,
    img: asset('/img/p6.jpg'),
    lat: 55.7722,
    lng: 37.679,
    by: 'Гриша',
  },
  {
    id: 'cherry',
    title: 'Бар «Черри»: сет',
    venue: 'Бар «Черри»',
    when: '11 июля, 22:00–03:00',
    frames: 132,
    sources: 16,
    img: asset('/img/vp3.jpg'),
    lat: 55.7601,
    lng: 37.6237,
    by: 'Митя',
  },
  {
    id: 'tverskaya',
    title: 'Открытие витрины',
    venue: 'Тверская, 12',
    when: '11 июля, 19:00–22:00',
    frames: 0,
    sources: 0,
    img: asset('/img/p2.jpg'),
    lat: 55.7613,
    lng: 37.6091,
    soon: true,
  },
  {
    id: 'ny-tochki',
    title: 'Новогодний корпоратив',
    venue: 'Лофт «Красный Октябрь»',
    when: '31 декабря, 20:00–02:00',
    frames: 0,
    sources: 0,
    img: asset('/img/p7.jpg'),
    lat: 55.7394,
    lng: 37.6078,
    hidden: true,
  },
  {
    id: 'izmailovo',
    title: 'Ярмарка в Измайлове',
    venue: 'Измайловский кремль',
    when: '11 июля, 13:00–20:00',
    frames: 87,
    sources: 13,
    img: asset('/img/vl1.jpg'),
    lat: 55.7905,
    lng: 37.749,
    by: 'Вера',
  },
  {
    id: 'flakon-vitrina',
    title: 'Съёмка для витрины',
    venue: 'Дизайн-завод «Флакон»',
    when: '11 июля, 20:00–23:00',
    frames: 0,
    sources: 0,
    img: asset('/img/p6.jpg'),
    lat: 55.7617,
    lng: 37.5997,
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
  const buckets = spread(n, from, to);
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
    cover: m.id === '7kd2qf9xm' ? asset('/img/big.jpg') : m.img,
    city: 'Москва',
    wasThere: '21:40',
    photos: makePhotos(buckets, from),
    periods: periodsFor(makePhotos(buckets, from), from, to),
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
      img: asset('/img/vp2.jpg'),
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
      img: asset('/img/vl3.jpg'),
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
      img: asset('/img/p4.jpg'),
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

/** Семь дней вокруг вечера: полоса дней на карте. */
export const DAYS = [
  { label: '10 июля', short: 'чт', dow: 'четверг' },
  { label: '11 июля', short: 'пт', dow: 'пятница' },
  { label: '12 июля', short: 'сб', dow: 'суббота' },
  { label: '13 июля', short: 'вс', dow: 'воскресенье' },
  { label: '14 июля', short: 'пн', dow: 'понедельник' },
  { label: '15 июля', short: 'вт', dow: 'вторник' },
  { label: '16 июля', short: 'ср', dow: 'среда' },
];

export const dayIndex = (label: string) => DAYS.findIndex((d) => d.label === label);

/** Начало вечера на общей шкале: 0 = 10 июля, 00:00. */
export const eventSpan = (e: MapEvent) => {
  const idx = Math.max(0, dayIndex(e.when.split(', ')[0]));
  const { from, to } = windowMinutes(e.when);
  const start = idx * 1440 + from;
  return { start, end: idx * 1440 + to };
};

/** Минуты на шкале → «21:40» и день. */
export const clockOf = (m: number) => {
  const day = Math.floor(m / 1440);
  const rest = ((m % 1440) + 1440) % 1440;
  const hh = String(Math.floor(rest / 60)).padStart(2, '0');
  const mm = String(rest % 60).padStart(2, '0');
  return { time: `${hh}:${mm}`, day, label: DAYS[Math.max(0, Math.min(6, day))].label };
};
