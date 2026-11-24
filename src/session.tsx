import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleHelp, Clock3, Coins, Flag, Lightbulb, Pause, Play, RotateCcw, Share2, Sparkles, Target } from 'lucide-react';
import { byId, exerciseLevelCount, exerciseStep, local, skills, type Lang } from './catalog';
import { calculate, generate, ink, type Round } from './engine';
import { ColorSwatch, ExerciseArt, exerciseLabel, preparePhotos } from './exercise-art';
import { coreShapes, photoGames } from './visuals';
import { accuracy, useData, type Result } from './progress';
import { feedback, shareResultImage } from './telegram';
import { asset } from './ui';

export type Queue = { kind: 'daily'|'career'|'free'|'placement'; games: readonly string[]; chapter?: number };
type Answer = { correct: number; total: number; time?: number };
type TrialProps = { id: string; level: number; question: Round; lang: Lang; paused: boolean; finished: (answer: Answer) => void };

function useTimer(callback: () => void, delay: number | null, paused: boolean, token: string | number = 0) {
  const callbackRef = useRef(callback);
  const remaining = useRef(delay);
  useEffect(() => { callbackRef.current = callback; });
  useEffect(() => { remaining.current = delay; },[delay,token]);
  useEffect(() => {
    if (delay === null || paused || remaining.current === null) return;
    const start = performance.now();
    const timer = window.setTimeout(() => { remaining.current = null; callbackRef.current(); },Math.max(0,remaining.current));
    return () => {
      window.clearTimeout(timer);
      if (remaining.current !== null) remaining.current -= performance.now() - start;
    };
  },[delay,paused,token]);
}
const say = (lang: Lang, ru: string, en: string) => local([ru,en],lang);
const same = (a: number[], b: number[]) => a.length === b.length && a.every(item => b.includes(item));
const mark = (success: boolean): Answer => ({ correct: Number(success), total: 1 });
const colorStyle = (color?: string): CSSProperties => ({ color });
const grid = (columns = 4): CSSProperties => ({ gridTemplateColumns:`repeat(${columns},minmax(0,1fr))` });
function visualLabel(value: string,lang: Lang,color?: string) {
  const inkColor = ink.find(entry => entry.value === color);
  return [exerciseLabel(value,lang),inkColor && local(inkColor.label,lang)].filter(Boolean).join(', ');
}

