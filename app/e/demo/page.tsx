'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import Missing from '@/components/Missing';
import PreEvent from '@/components/PreEvent';
import { readCreated, type Created } from '@/lib/client';
import { asset } from '@/lib/data';

/**
 * Вечер, созданный в демо: страницы у него нет (он живёт в localStorage), поэтому один статический
 * адрес на всех — /e/demo/?id=<id>. Раньше карточка кабинета вела на чужой вечер.
 */
export default function Page() {
  const [ev, setEv] = useState<Created | null | undefined>(undefined);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    const all = readCreated();
    setEv(id ? all.find((e) => e.id === id) ?? null : all[0] ?? null);
  }, []);

  if (ev === undefined) {
    return (
      <Shell active="Вечер" title="Вечер" caption="Открываем демо-вечер…" note={<>Демо-вечер живёт в браузере.</>}>
        <div className="miss">
          <div className="mt">Открываем вечер</div>
        </div>
      </Shell>
    );
  }

  if (ev === null) {
    return (
      <Shell
        active="Вечер"
        title="Вечер"
        caption="Демо-вечер создаётся оплатой: заведите его заново — минута."
        note={
          <>
            <b>Демо-вечер живёт в браузере.</b> Другой браузер, приватное окно или чистка данных —
            и адрес остаётся, а вечера нет. Поэтому здесь не «not found», а путь назад.
          </>
        }
      >
        <Missing
          title="Демо-вечер не найден"
          text="Его создают на экране «Новый вечер»: четыре поля и оплата в демо-режиме."
        />
      </Shell>
    );
  }

  return (
    <Shell
      active="Вечер"
      title="Вечер"
      caption="Ссылка создана, кадров ещё нет: гость видит дату и площадку, а не выдуманную сетку."
      note={
        <>
          <b>Так выглядит вечер сразу после оплаты.</b> Фотограф ещё не выложил пул — страница
          честно говорит, что кадры приедут, и даёт ссылку для чата.
        </>
      }
    >
      <PreEvent
        title={ev.title}
        venue={ev.venue}
        when={ev.when}
        cover={ev.cover ?? asset('/img/p4.jpg')}
        kind="created"
        shareId={ev.id}
      />
    </Shell>
  );
}
