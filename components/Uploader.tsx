'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Shell from './Shell';
import { asset } from '@/lib/data';

type Item = { id: number; name: string; size: string; img: string; video?: boolean };

const FILES: Item[] = [
  { id: 1, name: 'IMG_4821.HEIC', size: '4,2 МБ', img: asset('/img/p3.png') },
  { id: 2, name: 'IMG_4822.HEIC', size: '3,8 МБ', img: asset('/img/p5.png') },
  { id: 3, name: 'IMG_4825.JPG', size: '5,1 МБ', img: asset('/img/vl1.png') },
  { id: 4, name: 'VID_5512.MOV', size: '62 МБ', img: asset('/img/vp2.png'), video: true },
  { id: 5, name: 'IMG_4829.HEIC', size: '4,4 МБ', img: asset('/img/p7.png') },
  { id: 6, name: 'IMG_4831.HEIC', size: '6,2 МБ', img: asset('/img/vl5.png') },
];

export default function Uploader() {
  const [chosen, setChosen] = useState(false);
  const [progress, setProgress] = useState<Record<number, number>>({});
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const done = FILES.every((f) => (progress[f.id] ?? 0) >= 100);

  useEffect(() => {
    if (!running) return;
    timer.current = setInterval(() => {
      setProgress((prev) => {
        const next = { ...prev };
        FILES.forEach((f) => {
          const cur = next[f.id] ?? 0;
          if (cur >= 100) return;
          const step = f.video ? 3.5 : 6 + ((f.id * 7) % 6);
          next[f.id] = Math.min(100, cur + step);
        });
        return next;
      });
    }, 140);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [running]);

  useEffect(() => {
    if (done && running) setRunning(false);
  }, [done, running]);

  return (
    <Shell
      active="Загрузка"
      title="Загрузка"
      caption="Гость кладёт свои кадры за минуту. Без аккаунта, приложения и просьб в личку."
      note={
        <>
          <b>Здесь решается главная боль.</b> Фотографу не надо писать десяти людям «скиньте, что
          снимали»: гость открыл ссылку, выбрал файлы, закрыл экран — кадры уже в вечере.
        </>
      }
    >
      <div className="top">
        <span className="rb">‹</span>
        <span className="ttl">{running ? 'Загрузка' : done ? 'Готово' : 'Ваши кадры'}</span>
        <span className="act">Вечер</span>
      </div>

      <div className="upl">
        <div className="who">
          <span className="on">Телефон</span>
          <span>Компьютер</span>
          <span className="off">Облако</span>
        </div>

        {!chosen && (
          <div className="drop">
            <div className="ic">＋</div>
            <div className="h">Добавьте кадры в вечер Ани</div>
            <div className="d">
              Выберите фото и видео из галереи. Кадры увидят все, кто откроет ссылку.
            </div>
            <button className="pick" onClick={() => setChosen(true)}>
              Выбрать файлы
            </button>
          </div>
        )}

        {!chosen && (
          <div className="steps">
            <div className="row2">
              <i>1</i>
              <div>
                <div className="t2">Выбираете кадры из галереи</div>
                <div className="d2">Сразу пачкой, без имён и папок. Видео до 2 минут.</div>
              </div>
            </div>
            <div className="row2">
              <i>2</i>
              <div>
                <div className="t2">Видите прогресс и можете закрыть экран</div>
                <div className="d2">Загрузка продолжится в фоне, вернётесь — будет готово.</div>
              </div>
            </div>
            <div className="row2">
              <i>3</i>
              <div>
                <div className="t2">Кадры появляются в вечере сразу</div>
                <div className="d2">У них метка «гость», фотограф видит, кто что принёс.</div>
              </div>
            </div>
          </div>
        )}

        {chosen && (
          <div className="drop" style={{ padding: '16px' }}>
            <div className="pickline">
              <span className="n">6 файлов</span>
              <span className="sz">· 86 МБ</span>
              {!running && !done && (
                <button
                  className="go"
                  onClick={() => {
                    setProgress({});
                    setRunning(true);
                  }}
                >
                  Загрузить
                </button>
              )}
              {done && <span className="go" style={{ background: '#eef4ea', color: '#2f7a4c' }}>готово</span>}
            </div>
          </div>
        )}

        {chosen && (
          <div className="list">
            {FILES.map((f) => {
              const pc = progress[f.id] ?? 0;
              return (
                <div className="f" key={f.id}>
                  <div className="th" style={{ backgroundImage: `url(${f.img})` }} />
                  <div>
                    <div className="nm">
                      {f.name} {f.video && <span style={{ color: 'var(--mut)', fontWeight: 500 }}>· видео</span>}
                    </div>
                    <div className={`st ${pc >= 100 ? 'ok' : ''}`}>
                      {pc >= 100 ? 'готово' : pc > 0 ? `${Math.round(pc)} %` : 'ждёт'}
                      {' · '}
                      {f.size}
                    </div>
                  </div>
                  {pc < 100 ? (
                    <div className="bar2">
                      <i style={{ width: `${pc}%` }} />
                    </div>
                  ) : (
                    <span className="pc">✓</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {running && (
          <div className="banner">
            Можно закрыть экран и вернуться в чат — загрузка продолжится. Мы пришлём сообщение,
            когда кадры появятся в вечере.
          </div>
        )}

        {done && (
          <div className="banner">6 файлов в вечере. Спасибо — Аня увидит их сразу.</div>
        )}

        <div className="ufoot">
          <Link className="cta" href="/e/7kd2qf9xm/">
            {done ? 'Открыть вечер' : 'Вернуться в вечер'}
          </Link>
          <div className="sum">
            {done ? '6 из 6 готово' : 'видео до 2 минут, 1080p'}
          </div>
        </div>
      </div>
    </Shell>
  );
}