function Prompt({ children,hint,color }: { children: ReactNode; hint?: string; color?: string }) {
  return <div className="game-prompt">{hint && <p>{hint}</p>}<h2 style={colorStyle(color)}>{children}</h2></div>;
}
function Choice({ id,level,question,lang,paused,finished }: TrialProps) {
  const [selected,setSelected] = useState<number>();
  const done = selected !== undefined;
  const matched = selected === question.correct;
  const baseLimit = byId[id].limit;
  const duration = baseLimit === undefined ? null : baseLimit + 1000 - level * 220;
  useTimer(() => setSelected(-1),duration && !done ? duration : null,paused);
  useTimer(() => finished(mark(matched)),done ? question.explanation ? 1100 : 420 : null,paused);
  const cells = question.cells;
  return <>
    {question.sampleShape ? <div className="visual-sample">
      <Prompt>{question.hint}</Prompt>
      <div className="shape-stage" role="img" aria-label={visualLabel(question.sampleShape,lang,question.color)}>
        <ExerciseArt value={question.sampleShape} color={question.color} lang={lang}/>
      </div>
    </div> : <Prompt hint={question.hint} color={question.color}>{question.prompt}</Prompt>}
    {question.pattern && <div className="shape-pattern" style={grid(question.pattern.length + 1)}>
      {question.pattern.map((shape,index) => <div key={index} className="pattern-piece" role="img" aria-label={exerciseLabel(shape,lang)}><ExerciseArt value={shape} lang={lang}/></div>)}
      <div className="pattern-missing" aria-label={say(lang,'Пропуск','Missing shape')}>?</div>
    </div>}
    {duration && !done && <div className="game-timer-rail" aria-hidden="true"><i style={{ animationDuration:`${duration}ms`,animationPlayState:paused ? 'paused':'running' }}/></div>}
    {cells ? <div className={question.reference ? 'pair-grids' : 'single-grid'} data-columns={question.columns}>
      {question.reference && <div className="game-grid" style={grid(question.columns)} role="group" aria-label={say(lang,'Первая сетка','First grid')}>
        {question.reference.map((cell,index) => <div className="tile photo-tile static" key={index} role="img" aria-label={`${index + 1}. ${exerciseLabel(cell.label,lang)}`}><ExerciseArt value={cell.label} lang={lang}/></div>)}
      </div>}
      <div className="game-grid" style={grid(question.columns)} role={question.reference ? 'group' : undefined} aria-label={question.reference ? say(lang,'Вторая сетка','Second grid') : undefined}>{cells.map((cell,index) =>
        <button key={index} disabled={done} className={`tile ${question.reference ? 'photo-tile' : ''} ${done && index === question.correct ? 'positive' : ''} ${selected === index && !matched ? 'negative' : ''}`}
          aria-label={question.reference ? `${index + 1}. ${exerciseLabel(cell.label,lang)}` : cell.label} onClick={() => setSelected(index)}><ExerciseArt value={cell.label} lang={lang}/></button>)}</div>
    </div> : <div className={`answer-grid ${id === 'odd' ? 'photo-answers' : ''}`}>{question.answers.map((answer,index) => <button
      className={`answer ${id === 'odd' ? 'photo-tile' : ''} ${question.answerColors ? 'swatch-answer' : ''} ${done && index === question.correct ? 'positive' : ''} ${selected === index && !matched ? 'negative' : ''}`}
      aria-label={exerciseLabel(answer,lang)} key={answer} disabled={done} onClick={() => setSelected(index)}>
      {question.answerColors && <ColorSwatch color={question.answerColors[index]}/>}<ExerciseArt value={answer} lang={lang}/>
    </button>)}</div>}
    {done && question.explanation && <p className="feedback">{question.explanation}</p>}
  </>;
}

function Digits({ question,level,lang,paused,finished }: TrialProps) {
  const [show,setShow] = useState(true);
  const [typed,setTyped] = useState('');
  const delay = Math.max(1600,2400 + (question.code?.length ?? 0) * 180 - level * 100);
  useTimer(() => setShow(false),show ? delay : null,paused);
  return <><Prompt hint={show ? say(lang,'Запомни цифры','Remember the digits') : say(lang,'Введи код по памяти','Enter the code from memory')}>{show ? question.code : '•'.repeat(question.code?.length ?? 0)}</Prompt>
    {!show && <form className="game-form" onSubmit={event => { event.preventDefault(); finished(mark(typed === question.code)); }}>
      <input aria-label={say(lang,'Код','Code')} autoFocus type="text" inputMode="numeric" pattern="[0-9]*" maxLength={question.code?.length} value={typed} onChange={event => setTyped(event.target.value.replace(/\D/g,''))}/>
      <button className="primary" disabled={!typed}>{say(lang,'Проверить','Check')}</button>
    </form>}
  </>;
}

function Colors({ question,level,lang,paused,finished }: TrialProps) {
  const [cursor,setCursor] = useState(0);
  const [taps,setTaps] = useState<number[]>([]);
  const sequence = question.sequence ?? [];
  const watching = cursor < sequence.length * 2;
  const active = watching && cursor % 2 === 0 ? sequence[Math.floor(cursor / 2)] : -1;
  useTimer(() => setCursor(value => value + 1),watching ? cursor % 2 === 0 ? Math.max(250,560 - level * 22) : 180 : null,paused,cursor);
  return <><Prompt>{watching ? say(lang,'Смотри на плитки','Watch the tiles') : `${say(lang,'Повтори порядок','Repeat the pattern')} · ${taps.length}/${sequence.length}`}</Prompt>
    <div className="game-grid color-grid" style={grid(2)}>{ink.map((color,index) => <button key={color.value} disabled={watching} aria-label={local(color.label,lang)}
      className={`tile color-tile ${active === index ? 'lit' : ''}`} style={{'--tile-color':color.value} as CSSProperties} onClick={() => {
        if (sequence[taps.length] !== index) return finished(mark(false));
        if (taps.length + 1 === sequence.length) return finished(mark(true));
        setTaps([...taps,index]);
      }}><ExerciseArt value={coreShapes[index]} color={active === index ? '#20202a' : color.value} lang={lang}/></button>)}</div></>;
}

