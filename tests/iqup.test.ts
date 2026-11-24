import { beforeEach, describe, expect, it, vi } from 'vitest';
import { byId, cosmetics, exerciseStep, games, skillIds } from '../src/catalog';
import { calculate, generate, seeded, solutionCount, sudoku } from '../src/engine';
import { shapes, subjectGroups, subjects } from '../src/visuals';
import { activeProfile, badges, emptyProfile, dateKey, levelInfo, LocalStorageProvider, makePlan, offsetDate, quests, storageKey, streak, useData } from '../src/progress';

const sample = () => useData.getState().demo;
const personal = () => useData.getState().personal;
const add = (id:string,game:string,correct = 5,total = 5) => useData.getState().result({id,game,correct,total,level:2,duration:20});

beforeEach(() => {
  const store = new Map<string,string>();
  vi.stubGlobal('localStorage', {getItem:(key:string) => store.get(key) ?? null,setItem:(key:string,value:string) => store.set(key,value)});
  const initial = new LocalStorageProvider().load();
  useData.setState({...initial,account:undefined});
});

describe('game generators', () => {
  it('defines five real games per skill and 30 achievements', () => {
    expect(games).toHaveLength(25);
    expect(new Set(games.map(game => game.id)).size).toBe(25);
    for (const skill of skillIds) expect(games.filter(game => game.skill === skill)).toHaveLength(5);
    expect(badges).toHaveLength(30);
    expect(cosmetics).toHaveLength(24);
  });
  it('generates valid rounds in both languages across all ten difficulty levels', () => {
    for (const game of games) for (const lang of ['ru','en'] as const) for (let difficulty=1;difficulty<=10;difficulty++) {
      const round = generate(game.id,difficulty,lang,seeded(154+difficulty));
      if (round.answers.length) {
        expect(round.correct).toBeGreaterThanOrEqual(0);
        expect(round.correct).toBeLessThan(round.answers.length);
        expect(new Set(round.answers).size).toBe(round.answers.length);
      }
      if (round.selected) {
        expect(round.selected.length).toBeGreaterThan(0);
        expect(round.selected.every(index => index < (round.cells?.length ?? 0))).toBe(true);
      }
      if (round.code) expect(round.code).toMatch(/^\d+$/);
      if (round.deck) expect(round.deck.every(value => round.deck?.filter(item => item === value).length === 2)).toBe(true);
    }
  });
  it('generates recognizable photo sets with exactly one correct difference or outlier', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const difference = generate('difference',10,'ru',seeded(seed));
      expect(difference.cells?.flatMap((cell,index) => {
        expect(Object.hasOwn(subjects,cell.label)).toBe(true);
        return cell.label === difference.reference?.[index].label ? [] : [index];
      })).toEqual([difference.correct]);
      const odd = generate('odd',3,'en',seeded(seed));
      const groups = odd.answers.map(value => subjectGroups.findIndex(group => group.some(subject => subject === value)));
      expect(groups.every(group => group >= 0)).toBe(true);
      const answerGroup = groups[odd.correct];
      expect(groups.filter(group => group === answerGroup)).toHaveLength(1);
      expect(new Set(groups.filter(group => group !== answerGroup)).size).toBe(1);
    }
  });
  it('uses visible shapes in sequences and gives a matching filter sample', () => {
    for (let level = 1; level <= 10; level++) {
      const pattern = generate('shapes',level,'en',seeded(level));
      const sequence = pattern.pattern!;
      const size = level <= 2 ? 2 : level <= 5 ? 3 : 4;
      expect(sequence.every(shape => Object.hasOwn(shapes,shape))).toBe(true);
      expect(pattern.answers[pattern.correct]).toBe(sequence[sequence.length % size]);

      const filter = generate('filter',level,'en',seeded(level));
      expect(filter.selected).toEqual(filter.cells?.flatMap((cell,index) =>
        cell.label === filter.sampleShape && cell.color === filter.color && !cell.small ? [index] : []));
    }
  });
  it('starts all games at level one and reaches three increasing stages', () => {
    for (const game of games) {
      const steps = Array.from({length:game.rounds},(_,index) => exerciseStep(game,index));
      expect(steps[0]).toEqual({stage:1,difficulty:1});
      expect([...new Set(steps.map(step => step.stage))]).toEqual([1,2,3]);
      expect(steps.every((step,index) => index === 0 || steps[index-1].difficulty <= step.difficulty)).toBe(true);
    }
    expect([0,1,2,3,4,8].map(answered => exerciseStep(byId.sprint,answered).stage)).toEqual([1,1,2,2,3,3]);
  });
  it('grows the puzzle boards, memory tasks and timed target challenge at each stage', () => {
    const levels = [1,4,8];
    const rounds = (id:string) => levels.map((level,index) => generate(id,level,'en',seeded(112+index),index));
    expect(rounds('pairs').map(round => round.deck?.length)).toEqual([6,10,14]);
    expect(rounds('schulte').map(round => round.columns)).toEqual([3,4,5]);
    const puzzles = rounds('sudoku').map(round => round.puzzle!);
    expect(puzzles.map(puzzle => puzzle.size)).toEqual([4,4,6]);
    const blanks = puzzles.map(puzzle => puzzle.givens.filter(value => !value).length);
    expect(blanks[0]).toBeLessThan(blanks[1]);
    expect(blanks[1]).toBeLessThan(blanks[2]);
    expect(rounds('digits').map(round => round.code?.length)).toEqual([3,4,6]);
    expect(rounds('stroop').map(round => round.answers.length)).toEqual([2,3,4]);
    const [first,middle,last] = rounds('tap').map(round => round.wait!);
    expect(first).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(last);
  });
  it('has a solution for each generated target', () => {
    for (let seed=1;seed<=50;seed++) {
      const { numbers,goal } = generate('build',10,'en',seeded(seed));
      expect(numbers?.some(left => numbers.some(right => left !== right && ['+','−','×','÷'].some(op => calculate(left,right,op) === goal)))).toBe(true);
    }
  });
  it('creates 4×4 and 6×6 sudoku grids with valid unique solutions', () => {
    for (const level of [1,4,5,10]) for (let seed=1;seed<=12;seed++) {
      const { size,blockRows,blockCols,givens,solution } = sudoku(level,seeded(seed + 97));
      expect(solutionCount(givens,size,blockRows,blockCols)).toBe(1);
      expect(givens.every((value,index) => value === 0 || solution[index] === value)).toBe(true);
      for (let i=0;i<size;i++) {
        expect(new Set(solution.slice(i*size,(i+1)*size)).size).toBe(size);
        expect(new Set(solution.filter((_,index) => index%size === i)).size).toBe(size);
      }
      for (let row=0;row<size;row+=blockRows) for (let col=0;col<size;col+=blockCols) {
        const block=solution.filter((_,index) => Math.floor(index/size)>=row && Math.floor(index/size)<row+blockRows && index%size>=col && index%size<col+blockCols);
        expect(new Set(block).size).toBe(size);
      }
    }
  });
});

