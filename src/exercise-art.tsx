import { useState, type CSSProperties } from 'react';
import { local, type Lang } from './catalog';
import { objectIds, shapes, subjects, type Shape, type Subject } from './visuals';

const photoUrl = (subject: Subject) => import.meta.env.BASE_URL + 'exercises/' + subject + '.webp';
let preload: Promise<void> | undefined;
export function preparePhotos() {
  preload ??= Promise.allSettled(objectIds.map(subject => {
    const image = new Image();
    image.src = photoUrl(subject);
    return image.decode();
  })).then(() => undefined);
  return preload;
}

export function exerciseLabel(value: string, lang: Lang) {
  if (Object.hasOwn(subjects,value)) return local(subjects[value as Subject],lang);
  if (Object.hasOwn(shapes,value)) return local(shapes[value as Shape].names,lang);
  return value;
}

function Photo({ subject,lang }: { subject: Subject; lang: Lang }) {
  const [failed,setFailed] = useState(false);
  const name = local(subjects[subject],lang);
  return failed ? <span className="photo-fallback" aria-hidden="true">{name}</span>
    : <img className="exercise-photo" src={photoUrl(subject)} width="288" height="288" alt="" draggable={false} onError={() => setFailed(true)}/>;
}

export function ExerciseArt({ value,lang,color,small }: { value: string; lang: Lang; color?: string; small?: boolean }) {
  if (Object.hasOwn(subjects,value)) return <Photo key={value} subject={value as Subject} lang={lang}/>;
  if (Object.hasOwn(shapes,value)) {
    const shape = shapes[value as Shape];
    return <span className={`exercise-shape ${small ? 'shape-small' : ''}`} data-shape={value}
      style={{color:color ?? shape.color}} aria-hidden="true"/>;
  }
  return value;
}

export function ColorSwatch({ color }: { color: string }) {
  return <span className="exercise-swatch" style={{'--swatch-color':color} as CSSProperties} aria-hidden="true"/>;
}