function Selection({ id,level,question,lang,paused,finished }: TrialProps) {
  const [show,setShow] = useState(id !== 'filter');
  const [hits,setHits] = useState<number[]>([]);
  const target = question.selected ?? [];
  useTimer(() => setShow(false),show ? 3700 - level * 170 : null,paused);
  return <>
    <Prompt>{question.prompt || (show ? say(lang,'Запомни выделенное','Remember the highlighted items') : say(lang,'Выбери по памяти','Select from memory'))}</Prompt>
    {question.sampleShape && <div className="shape-stage selection-sample" role="img" aria-label={visualLabel(question.sampleShape,lang,question.color)}>
      <ExerciseArt value={question.sampleShape} color={question.color} lang={lang}/>
    </div>}
    <div className="game-grid single-grid" style={grid(question.columns)}>{question.cells?.map((cell,index) => {
      const active = show ? target.includes(index) : hits.includes(index);
      const concealed = id === 'objects' && show && !active;
      const label = concealed || !cell.label ? say(lang,'Клетка','Cell') : visualLabel(cell.label,lang,cell.color);
      return <button disabled={show} key={index} className={`tile ${id === 'objects' ? 'photo-tile' : ''} ${active ? 'picked' : ''}`}
        aria-pressed={active} aria-label={`${index + 1}. ${label}${cell.small ? say(lang,', малая фигура',', small shape') : ''}`}
        onClick={() => setHits(hits.includes(index) ? hits.filter(item => item !== index) : [...hits,index])}>
        {!concealed && <ExerciseArt value={cell.label} color={cell.color} small={cell.small} lang={lang}/>}
      </button>;
    })}</div>
    {!show && <button className="primary centered" onClick={() => finished(mark(same(hits,target)))}>{say(lang,'Проверить','Check')}</button>}
  </>;
}

function Pairs({ question,paused,lang,finished }: TrialProps) {
  const [open,setOpen] = useState<number[]>([]);
  const [matches,setMatches] = useState<number[]>([]);
  const [turns,setTurns] = useState(0);
  const deck = question.deck ?? [];
  useTimer(() => setOpen([]),open.length === 2 ? 620 : null,paused);
  function flip(index: number) {
    if (!open.length) return setOpen([index]);
    if (open.length !== 1 || open[0] === index) return;
    const next = [...open,index];
    const attempts = turns + 1;
    setTurns(attempts);
    if (deck[open[0]] !== deck[index]) return setOpen(next);
    const found = [...matches,...next];
    setMatches(found);
    setOpen([]);
    if (found.length === deck.length) finished({ correct:deck.length / 2,total:attempts });
  }
  return <><Prompt>{say(lang,'Найди все пары','Find all pairs')} · {matches.length / 2}/{deck.length / 2}</Prompt>
    <div className="game-grid single-grid" style={grid(question.columns)}>{deck.map((item,index) => {
      const found = matches.includes(index);
      const visible = found || open.includes(index);
      return <button key={index} className={`tile photo-tile ${found ? 'positive' : visible ? 'picked' : 'pair-hidden'}`} disabled={found || open.length === 2}
        aria-label={visible ? exerciseLabel(item,lang) : `${say(lang,'Карточка','Card')} ${index + 1}`} onClick={() => flip(index)}>{visible ? <ExerciseArt value={item} lang={lang}/> : <span className="playing-card-back" aria-hidden="true"/>}</button>;
    })}</div></>;
}

function Schulte({ question,lang,finished }: TrialProps) {
  const [next,setNext] = useState(1);
  const [mistakes,setMistakes] = useState(0);
  const cells = question.cells ?? [];
  return <><Prompt>{say(lang,'Следующее число','Next number')} · {next}</Prompt><div className="game-grid single-grid" style={grid(question.columns)}>
    {cells.map(cell => {
      const value = Number(cell.label);
      return <button key={cell.label} disabled={value < next} className={`tile ${value < next ? 'positive' : ''}`} onClick={() => {
        if (value !== next) return setMistakes(mistakes + 1);
        if (value === cells.length) return finished({correct:value,total:value + mistakes});
        setNext(next + 1);
      }}>{cell.label}</button>;
    })}</div></>;
}

