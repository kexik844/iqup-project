import { Brain, Puzzle, ScanEye, Zap, Calculator } from 'lucide-react';

export type Lang = 'ru' | 'en';
export type Skill = keyof typeof skills;
export const skills = {
  memory: { names: ['Память', 'Memory'], icon: Brain, color: '#ae91ff', background: '#31264e' },
  logic: { names: ['Логика', 'Logic'], icon: Puzzle, color: '#76baff', background: '#213951' },
  focus: { names: ['Внимание', 'Focus'], icon: ScanEye, color: '#66dfce', background: '#1f4146' },
  reaction: { names: ['Реакция', 'Reaction'], icon: Zap, color: '#ffd171', background: '#463924' },
  math: { names: ['Математика', 'Math'], icon: Calculator, color: '#ff9a81', background: '#472f37' },
} as const;
export const skillIds = Object.keys(skills) as Skill[];

type Mode = 'choice' | 'digits' | 'pairs' | 'colors' | 'spatial' | 'objects' | 'sudoku' | 'schulte' | 'signal' | 'target' | 'traffic' | 'equation';
type Game = { id: string; skill: Skill; name: readonly [string, string]; rule: readonly [string, string]; mode: Mode; rounds: number; limit?: number };
function game(id: string, skill: Skill, name: Game['name'], rule: Game['rule'], mode: Mode = 'choice', rounds = 5, limit?: number): Game {
  return { id, skill, name, rule, mode, rounds, limit };
}

export const games = [
  game('digits','memory',['Числовая память','Digit memory'],['Запомни цифры и введи их в том же порядке.','Memorize the digits and type them in the same order.'],'digits'),
  game('pairs','memory',['Карточки памяти','Memory cards'],['Открывай по две карточки и находи одинаковые пары.','Flip two cards at a time to find matching pairs.'],'pairs',3),
  game('memory','memory',['Последовательность цветов','Color sequence'],['Следи за плитками и повтори последовательность.','Watch the tiles and repeat the sequence.'],'colors'),
  game('spatial','memory',['Пространственная память','Spatial memory'],['Запомни подсвеченные клетки и восстанови рисунок.','Remember the highlighted cells and restore the pattern.'],'spatial'),
  game('objects','memory',['Запомни объекты','Remember the objects'],['Отметь все предметы, которые были показаны.','Select all the objects you saw.'],'objects'),
  game('patterns','logic',['Числовые закономерности','Number patterns'],['Определи следующее число в последовательности.','Find the next number in the sequence.']),
  game('odd','logic',['Лишний объект','Odd one out'],['Найди объект, который не относится к общей группе.','Find the object that does not belong to the group.']),
  game('shapes','logic',['Продолжи узор','Complete the pattern'],['Выбери фигуру, которая продолжает узор.','Choose the shape that continues the pattern.']),
  game('statements','logic',['Логические утверждения','Logical statements'],['Сопоставь условия и выбери верный ответ.','Compare the clues and select the right answer.']),
  game('sudoku','logic',['Мини-судоку','Mini sudoku'],['Заполни пустые клетки так, чтобы числа не повторялись в строках, столбцах и блоках.','Fill the blanks so each row, column and block has unique numbers.'],'sudoku',3),
  game('difference','focus',['Найди отличие','Spot the difference'],['Сравни две сетки и нажми изменившуюся клетку во второй.','Compare the two grids and tap the changed cell in the second grid.']),
  game('focus','focus',['Найди символ','Find the symbol'],['Найди целевой символ среди похожих.','Find the target among similar symbols.']),
  game('stroop','focus',['Цвет против слова','Color vs. word'],['Выбери цвет букв. Значение слова может не совпадать.','Choose the ink color. The word may say a different color.']),
  game('schulte','focus',['Таблица Шульте','Schulte table'],['Нажимай числа по порядку, начиная с 1.','Tap the numbers in order, starting at 1.'],'schulte',3),
  game('filter','focus',['Визуальный фильтр','Visual filter'],['Отметь фигуры, которые соответствуют условию.','Mark every shape that matches the rule.'],'objects'),
  game('reaction','reaction',['Быстрый тап','Quick tap'],['Дождись зелёного сигнала и нажми как можно быстрее.','Wait for green and tap as fast as you can.'],'signal'),
  game('tap','reaction',['Поймай цель','Catch the target'],['Коснись цели, пока она видна.','Tap the target before it disappears.'],'target',8),
  game('direction','reaction',['Правильное направление','Right direction'],['Следуй стрелке или выбирай противоположное направление по подсказке.','Follow the arrow or choose its opposite as instructed.'],'choice',5,3800),
  game('traffic','reaction',['Светофор','Traffic light'],['Нажимай на зелёный и пропускай красный сигнал.','Tap on green and let the red signal pass.'],'traffic',7),
  game('quick','reaction',['Быстрый выбор','Quick choice'],['Быстро классифицируй фигуру по указанному правилу.','Quickly classify the shape using the rule shown.'],'choice',8,3400),
  game('math','math',['Устный счёт','Mental math'],['Реши пример и выбери правильный ответ.','Solve the expression and select the right answer.']),
  game('sprint','math',['Математический спринт','Math sprint'],['Реши как можно больше примеров за 25 секунд.','Answer as many problems as you can in 25 seconds.'],'choice',99),
  game('missing','math',['Пропущенное число','Missing number'],['Найди число, которое делает равенство верным.','Find the number that makes the equation true.']),
  game('compare','math',['Больше или меньше','Greater or less'],['Сравни значения слева и справа.','Compare the values on the left and right.']),
  game('build','math',['Собери число','Build the number'],['Используй два разных числа и одну операцию, чтобы получить цель.','Use two different numbers and one operation to reach the target.'],'equation'),
];
export const byId = Object.fromEntries(games.map(item => [item.id, item]));
const exerciseDifficulties = [1, 4, 8] as const;
export const exerciseLevelCount = exerciseDifficulties.length;
export function exerciseStep(game: Game, answered: number) {
  // A sprint has no fixed number of questions. It ramps after two and four answers.
  const progressionLength = game.id === 'sprint' ? 6 : game.rounds;
  const index = Math.min(exerciseLevelCount - 1, Math.floor(answered * exerciseLevelCount / progressionLength));
  return { stage: index + 1, difficulty: exerciseDifficulties[index] };
}
export function local(pair: readonly [string, string], lang: Lang) { return pair[lang === 'ru' ? 0 : 1]; }

