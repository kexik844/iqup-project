import { type Lang, local } from './catalog';
import { coreShapes, objectIds, shapeIds, subjectGroups, type Shape } from './visuals';

export type Random = () => number;
export function seeded(seed: number): Random {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export const int = (rng: Random, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
export function shuffle<T>(items: readonly T[], rng: Random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const next = int(rng, 0, index);
    [result[index], result[next]] = [result[next], result[index]];
  }
  return result;
}
const range = (size: number) => Array.from({ length: size }, (_, index) => index);
export const arrows = ['↑','→','↓','←'];
export const ink = [
  { value: '#ff858e', label: ['Красный','Red'] },
  { value: '#78bafa', label: ['Синий','Blue'] },
  { value: '#72dfb7', label: ['Зелёный','Green'] },
  { value: '#ffd27c', label: ['Жёлтый','Yellow'] },
] as const;
type Cell = { label: string; color?: string; small?: boolean };
export type Round = {
  prompt: string; hint?: string; answers: string[]; correct: number; color?: string; explanation?: string;
  cells?: Cell[]; reference?: Cell[]; columns?: number; sequence?: number[]; code?: string; selected?: number[];
  deck?: string[]; puzzle?: Puzzle; numbers?: number[]; goal?: number; signal?: boolean; wait?: number;
  sampleShape?: Shape; pattern?: Shape[]; answerColors?: readonly string[];
};

function options(answer: number, rng: Random) {
  const offsets = shuffle([-7,-4,-2,-1,1,2,3,6,9], rng).slice(0,3);
  const answers = shuffle([answer, ...offsets.map(offset => answer + offset)], rng);
  return { answers: answers.map(String), correct: answers.indexOf(answer) };
}

type Expression = { text: string; value: number };
function expression(level: number, rng: Random): Expression {
  const left = int(rng, level <= 2 ? 2 : 7, 7 + level * 3);
  const right = int(rng, level <= 2 ? 1 : 3, 4 + level * 2);
  const operations = level <= 2 ? 1 : level <= 5 ? 2 : 3;
  switch (int(rng, level >= 7 ? 2 : 0, operations)) {
    case 1: {
      const [a,b] = level <= 2 && left < right ? [right,left] : [left,right];
      return { text: `${a} − ${b}`, value: a - b };
    }
    case 2: return { text: `${left} × ${right}`, value: left * right };
    case 3: return { text: `${left * right} ÷ ${right}`, value: left };
    default: return { text: `${left} + ${right}`, value: left + right };
  }
}

export type Puzzle = { size: number; blockRows: number; blockCols: number; givens: number[]; solution: number[] };
export function solutionCount(values: number[], size: number, blockRows: number, blockCols: number, limit = 2): number {
  const board = [...values];
  function allowed(index: number, value: number) {
    const row = Math.floor(index / size);
    const col = index % size;
    for (let offset = 0; offset < size; offset++) {
      if (board[row * size + offset] === value || board[offset * size + col] === value) return false;
    }
    const firstRow = row - row % blockRows;
    const firstCol = col - col % blockCols;
    for (let dy = 0; dy < blockRows; dy++) {
      for (let dx = 0; dx < blockCols; dx++) {
        if (board[(firstRow + dy) * size + firstCol + dx] === value) return false;
      }
    }
    return true;
  }
  function solve(): number {
    let cell = -1;
    let candidates: number[] = [];
    for (let index = 0; index < board.length; index++) {
      if (board[index]) continue;
      const possible = range(size).map(value => value + 1).filter(value => allowed(index, value));
      if (!possible.length) return 0;
      if (cell < 0 || possible.length < candidates.length) {
        cell = index;
        candidates = possible;
      }
    }
    if (cell < 0) return 1;
    let count = 0;
    for (const value of candidates) {
      board[cell] = value;
      count += solve();
      board[cell] = 0;
      if (count >= limit) break;
    }
    return count;
  }
  return solve();
}

export function sudoku(level: number, rng: Random): Puzzle {
  const size = level >= 5 ? 6 : 4;
  const blockRows = 2;
  const blockCols = size / blockRows;
  const numbers = shuffle(range(size).map(value => value + 1), rng);
  const rows = shuffle(range(size / blockRows), rng).flatMap(band => shuffle(range(blockRows), rng).map(row => band * blockRows + row));
  const cols = shuffle(range(size / blockCols), rng).flatMap(stack => shuffle(range(blockCols), rng).map(col => stack * blockCols + col));
  const solution = rows.flatMap(row => cols.map(col => numbers[(row * blockCols + Math.floor(row / blockRows) + col) % size]));
  const givens = [...solution];
  let blanks = Math.min(size * size - size,size === 4 ? 3 + level : 6 + level);
  for (const index of shuffle(range(givens.length), rng)) {
    if (!blanks) break;
    givens[index] = 0;
    if (solutionCount(givens, size, blockRows, blockCols) === 1) blanks--;
    else givens[index] = solution[index];
  }
  return { size, blockRows, blockCols, givens, solution };
}

export function generate(id: string, level: number, lang: Lang, rng: Random = Math.random, index = 0): Round {
  const say = (ru: string, en: string) => local([ru,en], lang);
  const basic = { prompt: '', answers: [] as string[], correct: -1 };
  switch (id) {
    case 'digits': {
      const length = 2 + Math.ceil(level / 2);
      const code = range(length).map(() => int(rng,0,9)).join('');
      return { ...basic, prompt: say('Запомни код','Memorize the code'), code };
    }
    case 'pairs': {
      const pairs = shuffle(objectIds, rng).slice(0, 3 + Math.ceil((level - 1) / 2));
      return { ...basic, columns: pairs.length >= 8 ? 6 : 4, deck: shuffle([...pairs,...pairs],rng) };
    }
    case 'memory': return { ...basic, sequence: range(2 + Math.floor(level / 2)).map(() => int(rng,0,3)) };
    case 'spatial': {
      const columns = 3 + Math.floor(level / 4);
      return { ...basic, columns, cells: range(columns ** 2).map(() => ({ label: '' })), selected: shuffle(range(columns ** 2),rng).slice(0,2 + Math.floor(level / 2)) };
    }
    case 'objects': {
      const cells = shuffle(objectIds,rng).slice(0, 7 + Math.floor(level / 2)).map(label => ({ label }));
      return { ...basic, columns: 4, cells, selected: shuffle(range(cells.length),rng).slice(0,2 + Math.floor(level / 2)) };
    }
    case 'patterns': {
      const type = level >= 7 ? int(rng,1,2) : level >= 3 ? int(rng,0,1) * 2 : 0;
      const start = int(rng,2,level <= 2 ? 7 : 14);
      const step = int(rng,level <= 2 ? 1 : 2,level <= 2 ? 3 : 6 + level);
      const value = (at: number) => type === 1 ? start * 2 ** at : type === 2 ? start + Math.floor(at / 2) * (step + 2) + (at % 2) * step : start + at * step;
      return { prompt: `${range(5).map(value).join(' · ')} · ?`, ...options(value(5),rng) };
    }
    case 'odd': {
      const names = [say('фрукты и ягоды','fruit and berries'),say('животные','animals'),say('музыкальные инструменты','musical instruments')];
      const group = int(rng,0,2);
      const outlier = shuffle(subjectGroups[(group + int(rng,1,2)) % 3],rng)[0];
      const matchingCount = level <= 2 ? 2 : level <= 5 ? 3 : 4;
      const answers = shuffle([...shuffle(subjectGroups[group],rng).slice(0,matchingCount),outlier],rng);
      return { prompt: say('Какой предмет лишний?','Which object is different?'), answers, correct: answers.indexOf(outlier), explanation: say(`Остальные — ${names[group]}.`,`The others are ${names[group]}.`) };
    }
    case 'shapes': {
      const pattern = shuffle(shapeIds,rng).slice(0,level <= 2 ? 2 : level <= 5 ? 3 : 4);
      const length = pattern.length * 2 + int(rng,0,1);
      const expected = pattern[length % pattern.length];
      const answers = shuffle([expected, ...shuffle(shapeIds.filter(value => value !== expected),rng).slice(0,3)],rng);
      return { prompt: say('Что дальше?','What comes next?'), pattern:range(length).map(at => pattern[at % pattern.length]), answers, correct: answers.indexOf(expected) };
    }
    case 'statements': {
      const names = shuffle(lang === 'ru' ? ['Лея','Ника','Мира','Тая','Лина','Майя'] : ['Lea','Nika','Mira','Taya','Lina','Maya'],rng).slice(0,level <= 2 ? 2 : level <= 5 ? 3 : 4);
      const youngest = int(rng,0,1) === 1;
      const order = int(rng,0,1) === 1;
      const constraints = shuffle(names.slice(0,-1).map((name, at) => say(`${name} ${order ? 'старше' : 'младше'}, чем ${names[at+1]}.`,`${name} is ${order ? 'older' : 'younger'} than ${names[at+1]}.`)),rng);
      const answers = shuffle(names,rng);
      const expected = names[youngest === order ? names.length - 1 : 0];
      return { prompt: constraints.join(' '), hint: youngest ? say('Кто младше всех?','Who is the youngest?') : say('Кто старше всех?','Who is the oldest?'), answers, correct: answers.indexOf(expected) };
    }
    case 'sudoku': return { ...basic, puzzle: sudoku(level,rng) };
    case 'difference': {
      const columns = 3 + Math.floor(level / 3);
      const pool = shuffle(objectIds,rng).slice(0,4 + Math.floor(level / 2));
      const correct = int(rng,0,columns ** 2 - 1);
      const reference = range(columns ** 2).map(() => ({ label:pool[int(rng,0,pool.length - 1)] }));
      const alternatives = pool.filter(label => label !== reference[correct].label);
      const cells = reference.map((cell,at) => at === correct ? { label:alternatives[int(rng,0,alternatives.length - 1)] } : cell);
      return { ...basic,columns,cells,reference,correct,prompt:say('Что изменилось?','What changed?') };
    }
    case 'focus': {
      const columns = 3 + Math.floor(level / 3);
      const pair = shuffle([['O','Q'],['6','8'],['E','F'],['P','R']],rng)[0];
      const correct = int(rng,0,columns ** 2 - 1);
      const cells = range(columns ** 2).map(at => ({ label:at === correct ? pair[1] : pair[0] }));
      return { ...basic,columns,cells,correct,prompt:say(`Найди ${pair[1]}`,`Find ${pair[1]}`) };
    }
    case 'stroop': {
      const palette = shuffle(ink,rng).slice(0,level <= 2 ? 2 : level <= 5 ? 3 : 4);
      const correct = int(rng,0,palette.length - 1);
      const word = (correct + int(rng,1,palette.length - 1)) % palette.length;
      return { prompt: local(palette[word].label,lang), color: palette[correct].value, answers:palette.map(color => local(color.label,lang)), answerColors:palette.map(color => color.value), correct };
    }
    case 'schulte': {
      const columns = Math.min(6, 3 + Math.floor(level / 3));
      const cells = shuffle(range(columns ** 2).map(value => ({ label: String(value + 1) })),rng);
      return { ...basic, columns, cells };
    }
    case 'filter': {
      const color = int(rng,0,3);
      const shape = int(rng,0,3);
      const isMatch = (cell: Cell) => cell.label === coreShapes[shape] && cell.color === ink[color].value && !cell.small;
      const columns = 4 + Math.floor(level / 5);
      const distractors = range(7 + level).map(() => ({ label: coreShapes[int(rng,0,3)], color: ink[int(rng,0,3)].value, small: rng() > .5 }));
      const target = { label: coreShapes[shape], color: ink[color].value };
      const cells = shuffle([...distractors, target, { ...target }, { ...target, small: true }],rng);
      return { ...basic, columns, cells, color: target.color, sampleShape: target.label, prompt: say('Выбери большие фигуры по образцу','Select the large shapes that match'), selected: range(cells.length).filter(at => isMatch(cells[at])) };
    }
    case 'reaction': return { ...basic, signal: true, wait: int(rng,1000,3100) };
    case 'traffic': return { ...basic, signal: level <= 2 || (index !== 3 && rng() > .48), wait: int(rng,650,1700) };
    case 'tap': {
      const columns = 4 + Math.floor(level / 5);
      return { ...basic, columns, cells: range(columns ** 2).map(() => ({ label: '' })), correct: int(rng,0,columns ** 2 - 1), wait: Math.max(530,1650 - level * 105) };
    }
    case 'direction': {
      const direction = int(rng,0,3);
      const opposite = level >= 3 && (level >= 7 ? rng() > .28 : rng() > .62);
      return { prompt: arrows[direction], hint: opposite ? say('Противоположное направление','Opposite direction') : say('По направлению стрелки','Follow the arrow'), answers: arrows, correct: (direction + (opposite ? 2 : 0)) % 4 };
    }
    case 'quick': {
      const count = level <= 2 ? 2 : level <= 5 ? 3 : 4;
      const palette = shuffle(ink,rng).slice(0,count);
      const figures = shuffle(coreShapes,rng).slice(0,count);
      const correct = int(rng,0,count - 1);
      const byShape = rng() > .5;
      const other = int(rng,0,count - 1);
      return { prompt:'', sampleShape:figures[byShape ? correct : other], color:palette[byShape ? other : correct].value,
        hint:byShape ? say('Выбери форму','Choose the shape') : say('Выбери цвет','Choose the color'),
        answers:byShape ? figures : palette.map(value => local(value.label,lang)), answerColors:byShape ? undefined : palette.map(value => value.value), correct };
    }
    case 'missing': {
      const left = int(rng,2,level * 6 + 8);
      const right = int(rng,2,level + 8);
      const multiply = level >= 7 || (level > 4 && rng() > .5);
      return { prompt: `? ${multiply ? '×' : '+'} ${right} = ${multiply ? left * right : left + right}`, ...options(left,rng) };
    }
    case 'compare': {
      function number(value: number): Expression { return { text:String(value),value }; }
      const lhs = level <= 2 ? number(int(rng,1,12)) : expression(level,rng);
      const rhs = rng() > .7 ? number(lhs.value) : level <= 5 ? number(int(rng,1,12 + 3 * level)) : expression(level,rng);
      return { prompt: `${lhs.text}   ?   ${rhs.text}`, answers: ['<','=','>'], correct: Math.sign(lhs.value - rhs.value) + 1 };
    }
    case 'build': {
      const numbers = shuffle(range(8 + level * 2).map(value => value + 1),rng).slice(0,4);
      const useProduct = level > 4 && rng() > .5;
      return { ...basic, numbers: shuffle(numbers,rng), goal: useProduct ? numbers[0] * numbers[1] : numbers[0] + numbers[1] };
    }
    default: {
      const item = expression(level,rng);
      return { prompt: `${item.text} = ?`, ...options(item.value,rng) };
    }
  }
}

export function calculate(left: number, right: number, operator: string) {
  switch (operator) {
    case '+': return left + right;
    case '−': return left - right;
    case '×': return left * right;
    case '÷': return right !== 0 ? left / right : NaN;
    default: return NaN;
  }
}