function Sudoku({ question,lang,finished }: TrialProps) {
  const puzzle = question.puzzle!;
  const [board,setBoard] = useState([...puzzle.givens]);
  const [notes,setNotes] = useState<Record<number,number[]>>({});
  const [noteMode,setNoteMode] = useState(false);
  const [selected,setSelected] = useState(puzzle.givens.indexOf(0));
  const [penalties,setPenalties] = useState(0);
  const [message,setMessage] = useState('');
  const blanks = puzzle.givens.filter(value => !value).length;
  function put(value: number, hint = false) {
    if (selected < 0 || puzzle.givens[selected]) return;
    if (noteMode && value && !hint) {
      const previous = notes[selected] ?? [];
      setNotes({ ...notes,[selected]:previous.includes(value) ? previous.filter(item => item !== value) : [...previous,value].sort() });
      return;
    }
    const next = [...board];
    next[selected] = value;
    setBoard(next);
    const errors = penalties + Number(hint);
    setPenalties(errors);
    setMessage('');
    if (next.every((item,index) => item === puzzle.solution[index])) finished({ correct:blanks,total:blanks + errors });
    else if (next.every(Boolean)) {
      setPenalties(errors + 1);
      setMessage(say(lang,'В заполнении есть ошибки.','Some values need a second look.'));
    }
  }
  return <><Prompt>{puzzle.size} × {puzzle.size}</Prompt>
    <div className="game-grid single-grid sudoku" style={grid(puzzle.size)}>{board.map((value,index) => {
      const colBorder = index % puzzle.size === puzzle.blockCols;
      const rowBorder = Math.floor(index / puzzle.size) % puzzle.blockRows === 0 && index >= puzzle.size;
      return <button className={`tile ${puzzle.givens[index] ? 'given' : ''} ${selected === index ? 'picked' : ''} ${colBorder ? 'col-block' : ''} ${rowBorder ? 'row-block' : ''}`} key={index}
        aria-label={`${say(lang,'Клетка','Cell')} ${index + 1}`} disabled={Boolean(puzzle.givens[index])} onClick={() => setSelected(index)}>{value || <small>{(notes[index] ?? []).join(' ')}</small>}</button>;
    })}</div>
    <div className="game-tools">{Array.from({length:puzzle.size},(_,at) => <button className="secondary" key={at} onClick={() => put(at + 1)}>{at + 1}</button>)}</div>
    <div className="game-tools"><button className="secondary" aria-pressed={noteMode} onClick={() => setNoteMode(!noteMode)}>{say(lang,'Заметки','Notes')}</button>
      <button className="secondary" onClick={() => put(0)}>{say(lang,'Стереть','Erase')}</button><button className="secondary" onClick={() => put(puzzle.solution[selected],true)}><Lightbulb size={16}/>{say(lang,'Подсказка','Hint')}</button></div>
    {message && <p className="feedback" role="status">{message}</p>}</>;
}

function Signal({ id,level,question,lang,paused,finished }: TrialProps) {
  const [lit,setLit] = useState(false);
  const start = useRef(0);
  const pauseStart = useRef<number | null>(null);
  const go = question.signal === true;
  useEffect(() => {
    if (paused) pauseStart.current = performance.now();
    else if (pauseStart.current !== null) {
      start.current += performance.now() - pauseStart.current;
      pauseStart.current = null;
    }
  },[paused]);
  useTimer(() => { start.current = performance.now(); setLit(true); },lit ? null : (question.wait ?? 1500),paused);
  useTimer(() => finished(mark(id === 'traffic' && !go)),lit ? Math.max(550,1450 - level * 65) : null,paused);
  return <button className={`signal-zone ${lit ? go ? 'green-signal' : 'red-signal' : ''}`} onClick={() => finished(lit && go ? { ...mark(true),time:Math.round(performance.now() - start.current) } : mark(false))}>
    <span className={`signal-lights ${id === 'traffic' ? 'traffic-lights' : ''}`} data-light={lit ? go ? 'go' : 'stop' : 'wait'} aria-hidden="true">
      {id === 'traffic' && <i/>}<i/>{id === 'traffic' && <i/>}
    </span>
    <strong>{lit ? go ? say(lang,'Нажми!','Tap now!') : say(lang,'Не нажимай','Do not tap') : say(lang,'Жди сигнала…','Wait for it…')}</strong>
  </button>;
}

