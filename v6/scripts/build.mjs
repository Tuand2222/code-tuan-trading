import {mkdirSync,copyFileSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),destination=path.resolve(root,'dist');if(path.dirname(destination)!==path.resolve(root))throw new Error('Invalid build target');rmSync(destination,{recursive:true,force:true});mkdirSync(destination,{recursive:true});for(const file of ['index.html','sw.js'])copyFileSync(root+file,path.join(destination,file));console.log('Single HTML build ready');
