import Shell from '@/components/Shell';
import { cabinet, frames, sources } from '@/lib/data';

export default function Page() {
  return (
    <Shell
      active="Кабинет"
      title="Кабинет"
      caption="Что видит фотограф после вечера: сколько кадров, сколько раз скачали, кто смотрел и сколько заплачено. Три вечера, две оплаты, один черновик."
      note={
        <>
          <b>Что проверить.</b> Видно ли из этой цифры, что сервис приносит пользу? Готов ли
          фотограф платить 690 ₽ за вечер с таким отчётом?
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

        {cabinet.events.map((e) => (
          <div className="ev" key={e.id}>
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
          </div>
        ))}

        <div className="pay">
          <div className="t">Новый вечер — 690 ₽</div>
          <div className="d">
            До 40 ГБ, 90 дней, видео 1080p, отчёт охвата. Первый вечер в сервисе бесплатно.
          </div>
          <div className="b">
            <button className="p">Создать вечер</button>
            <button className="s">Отчёт</button>
          </div>
        </div>

        <div style={{ height: 52 }} />
      </div>
    </Shell>
  );
}