function Catch({ question,lang,paused,finished }: TrialProps) {
  const [visible,setVisible] = useState(false);
  useTimer(() => setVisible(true),visible ? null : 260,paused);
  useTimer(() => finished(mark(false)),visible ? question.wait ?? 1200 : null,paused);
  return <><Prompt>{say(lang,'Дождись цели','Watch for the target')}</Prompt><div className="game-grid single-grid" style={grid(question.columns)}>
    {question.cells?.map((_,index) => <button className={`tile ${visible && index === question.correct ? 'target-tile' : ''}`} key={index}
      aria-label={`${say(lang,'Клетка','Cell')} ${index + 1}`} disabled={!visible} onClick={() => finished(mark(index === question.correct))}>{visible && index === question.correct && <span className="target-disc" aria-hidden="true"/>}</button>)}</div></>;
}

function Equation({ question,lang,finished }: TrialProps) {
  const [selection,setSelection] = useState<number[]>([]);
  const [operator,setOperator] = useState('+');
  const [left,right] = selection;
  return <><Prompt hint={say(lang,'Целевое число','Target number')}>{question.goal}</Prompt>
    <div className="answer-grid">{question.numbers?.map(number => <button key={number} className={`answer ${selection.includes(number) ? 'picked' : ''}`} aria-pressed={selection.includes(number)}
      onClick={() => setSelection(selection.includes(number) ? selection.filter(value => value !== number) : selection.length < 2 ? [...selection,number] : [number])}>{number}</button>)}</div>
    <div className="game-tools">{['+','−','×','÷'].map(symbol => <button key={symbol} className="secondary" aria-pressed={operator === symbol} onClick={() => setOperator(symbol)}>{symbol}</button>)}</div>
    <div className="game-tools"><span className="equation-label">{left ?? '?'} {operator} {right ?? '?'} = {question.goal}</span><button className="primary" disabled={selection.length !== 2}
      onClick={() => finished(mark(calculate(left,right,operator) === question.goal))}>{say(lang,'Проверить','Check')}</button></div></>;
}

const trials = { choice:Choice, digits:Digits, pairs:Pairs, colors:Colors, spatial:Selection, objects:Selection, sudoku:Sudoku, schulte:Schulte, signal:Signal, target:Catch, traffic:Signal, equation:Equation };

