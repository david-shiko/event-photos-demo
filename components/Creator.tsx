'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Shell from './Shell';
import { asset } from '@/lib/data';
import { saveCreated, useCopy } from '@/lib/client';

const LINK = 'event.photos/s/mk7f2q';
const PRICE = 690;

type Field = 'title' | 'venue' | 'date' | 'time';

export default function Creator() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [paying, setPaying] = useState(false);
  const [guests, setGuests] = useState(true);
  const [card, setCard] = useState<'sbp' | 'card'>('sbp');
  const [f, setF] = useState<Record<Field, string>>({
    title: 'Свадьба Маши и Кости',
    venue: 'Лофт «Красный Октябрь»',
    date: '12 декабря, суббота',
    time: '19:00–02:00',
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { done, copy } = useCopy();

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const pay = () => {
    setPaying(true);
    timer.current = setTimeout(() => {
      saveCreated({ id: 'mk7f2q', code: '6391', title: f.title, venue: f.venue, when: f.date });
      setPaying(false);
      setStep(3);
    }, 1500);
  };

  const note =
    step === 1 ? (
      <>
        <b>Четыре поля.</b> Вечер заводится за минуту — до него, а не после. Гости получают ссылку
        ещё за столом.
      </>
    ) : step === 2 ? (
      <>
        <b>Один платёж, без подписки.</b> 690 ₽ за вечер. Окупается одним гостем, который заберёт
        40 кадров и приведёт следующую пару.
      </>
    ) : (
      <>
        <b>Ссылка готова.</b> Её кидают в чат или печатают QR на карточках. Гостям не нужно ничего
        ставить — они открывают и заливают свои кадры.
      </>
    );

  return (
    <Shell
      active="Новый вечер"
      title={step === 3 ? 'Вечер создан' : 'Новый вечер'}
      caption="Вечер начинается до первого кадра: четыре поля, 690 ₽, ссылка с QR — и гости уже знают, куда нести свои."
      note={note}
    >
      <div className="top">
        {step === 1 ? (
          <Link className="rb" href="/photographer/">
            ‹
          </Link>
        ) : step === 2 ? (
          <button className="rb" onClick={() => !paying && setStep(1)}>
            ‹
          </button>
        ) : (
          <Link className="rb" href="/photographer/" aria-label="В кабинет">
            ‹
          </Link>
        )}
        <span className="ttl">{step === 3 ? 'Готово' : step === 2 ? 'Оплата' : 'Новый вечер'}</span>
        <span className="act">{step === 3 ? '6391' : `шаг ${step} из 2`}</span>
      </div>

      <div className="nv">
        {step === 1 && (
          <>
            <div className="pad">
              <div className="fld">
                <div className="flb">Название</div>
                <input
                  value={f.title}
                  onChange={(e) => setF({ ...f, title: e.target.value })}
                  aria-label="Название вечера"
                />
              </div>
              <div className="fld">
                <div className="flb">Площадка</div>
                <input
                  value={f.venue}
                  onChange={(e) => setF({ ...f, venue: e.target.value })}
                  aria-label="Площадка"
                />
              </div>
              <div className="two">
                <div className="fld">
                  <div className="flb">Дата</div>
                  <input
                    value={f.date}
                    onChange={(e) => setF({ ...f, date: e.target.value })}
                    aria-label="Дата"
                  />
                </div>
                <div className="fld" style={{ width: 118 }}>
                  <div className="flb">Время</div>
                  <input
                    value={f.time}
                    onChange={(e) => setF({ ...f, time: e.target.value })}
                    aria-label="Время"
                  />
                </div>
              </div>

              <button className="sw" onClick={() => setGuests(!guests)} aria-pressed={guests}>
                <span className={`tg ${guests ? 'on' : ''}`}>
                  <i />
                </span>
                <span className="tx">
                  <b>Гости заливают свои кадры</b>
                  <span>без аккаунта, по ссылке или QR</span>
                </span>
              </button>

              <div className="tips">
                <div className="tr">
                  <span>Ссылка и QR</span>
                  <b>сразу после оплаты</b>
                </div>
                <div className="tr">
                  <span>Хранение</span>
                  <b>90 дней</b>
                </div>
                <div className="tr">
                  <span>Место</span>
                  <b>до 40 ГБ</b>
                </div>
                <div className="tr">
                  <span>Вечер на карте</span>
                  <b>{guests ? 'да, с кадрами и видео' : 'только по ссылке'}</b>
                </div>
              </div>
            </div>

            <div className="ufoot">
              <button className="cta" onClick={() => setStep(2)}>
                К оплате · {PRICE} ₽
              </button>
              <div className="sum">один вечер, без подписки</div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="pad">
              <div className="sum2">
                <div className="n">{PRICE} ₽</div>
                <div className="d">
                  {f.title}
                  <br />
                  {f.venue} · {f.date}
                </div>
              </div>

              <div className="flb" style={{ marginTop: 18 }}>
                Чем платим
              </div>
              <button className={`pm ${card === 'sbp' ? 'on' : ''}`} onClick={() => setCard('sbp')}>
                <span className="ic">СБП</span>
                <span className="tx">
                  <b>По QR через банк</b>
                  <span>без комиссии</span>
                </span>
                <span className="rd" />
              </button>
              <button className={`pm ${card === 'card' ? 'on' : ''}`} onClick={() => setCard('card')}>
                <span className="ic">•••• 1180</span>
                <span className="tx">
                  <b>Карта 4276</b>
                  <span>сохранить для следующих вечеров</span>
                </span>
                <span className="rd" />
              </button>

              <div className="tips" style={{ marginTop: 16 }}>
                <div className="tr">
                  <span>Хранение</span>
                  <b>90 дней</b>
                </div>
                <div className="tr">
                  <span>Место</span>
                  <b>до 40 ГБ</b>
                </div>
                <div className="tr">
                  <span>Видео</span>
                  <b>1080p, до 2 минут</b>
                </div>
                <div className="tr">
                  <span>Гости</span>
                  <b>заливают без аккаунта</b>
                </div>
                <div className="tr">
                  <span>Отчёт</span>
                  <b>охват и скачивания</b>
                </div>
              </div>

              <div className="fine">
                Чек придёт на почту. Вернём деньги, если вечер не состоялся — до 90 дней.
              </div>
            </div>

            <div className="ufoot">
              <button className="cta" onClick={pay} disabled={paying}>
                {paying ? 'Оплачиваем…' : `Оплатить ${PRICE} ₽`}
              </button>
              <div className="sum">демо: платёж ненастоящий, деньги не списываются</div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="pad">
              <div className="okc">✓</div>
              <div className="done">
                <div className="n">{f.title}</div>
                <div className="d">
                  {f.venue} · {f.date} · {f.time}
                </div>
                <div className="p">{PRICE} ₽ оплачено · ссылка живёт 90 дней</div>
              </div>

              <div className="qbox">
                <img src={asset('/img/qr.png')} width={132} height={132} alt="QR вечера" />
                <div className="code">
                  код вечера <b>6391</b>
                </div>
              </div>

              <div className="lnk2">{LINK}</div>

              <div className="copyrow">
                <button className="primary" onClick={() => copy(`https://${LINK}`)}>
                  {done ? 'Скопировано ✓' : 'Скопировать ссылку'}
                </button>
              </div>

              <div className="steps3">
                <div className="s3">
                  <i>1</i>
                  <div>
                    <div className="t3">Киньте ссылку в чат вечера</div>
                    <div className="d3">Или покажите QR на входе — гости откроют с телефона.</div>
                  </div>
                </div>
                <div className="s3">
                  <i>2</i>
                  <div>
                    <div className="t3">Гости заливают свои кадры</div>
                    <div className="d3">Без аккаунта, приложения и регистрации.</div>
                  </div>
                </div>
                <div className="s3">
                  <i>3</i>
                  <div>
                    <div className="t3">Кадры собираются в один вечер</div>
                    <div className="d3">По времени съёмки: фото и видео вместе, от вас и от гостей.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="ufoot">
              <Link className="cta" href="/e/7kd2qf9xm/">
                Как выглядит вечер
              </Link>
              <Link className="ghost2" style={{ marginTop: 8 }} href="/photographer/">
                В кабинет
              </Link>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
