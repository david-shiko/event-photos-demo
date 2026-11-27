'use client';

import Link from 'next/link';
import { useCopy } from '@/lib/client';

/** Экран вечера, у которого ещё нет кадров: черновик, оплаченный вечер до съёмки, пустой пул. */
export default function PreEvent({
  title,
  venue,
  when,
  cover,
  kind = 'draft',
  shareId,
}: {
  title: string;
  venue: string;
  when: string;
  cover: string;
  kind?: 'draft' | 'created';
  shareId?: string;
}) {
  const { done, copy } = useCopy();
  const [date, window] = when.includes(', ') ? when.split(', ') : [when, ''];

  return (
    <>
      <div className="cover">
        <div className="img2" style={{ backgroundImage: `url(${cover})` }} />
        <div className="grad" />
        <div className="bar2">
          <Link className="rb" href="/" aria-label="Назад на карту">
            ‹
          </Link>
        </div>
        <div className="txt">
          <div className="t">{title}</div>
          <div className="l">
            {venue} · {date}
            {window ? `, ${window}` : ''}
          </div>
          <div className="c">
            <span className="dot-wait" />
            {kind === 'created' ? 'оплачен, ссылка готова' : 'кадры ещё не залиты'}
          </div>
        </div>
      </div>

      <div className="pre">
        <div className="ph3">
          {kind === 'created' ? 'Вечер создан, кадров пока нет' : 'Фотограф ещё не отдал кадры'}
        </div>
        <div className="pd">
          {kind === 'created'
            ? 'Ссылку уже можно отправить в чат. Как только фотограф выложит пул, здесь появятся кадры — по времени съёмки, вместе с гостевыми.'
            : 'Вечер ещё не опубликован. Ссылка появится, когда фотограф отдаст пул, — обычно через две-три недели после съёмки. Отправлять её гостям раньше нечего.'}
        </div>

        {shareId && (
          <div className="prel">
            <span>event.photos/s/{shareId}</span>
            <button className="ghost2" onClick={() => copy(`https://event.photos/s/${shareId}`)}>
              {done ? 'Скопировано ✓' : 'Скопировать'}
            </button>
          </div>
        )}

        <div className="steps3">
          <div className="s3">
            <i>1</i>
            <div>
              <div className="t3">Фотограф снимает вечер</div>
              <div className="d3">Как обычно: без нашего участия и без гостевых ссылок.</div>
            </div>
          </div>
          <div className="s3">
            <i>2</i>
            <div>
              <div className="t3">Отдаёт пул одним архивом</div>
              <div className="d3">Папка целиком, не по одному кадру в переписке.</div>
            </div>
          </div>
          <div className="s3">
            <i>3</i>
            <div>
              <div className="t3">Страница оживает</div>
              <div className="d3">Кадры по времени съёмки; гости догружают свои по той же ссылке.</div>
            </div>
          </div>
        </div>

        <div className="prea">
          <Link className="p" href="/e/7kd2qf9xm/">
            Что бывает, когда кадры приехали
          </Link>
          <Link className="ghost2" href="/">
            На карту
          </Link>
        </div>

        <div className="prh">
          Пустой сетки и счётчиков из воздуха здесь нет: если открывать пока нечего, страница так и
          говорит.
        </div>
      </div>
    </>
  );
}