export function Session({ queue,onClose }: { queue: Queue; onClose: () => void }) {
  const state = useData();
  const { lang } = state;
  const [position,setPosition] = useState(0);
  const [results,setResults] = useState<Result[]>([]);
  const [complete,setComplete] = useState(false);
  const [attempt,setAttempt] = useState(0);
  const game = byId[queue.games[position]];
  const result = results[position];
  function saveSession(value: Result) {
    const updated = [...results.slice(0,position),value];
    setResults(updated);
    if (position + 1 !== queue.games.length) return;
    if (queue.kind === 'daily') state.completeDaily();
    if (queue.kind === 'career' && queue.chapter !== undefined) state.career(queue.chapter,updated.map(item => item.id));
  }
  function continueSession() {
    if (position + 1 < queue.games.length) {
      setPosition(position + 1);
      return;
    }
    setComplete(true);
  }
  return <div className="session-shell">
    <button className="text-link return-link" onClick={onClose}><ArrowLeft size={19}/>{say(lang,'Назад','Back')}</button>
    {queue.games.length > 1 && <div className="session-steps">{queue.games.map((id,index) => <span key={id+index} className={index <= position ? 'active' : ''}/>)}</div>}
    {complete ? <section className="card game-card result-card"><div className="result-icon"><Flag/></div><h1>{say(lang,'Тренировка завершена!','Workout complete!')}</h1>
      <p>{say(lang,'Результаты сохранены в профиле.','Your results are saved to your profile.')}</p>
      <div className="result-stats"><div><Sparkles/><strong>+{results.reduce((sum,item) => sum + item.xp,0)} XP</strong></div><div><Target/><strong>{accuracy({ correct:results.reduce((sum,item) => sum + item.correct,0),total:results.reduce((sum,item) => sum + item.total,0) })}%</strong></div></div>
      <button className="primary" onClick={onClose}>{say(lang,'Готово','Done')} <Check size={20}/></button></section>
      : result ? <section className="card game-card result-card"><div className="result-icon"><Sparkles/></div><h1>{say(lang,'Упражнение завершено!','Exercise complete!')}</h1><p>{local(game.name,lang)}</p>
        <div className="result-stats"><div><Target/><strong>{accuracy(result)}%</strong><span>{say(lang,'Точность','Accuracy')}</span></div><div><Coins/><strong>+{result.xp} XP</strong><span>{say(lang,'За упражнение','Exercise XP')}</span></div>
          {result.reaction !== undefined && <div><Clock3/><strong>{result.reaction} ms</strong><span>{say(lang,'Реакция','Reaction')}</span></div>}</div>
        <div className="game-tools"><button className="secondary" onClick={() => void shareResultImage(local(game.name,lang), result.reaction !== undefined ? result.reaction+' ms' : accuracy(result)+'%', result.record ? say(lang,'Личный рекорд','Personal best') : '',asset('orbit.webp'))}><Share2 size={17}/>{say(lang,'Карточка','Share card')}</button>
          <button className="secondary" onClick={() => { setResults(results.slice(0,position)); setAttempt(attempt + 1); }}><RotateCcw size={17}/>{say(lang,'Ещё раз','Try again')}</button>
          <button className="primary" onClick={queue.games.length === 1 ? onClose : continueSession}>{say(lang,'Дальше','Continue')}<ArrowRight size={20}/></button></div></section>
        : <ActiveGame key={game.id + position + '-' + attempt} id={game.id} lang={lang} onResult={saveSession}/>}
  </div>;
}

