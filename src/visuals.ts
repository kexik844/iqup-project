export const subjects = {
  lemon: ['Лимон','Lemon'],
  apple: ['Яблоко','Apple'],
  grapes: ['Виноград','Grapes'],
  strawberry: ['Клубника','Strawberry'],
  cat: ['Кот','Cat'],
  rabbit: ['Кролик','Rabbit'],
  turtle: ['Черепаха','Turtle'],
  fox: ['Лиса','Fox'],
  guitar: ['Электрогитара','Electric guitar'],
  violin: ['Скрипка','Violin'],
  drum: ['Барабан','Drum'],
  trumpet: ['Труба','Trumpet'],
  kite: ['Воздушный змей','Kite'],
  headphones: ['Наушники','Headphones'],
  key: ['Ключ','Key'],
  compass: ['Компас','Compass'],
} as const;
export type Subject = keyof typeof subjects;
export const objectIds = Object.keys(subjects) as Subject[];

export const subjectGroups: readonly (readonly Subject[])[] = [
  ['lemon','apple','grapes','strawberry'],
  ['cat','rabbit','turtle','fox'],
  ['guitar','violin','drum','trumpet'],
];

export const shapes = {
  circle: { names:['Круг','Circle'], color:'#cd9afa' },
  triangle: { names:['Треугольник','Triangle'], color:'#edbe74' },
  square: { names:['Квадрат','Square'], color:'#81cdbc' },
  diamond: { names:['Ромб','Diamond'], color:'#85adee' },
  ring: { names:['Кольцо','Ring'], color:'#e7969e' },
  hexagon: { names:['Шестиугольник','Hexagon'], color:'#c2d287' },
} as const;
export type Shape = keyof typeof shapes;
export const shapeIds = Object.keys(shapes) as Shape[];
export const coreShapes = shapeIds.slice(0,4);
export const photoGames = ['pairs','objects','odd','difference'];
