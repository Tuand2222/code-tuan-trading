import test from 'node:test';
import assert from 'node:assert/strict';
test('Classic storage can be imported by Worker SSR without global random operations',async()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{randomUUID(){throw Error('Random values forbidden at Worker module scope');}}});
  try{
    const module=await import('../lib/classic-persistence.ts');
    assert.equal(module.classicSender,'classic-server');
  }finally{
    Object.defineProperty(globalThis,'crypto',descriptor);
  }
});
