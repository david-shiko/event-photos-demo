'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { asset, cabinet, frames, sources } from '@/lib/data';
import { readCreated, type Created } from '@/lib/client';

export default function Page() {
  const [created, setCreated] = useState<Created[]>([]);
  const [report, setReport] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setCreated(readCreated()), []);

  const downloadCsv = () => {
    const rows = [
      ['показатель', 'значение'],
      ['открыли вечер', '309'],
      ['дошли до кадров, %', '94'],
      ['скачали файлов', '88'],
      ['кадров принесли гости', '41'],
      ['оплачено за месяц, ₽', '1380'],
    ];
    const csv = '\ufeff' + rows.map((r) => r.join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'otchet-noyabr.csv';
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  return (
    <Shell
      active="Кабинет"
      title="Кабинет"
      caption="После вечера остаются не десять чатов, а одна цифра: 88 кадров забрали, 41 кадр принесли гости."
      note={
        <>
          <b>Главная боль.</b> Фотограф собирает гостевые кадры руками — часы переписки на каждый
          вечер. Здесь гости приносят сами, и это видно в отчёте. Такого нет у ссылки на облако.
        </>
      }
    >
      <div className="top">
        <span className="ttl">Ваши вечера</span>
        <span className="act">Смирнова А.</span>
      </div>

      <div className="cab">
        <div className="hi">
          <div className="n">Аня, привет</div>
          <div className="m">ноябрь · 2 вечера · 1 черновик</div>
        </div>

        <div className="nums">
          <div className="c">
            <div className="v">{cabinet.paid} ₽</div>
            <div className="k">оплачено</div>
          </div>
          <div className="c">
            <div className="v">{cabinet.shot}</div>
            <div className="k">кадров загружено</div>
          </div>
          <div className="c">
            <div className="v">{cabinet.downloaded}</div>
            <div className="k">кадров скачали</div>
          </div>
        </div>

        <div className="sec">Вечера</div>

        {created.map((e) => (
          <Link className="ev" key={e.id} href="/e/7kd2qf9xm/">
            <div className="r">
              <div className="im" style={{ backgroundImage: `url(${asset('/img/p4.jpg')})` }} />
              <div>
                <div className="t">{e.title}</div>
                <div className="l">
                  {e.when} · {e.venue} · кадры ещё не залиты
                </div>
                <span className="st draft">ссылка создана</span>
              </div>
            </div>
            <div className="r2">
              <span>
                код <b>{e.code}</b>
              </span>
              <span>
                смотрели <b>0</b>
              </span>
              <span className="money">690 ₽ оплачено</span>
            </div>
          </Link>
        ))}

        {cabinet.events.map((e) => (
          <Link className="ev" key={e.id} href={`/e/${e.id}/`}>
            <div className="r">
              <div className="im" style={{ backgroundImage: `url(${e.img})` }} />
              <div>
                <div className="t">{e.title}</div>
                <div className="l">
                  {e.date} ·{' '}
                  {e.frames > 0 ? `${frames(e.frames)} · ${sources(e.sources)}` : 'кадры ещё не залиты'}
                </div>
                <span className={`st ${e.state === 'черновик' ? 'draft' : ''}`}>{e.state}</span>
              </div>
            </div>
            <div className="r2">
              <span>
                смотрели <b>{e.views}</b>
              </span>
              <span>
                скачали <b>{e.downloads}</b>
              </span>
              <span className="money">{e.money}</span>
            </div>
          </Link>
        ))}

        <div className="pay">
          <div className="t">Новый вечер — 690 ₽</div>
          <div className="d">
            До 40 ГБ, 90 дней, видео 1080p, отчёт охвата. Первый вечер в сервисе бесплатно.
          </div>
          <div className="b">
            <Link className="p" href="/new/">
              Создать вечер
            </Link>
            <button className="s" onClick={() => setReport(true)}>
              Отчёт
            </button>
          </div>
        </div>

        <div style={{ height: 52 }} />
      </div>

      {report && (
        <>
          <button className="scrim" onClick={() => setReport(false)} aria-label="Закрыть" />
          <div className="sheet">
            <div className="grab" />
            <div className="st">Отчёт за ноябрь</div>
            <div className="rep">
              <div>
                <b>309</b>
                <span>открыли вечер</span>
              </div>
              <div>
                <b>94 %</b>
                <span>дошли до кадров</span>
              </div>
              <div>
                <b>88</b>
                <span>скачали файлы</span>
              </div>
              <div>
                <b>41</b>
                <span>кадр принесли гости</span>
              </div>
            </div>
            <div className="reph">
              Это то, чего нет в ссылке на облако: видно, сколько гостей дошло до кадров и сколько
              файлов забрали.
            </div>
            <div className="row2">
              <button className={`ghost2 ${saved ? 'on' : ''}`} onClick={downloadCsv}>
                {saved ? 'Файл скачан ✓' : 'Скачать CSV'}
              </button>
              <button className="primary" onClick={() => setReport(false)}>
                Закрыть
              </button>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
