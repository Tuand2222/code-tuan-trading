export type Playbook = { name: string; description: string; checklist: string; validFrom: string };
export function checklistRules(text: string) {
  return text.split('\n').filter(s=>s.trim()).map((line,index)=>{const [label,weightText]=line.split('|'),weight=Number(weightText?.trim()??1);if(!label.trim()||!Number.isFinite(weight)||weight<=0)throw new Error('Checklist cần tiêu chí và trọng số > 0, dạng Tiêu chí | 2.');return {id:String(index),label:label.trim(),weight};});
}
export function checklistScore(rules: ReturnType<typeof checklistRules>, answers: Record<string,boolean>): number | undefined {
  const total=rules.reduce((s,r)=>s+r.weight,0);return total?Math.round(rules.reduce((s,r)=>s+(answers[r.id]?r.weight:0),0)/total*100):undefined;
}
export function activePlaybook(books:Playbook[],name:string,date:string){return books.filter(b=>b.name===name&&b.validFrom<=date).sort((a,b)=>b.validFrom.localeCompare(a.validFrom))[0];}