export const themes = [
  { id: 'classic', name: ['Классика','Classic'], cost: 0, colors: ['#405ada','#7867ef'] },
  { id: 'ocean', name: ['Океан','Ocean'], cost: 120, colors: ['#147bb9','#41d6cb'] },
  { id: 'peach', name: ['Закат','Sunset'], cost: 180, colors: ['#b05297','#ff9977'] },
  { id: 'night', name: ['Ночной неон','Night neon'], cost: 240, colors: ['#4338a4','#bf78ff'] },
  { id: 'forest', name: ['Северный лес','Northern forest'], cost: 280, colors: ['#316849','#8be994'] },
  { id: 'solar', name: ['Солнечная орбита','Solar orbit'], cost: 350, colors: ['#9b551d','#ffd378'] },
] as const;

export const chapters = [
  { name: ['Пробуждение','Awakening'], games: ['digits','math','focus'] },
  { name: ['Концентрация','Concentration'], games: ['schulte','filter','stroop'] },
  { name: ['Первые открытия','First discoveries'], games: ['patterns','odd','missing'] },
  { name: ['Мастер памяти','Memory master'], games: ['pairs','spatial','objects'] },
  { name: ['Логический прорыв','Logic breakthrough'], games: ['shapes','statements','sudoku'] },
  { name: ['Интеллектуальный марафон','Mind marathon'], games: ['traffic','sprint','build'] },
] as const;

export type CosmeticType = 'theme'|'avatar'|'frame'|'background'|'mascot'|'effect'|'badge';
export const cosmeticTypes: Record<CosmeticType,readonly [string,string]> = {
  theme:['Темы','Themes'],avatar:['Аватары','Avatars'],frame:['Рамки','Frames'],background:['Фоны','Backgrounds'],
  mascot:['Маскот','Mascot'],effect:['Эффекты','Effects'],badge:['Значки','Badges'],
};
type Cosmetic = { id:string; type:CosmeticType; name:readonly [string,string]; cost:number; colors:readonly [string,string]; symbol:string; rarity:number };
const variations: ReadonlyArray<readonly [CosmeticType,string,string,string,string,string,string]> = [
  ['avatar','bolt','Искра','Spark','⚡','#5242a8','#b975f2'],
  ['avatar','space','Орбита','Orbit','🪐','#237cab','#58e2d4'],
  ['avatar','star','Звезда','Star','🌟','#a85d3e','#ffc071'],
  ['frame','violet','Сиреневая рамка','Lilac frame','◇','#6258c6','#bba3ff'],
  ['frame','azure','Лазурная рамка','Azure frame','◈','#27718a','#77e6fa'],
  ['frame','gold','Золотая рамка','Gold frame','✧','#90622b','#ffda80'],
  ['background','lagoon','Лагуна','Lagoon','≈','#165a65','#237c8a'],
  ['background','dusk','Ультрафиолет','Ultraviolet','☄','#272955','#7a3fb2'],
  ['background','rose','Рассвет','Daybreak','☀','#49214d','#c85b8e'],
  ['mascot','mint','Мятный маскот','Mint mascot','🧠','#24745b','#68eb8b'],
  ['mascot','rose','Розовый маскот','Pink mascot','🧠','#84328c','#f482ce'],
  ['mascot','amber','Янтарный маскот','Amber mascot','🧠','#a15923','#ffc264'],
  ['effect','dust','Звёздная пыль','Stardust','✶','#5537a6','#c7a3ff'],
  ['effect','wave','Световая волна','Light wave','≈','#2155a5','#70ccfa'],
  ['effect','sun','Солнечная вспышка','Solar flare','☀','#9d541f','#ffc05b'],
  ['badge','mind','Мыслитель','Thinker','♟','#52409b','#9c9bee'],
  ['badge','light','Скорость света','Lightspeed','ϟ','#47618c','#91d2ff'],
  ['badge','crown','Корона IQUP','IQUP crown','♛','#865423','#f6c06a'],
];
export const cosmetics: Cosmetic[] = [
  ...themes.map((theme,index) => ({...theme,type:'theme' as const,symbol:'✦',rarity:Math.min(3,Math.floor(index / 2))})),
  ...variations.map<Cosmetic>(([type,id,ru,en,symbol,start,end],index) => ({type,id:`${type}-${id}`,name:[ru,en],symbol,colors:[start,end],cost:[65,145,255][index % 3] + Math.floor(index / 3) * 12,rarity:index % 3 + 1})),
];
export const cosmeticById = Object.fromEntries(cosmetics.map(item => [item.id,item]));