function ActiveGame({ id,lang,onResult }: { id: string; lang: Lang; onResult: (result: Result) => void }) {
  const game = byId[id];
  const [stage,setStage] = useState<'rules'|'practice'|'playing'>('rules');
  const [paused,setPaused] = useState(false);
  const [question,setQuestion] = useState<Round>();
  const [answers,setAnswers] = useState<Answer[]>([]);
  const [remaining,setRemaining] = useState(25);
  const [reset,setReset] = useState(0);
  const [photosReady,setPhotosReady] = useState(!photoGames.includes(id));
  const start = useRef(0);
  const pauseStart = useRef(0);
  const idRef = useRef('');
  const done = useRef(false);
  const step = exerciseStep(game,answers.length);
  const Trial = trials[game.mode];
  const { icon: SkillIcon,color,background } = skills[game.skill];

  useEffect(() => {
    if (!photoGames.includes(id)) return;
    let current = true;
    void preparePhotos().then(() => { if (current) setPhotosReady(true); });
    return () => { current = false; };
  },[id]);

  function begin(practice = false) {
    idRef.current = globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random()}`;
    start.current = performance.now();
    done.current = false;
    setQuestion(generate(id,exerciseStep(game,0).difficulty,lang));
    setAnswers([]);
    setRemaining(25);
    setPaused(false);
    setReset(value => value + 1);
    setStage(practice ? 'practice' : 'playing');
  }
  function end(values: Answer[]) {
    if (done.current) return;
    done.current = true;
    const times = values.flatMap(value => value.time !== undefined ? [value.time] : []);
    const data = useData.getState();
    const completedStep = exerciseStep(game,Math.max(0,values.length - 1));
    const result = data.result({ id:idRef.current,game:id,level:completedStep.difficulty,stage:completedStep.stage,correct:values.reduce((sum,value) => sum + value.correct,0),
      total:values.reduce((sum,value) => sum + value.total,0),duration:Math.max(1,(performance.now() - start.current) / 1000),
      ...(times.length && { reaction:Math.round(times.reduce((sum,value) => sum + value,0) / times.length) }) });
    if (result) onResult(result);
  }
  function add(answer: Answer) {
    if (done.current) return;
    const preferences = useData.getState();
    feedback(answer.correct === answer.total,preferences.sound,preferences.haptics);
    if (stage === 'practice') {
      setStage('rules');
      return;
    }
    const next = [...answers,answer];
    if (next.length >= game.rounds) return end(next);
    const { difficulty } = exerciseStep(game,next.length);
    let upcoming = generate(id,difficulty,lang,Math.random,next.length);
    for (let retries = 0; retries < 3 && JSON.stringify(upcoming) === JSON.stringify(question); retries++) upcoming = generate(id,difficulty,lang,Math.random,next.length);
    setQuestion(upcoming);
    setAnswers(next);
  }
  useTimer(() => {
    setRemaining(remaining - 1);
    if (remaining <= 1) end(answers);
  },stage === 'playing' && id === 'sprint' ? 1000 : null,paused,remaining);
  function togglePause() {
    if (paused) start.current += performance.now() - pauseStart.current;
    else pauseStart.current = performance.now();
    setPaused(!paused);
  }

  if (stage === 'rules') return <section className="card game-card rules-card">
    <div className="result-icon" style={{color,background}}><SkillIcon/></div><h1>{local(game.name,lang)}</h1><p>{local(game.rule,lang)}</p>
    <p className="progression-note">{say(lang,'Три уровня. Задания постепенно усложняются.','Three levels. Exercises get harder as you go.')}</p>
    <div className="game-tools"><button className="secondary" disabled={!photosReady} onClick={() => begin(true)}><CircleHelp size={18}/>{say(lang,'Попробовать','Practice')}</button><button className="primary" disabled={!photosReady} onClick={() => begin()}><Play size={17}/>{photosReady ? say(lang,'Начать игру','Start game') : say(lang,'Загрузка изображений…','Loading images…')}</button></div>
  </section>;

  return <section className="card game-card play-card">
    <div className="play-top"><div><h1>{local(game.name,lang)}</h1>
      <div className="play-status">
        {stage === 'practice' ? <small>{say(lang,'Пробный раунд','Practice round')}</small> : <>
          <small className="exercise-level" role="status">{say(lang,`Уровень ${step.stage} из ${exerciseLevelCount}`,`Level ${step.stage} of ${exerciseLevelCount}`)}</small>
          {id === 'sprint' ? <small>{say(lang,`${remaining} с · Ответов: ${answers.length}`,`${remaining} s · Answers: ${answers.length}`)}</small>
            : game.rounds !== exerciseLevelCount && <small>{say(lang,`Раунд ${answers.length + 1} из ${game.rounds}`,`Round ${answers.length + 1} of ${game.rounds}`)}</small>}
        </>}
      </div></div>
      <div className="game-tools compact"><button className="icon-button" aria-label={say(lang,'Заново','Restart')} onClick={() => begin(stage === 'practice')}><RotateCcw size={18}/></button>
        <button className="icon-button" aria-label={say(lang,'Пауза','Pause')} onClick={togglePause}>{paused ? <Play size={18}/> : <Pause size={18}/>}</button></div></div>
    <div className="progress-bar"><span style={{width:`${id === 'sprint' && stage === 'playing' ? remaining * 4 : answers.length / game.rounds * 100}%`}}/></div>
    <div className="trial-space">
      {question && <div inert={paused} aria-hidden={paused || undefined} className={paused ? 'paused-trial' : ''}><Trial key={`${reset}-${answers.length}`} id={id} question={question} level={step.difficulty} lang={lang} paused={paused} finished={add}/></div>}
      {paused && <div className="pause-layer"><Pause size={32}/><h2>{say(lang,'Пауза','Paused')}</h2><button className="primary" onClick={togglePause}>{say(lang,'Продолжить','Resume')}</button></div>}
    </div>
  </section>;
}
