// Read-only compatibility for migration; never mounts a retired UI or writes old data.
const demoIds = new Set(["T260710","T260713","T260715","T260717","T260720","T260722","T260724","T260727","T260729","T260801","T260803","T260804","T260805","T260806","S260728","S260805","C260730","C260804","F260729","F260806"]);
export function readLegacySource(storage: Pick<Storage, 'getItem'>, suffix = ''): {trades:unknown[];isDemo:boolean} {
  const raw=storage.getItem('tuan-trader-trades'+suffix);
  if(!raw)return {trades:[],isDemo:true};
  const value:unknown=JSON.parse(raw);
  if(!Array.isArray(value))throw new Error('Nhật ký lưu trước đây không đúng định dạng. Bản gốc vẫn được giữ.');
  const flag=storage.getItem('tuan-trader-demo-mode-v1'+suffix);
  const isDemo=flag==='true'||flag!=='false'&&value.length===demoIds.size&&value.every(t=>typeof t==='object'&&t!==null&&'id' in t&&demoIds.has(String(t.id)));
  return {trades:isDemo?[]:value,isDemo};
}
