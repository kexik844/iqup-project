import { Cloud, RefreshCw, Send } from 'lucide-react';
import { type Lang } from './catalog';
import { importLocal, resolveConflict, syncCloud, useCloud } from './cloud';
import { telegram, telegramAppUrl } from './telegram';
import { l } from './ui';

export function CloudPanel({lang}: {lang:Lang}) {
  const cloud = useCloud();
  const say = (ru:string,en:string) => l(lang,ru,en);
  const messages = {
    checking:say('Входим через Telegram…','Signing in with Telegram…'),
    setup:say('Облачное сохранение станет доступно после настройки Supabase.','Cloud saves will be available after Supabase is set up.'),
    'signed-out':say('Открой IQUP в Telegram, чтобы сохранять прогресс между устройствами.','Open IQUP in Telegram to sync your progress across devices.'),
    loading:say('Загружаем прогресс…','Loading progress…'),
    saving:say('Синхронизируем прогресс…','Syncing progress…'),
    ready:say('Прогресс сохраняется в облаке.','Your progress is saved in the cloud.'),
    error:say('Не удалось подключиться к облаку. Попробуй ещё раз.','Could not connect to the cloud. Try again.'),
    reopen:say('Сеанс Telegram истёк или его не удалось подтвердить. Закрой IQUP и открой заново из чата с ботом.','Your Telegram session could not be verified. Close IQUP and reopen it from the bot chat.'),
    conflict:say('В облаке есть более новая версия. Выбери, какую копию сохранить.','A newer cloud copy exists. Choose which copy to keep.'),
  };
  return <section className="card dashboard-card settings-form cloud-panel">
    <div className="panel-heading"><span className="panel-icon mint"><Cloud size={21}/></span><div><h2>{say('Облачный прогресс','Cloud progress')}</h2>
      {cloud.user?.username && <p>@{cloud.user.username}</p>}</div></div>
    <p className="muted" role="status">{messages[cloud.phase]}</p>
    <div className="game-tools settings-actions">
      {cloud.phase === 'signed-out' && telegramAppUrl && <a className="primary" href={telegramAppUrl}><Send size={16}/>{say('Открыть в Telegram','Open in Telegram')}</a>}
      {['setup','error','ready'].includes(cloud.phase) && <button className="secondary" onClick={syncCloud}><RefreshCw size={16}/>{cloud.phase === 'ready' ? say('Синхронизировать','Sync now') : say('Попробовать ещё раз','Try again')}</button>}
      {cloud.phase === 'reopen' && <button className="secondary" onClick={() => telegram()?.close()}>{say('Закрыть IQUP','Close IQUP')}</button>}
      {cloud.canImport && <button className="primary" disabled={cloud.phase !== 'ready'} onClick={importLocal}>{say('Перенести гостевой прогресс с этого устройства','Import guest progress from this device')}</button>}
      {cloud.phase === 'conflict' && <>
        <button className="primary" onClick={() => resolveConflict(false)}>{say('Загрузить из облака','Use cloud copy')}</button>
        <button className="secondary" onClick={() => resolveConflict(true)}>{say('Сохранить версию устройства','Keep device copy')}</button>
      </>}
    </div>
  </section>;
}
