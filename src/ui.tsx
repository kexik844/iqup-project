import type { ReactNode } from 'react';
import { byId, local, skillIds, skills, type Lang, type Skill } from './catalog';
import { accuracy, type Profile } from './progress';

export const l = (lang: Lang, ru: string, en: string) => local([ru,en],lang);
export const asset = (name:string) => import.meta.env.BASE_URL + 'mascot/' + name;
export function SkillIcon({ id, size = 23 }: { id: Skill; size?: number }) {
  const { icon:Icon, color, background } = skills[id];
  return <span className="skill-icon" style={{color,background}}><Icon size={size} strokeWidth={1.9}/></span>;
}
export function Rail({ value, max }: { value: number; max: number }) {
  return <div className="progress-bar" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={max || 1} aria-valuenow={Math.min(max,value)}>
    <span style={{width:`${max ? Math.max(0,Math.min(100,value / max * 100)) : 0}%`}}/>
  </div>;
}
export function PageTop({ title,children }: { title:string; children?:ReactNode }) {
  return <div className="page-top"><div><h1>{title}</h1>{children && <p>{children}</p>}</div></div>;
}
export function getSkillSummary(profile: Profile) {
  return skillIds.map(skill => {
    const history = profile.history.filter(result => byId[result.game]?.skill === skill && result.total > 0);
    const percent = history.length ? Math.round(history.reduce((sum,result) => sum + accuracy(result),0) / history.length) : 0;
    return { skill,history,percent };
  });
}
