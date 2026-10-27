import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const root=new URL('../',import.meta.url);
const dir=new URL('../supabase/functions/sich-api/engine/',import.meta.url);
const names=['clanworks','combat','content','factions','game','inventory','market','roads','story','trials','world'];
await mkdir(dir,{recursive:true});
await mkdir(new URL('./public/',dir),{recursive:true});
for(const name of names){
 let js=await readFile(new URL(name+'.mjs',root),'utf8');
 js=js.replaceAll("import { randomUUID } from 'node:crypto';",'const randomUUID = () => crypto.randomUUID();')
      .replaceAll("import {randomUUID} from 'node:crypto';",'const randomUUID = () => crypto.randomUUID();');
 await writeFile(new URL(name+'.mjs',dir),js);
}
await writeFile(new URL('./public/uk.js',dir),await readFile(new URL('./public/uk.js',root)));
console.log('Всі '+names.length+' модулів без урізань перенесено до Edge.');