describe('progress and economy', () => {
  it('starts with a blank guest profile and preserves selected demo data without treating it as a guest profile', () => {
    const provider = new LocalStorageProvider();
    const initial = provider.load();
    expect(initial.mode).toBe('personal');
    expect(activeProfile(initial)).toEqual(emptyProfile());
    provider.save({...initial,mode:'demo',personal:{...initial.personal,xp:19}});
    expect(provider.load().mode).toBe('personal');
    expect(activeProfile(provider.load()).xp).toBe(19);
    provider.save({...initial,mode:'demo',onboarding:true});
    expect(activeProfile(provider.load()).name).toBe(initial.demo.name);
  });

  it('keeps account, personal and demo progress separate in the browser', () => {
    useData.getState().configure({mode:'personal'});
    const local = useData.getState().personal;
    const demo = useData.getState().demo;
    useData.setState({account:emptyProfile()});
    useData.getState().profile({name:'Cloud'});
    useData.getState().configure({sound:true});
    expect(activeProfile(useData.getState()).name).toBe('Cloud');
    expect(useData.getState().personal).toBe(local);
    expect(useData.getState().demo).toBe(demo);
    expect(JSON.parse(localStorage.getItem(storageKey)!).personal.name).toBe(local.name);
    useData.getState().configure({mode:'demo'});
    expect(activeProfile(useData.getState())).toBe(demo);
    useData.getState().configure({mode:'personal'});
    useData.setState({account:undefined});
    expect(activeProfile(useData.getState())).toBe(local);
  });

  it('handles thresholds and rollover for streaks', () => {
    expect(levelInfo(0)).toEqual({level:1,spent:0,needed:100});
    expect(levelInfo(100)).toEqual({level:2,spent:0,needed:125});
    expect(levelInfo(225)).toEqual({level:3,spent:0,needed:150});
    expect(streak([-1,-2,-5,-6,-7].map(day=>dateKey(offsetDate(day))))).toEqual({current:2,best:3});
  });
  it('awards each saved result once and separates personal progress from demo data', () => {
    const before = sample().xp;
    useData.getState().configure({mode:'personal'});
    expect(add('a','math')).toBeTruthy();
    const after = personal();
    expect(add('a','math')).toBeUndefined();
    expect(personal()).toEqual(after);
    expect(sample().xp).toBe(before);
    expect(new LocalStorageProvider().load().personal).toEqual(after);
  });
  it('stores one daily plan and pays only once after its games are completed', () => {
    useData.getState().configure({mode:'personal'});
    const plan = useData.getState().startPlan();
    useData.getState().profile({minutes:20,goals:['math']});
    expect(makePlan(personal()).games).toEqual(plan.games);
    expect(useData.getState().completeDaily()).toBe(false);
    plan.games.forEach((game,index) => add('daily'+index,game));
    expect(useData.getState().completeDaily()).toBe(true);
    expect(useData.getState().completeDaily()).toBe(false);
    expect(personal().completedDays).toEqual([dateKey()]);
    expect(personal().ledger.filter(item => item.label === 'daily')).toHaveLength(1);
  });
  it('rewards quests just once', () => {
    useData.getState().configure({mode:'personal'});
    add('m1','math'); add('m2','math'); add('m3','math');
    const quest = quests(personal()).find(value => value.id.endsWith('-play'))!;
    expect(useData.getState().claim(quest.id)).toBe(true);
    expect(useData.getState().claim(quest.id)).toBe(false);
  });
  it('owns and applies a theme without charging again or allowing negative balances', () => {
    useData.getState().configure({mode:'personal'});
    expect(useData.getState().buy('peach')).toBe(false);
    useData.getState().profile({coins:180});
    expect(useData.getState().buy('peach')).toBe(true);
    expect(personal().coins).toBe(0);
    expect(useData.getState().buy('peach')).toBe(true);
    expect(personal().ledger.filter(item => item.label === 'purchase')).toHaveLength(1);
  });
  it('migrates v0.2 local data and recovers broken v0.3 data', () => {
    localStorage.setItem('iqup_mvp_progress_v2',JSON.stringify({xp:91,coins:40,skin:'ocean',owned:['ocean'],history:[{type:'math',day:'2026-11-23',xp:20}]}));
    const migrated = new LocalStorageProvider().load();
    expect(migrated.mode).toBe('personal');
    expect(migrated.personal.xp).toBe(91);
    expect(migrated.personal.history[0].game).toBe(byId.math.id);
    localStorage.setItem(storageKey,'{invalid');
    expect(new LocalStorageProvider().load().personal.xp).toBe(0);
  });
});
