import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Reads tool-retrieved public library pages. It never fetches or executes a page.
export const categoryNames={helm:'Шоломи',boot:'Чоботи',armor:'Броня',glov:'Рукавиці',belt:'Пояси',shield:'Щити',bracelet:'Наручі',pants:'Штани',shoulder:'Наплічники',ring:'Каблучки',neck:'Намиста',ear:'Сережки',cas:'Кастети',club:'Дубини',sw:'Мечі',kn:'Ножі',axe:'Сокири',ham:'Молоти',sp:'Списи',license:'Ліцензії',stone:'Камені',rune:'Руни'};
const keys={'Уровень':'level','Сила':'strength','Ловкость':'agility','Инстинкт':'instinct','Жизнеспособность':'vitality','Интеллект':'intellect','Выносливость':'stamina','Уровень жизни':'health','Критический удар':'critical','Против критического удара':'antiCritical','Увертывание':'dodge','Против увертывания':'antiDodge','Броня головы':'headArmor','Броня корпуса':'bodyArmor','Броня пояса':'waistArmor','Броня ног':'legArmor','Минимальный урон':'minDamage','Максимальный урон':'maxDamage','Вероятность срабатывания':'triggerPercent','Срок годности':'lifetime','Продолжительность действия':'duration'};
export const fieldLabels={level:'Рівень',strength:'Сила',agility:'Спритність',instinct:'Інстинкт',vitality:'Життєздатність',intellect:'Інтелект',stamina:'Витривалість',health:'Здоров’я',critical:'Критичний удар',antiCritical:'Антикрит',dodge:'Ухилення',antiDodge:'Антиухилення',headArmor:'Броня голови',bodyArmor:'Броня грудей',waistArmor:'Броня пояса',legArmor:'Броня ніг',minDamage:'Мінімальна шкода',maxDamage:'Максимальна шкода',triggerPercent:'Імовірність спрацювання, %',lifetime:'Строк придатності',duration:'Тривалість дії'};
function numericFields(section,context){
 const fields={};
 for(const line of section.split(/<br>/)){
  if(!line.includes('•'))continue;
  const text=line.replace(/^.*?•\s*/,'').replace(/\|.*$/,'').trim();
  if(text==='Доступна функция улучшения')continue;
  const match=text.match(/^([^:]+):\s*([+-]?\d+(?:[.,]\d+)?)(.*)$/);
  if(!match||!keys[match[1]])throw new Error('Unparsed field in '+context+': '+text);
  const [,label,raw,unit]=match,key=keys[label];
  if(Object.hasOwn(fields,key))throw new Error('Duplicate field '+key+' in '+context);
  const value=Number(raw.replace(',','.')),suffix=unit.trim();
  if(['lifetime','duration'].includes(key)){
   const parts=[...`${value} ${suffix}`.matchAll(/(\d+)\s*(дн\.|ч\.|мин\.)/g)].map(m=>({value:Number(m[1]),unit:{'дн.':'day','ч.':'hour','мин.':'minute'}[m[2]]}));
   if(!parts.length||`${value} ${suffix}`.replace(/\d+\s*(дн\.|ч\.|мин\.)/g,'').trim())throw new Error('Unknown time unit in '+context);
   fields[key]={value,unit:suffix,parts,observationOnly:key==='lifetime'};
  }else{
   if(suffix!==''&&!(key==='triggerPercent'&&suffix==='%'))throw new Error('Unsupported unit for '+key+' in '+context);
   fields[key]={value,unit:suffix};
  }
 }
 return fields;
}
export function parseCategory({url,markdown},category){
 if(!Object.hasOwn(categoryNames,category))throw new Error('Unknown category '+category);
 if(url!=='http://lib.carnage.com.ru/items/'+category)throw new Error('Unexpected source '+url);
 const rows=markdown.split('\n').filter(line=>/\*\*.*?\*\* \(Масса:/.test(line));
 if(!rows.length)throw new Error('Empty category '+category);
 if([...markdown.matchAll(/_Цена:\s*\*\*/g)].length!==rows.length)throw new Error('Not every priced record was parsed in '+category);
 return rows.map(line=>{
  const name=line.match(/\*\*(.*?)\*\* \(Масса:\s*([\d.]+)\)/),cell=line.slice(line.indexOf('**'+name[1]+'**'));
  const asset=line.match(new RegExp('/i/'+category+'/([^/]+)\\.(?:gif|png|jpg)'));
  const price=cell.match(/Цена:\s*\*\*([\d.]+)\*\*\s*([^<]*)/),durability=cell.match(/Долговечность:\s*(\d+)\/(\d+)/);
  if(!asset||!price||!durability)throw new Error('Incomplete item '+name[1]);
  const currency={'фл':'florin','стц':'sesterce'}[price[2].replace(/[._]/g,'').trim()];
  if(!currency)throw new Error('Unknown currency for '+name[1]);
  const requirements=cell.split('**Требования:**')[1]?.split('**Свойства:**')[0],properties=cell.split('**Свойства:**')[1]?.split('**Действие:**')[0];
  if(requirements===undefined||properties===undefined)throw new Error('Missing numeric sections for '+name[1]);
  return {key:category+'-'+asset[1],category,sourceName:name[1],nameUk:null,mass:Number(name[2]),priceMinor:Math.round(Number(price[1])*100),currency,durability:{wear:Number(durability[1]),maximum:Number(durability[2])},requirements:numericFields(requirements,name[1]),properties:numericFields(properties,name[1]),upgradeable:properties.includes('Доступна функция улучшения'),effectNeedsReview:cell.includes('**Действие:**'),source:url};
 });
}
export function importCatalog(sourceDir){
 const items=[],sources=[];
 for(const [category,label] of Object.entries(categoryNames)){
  const page=JSON.parse(fs.readFileSync(path.join(sourceDir,category+'.json'),'utf8'));
  const entries=parseCategory(page,category);items.push(...entries);sources.push({category,label,url:page.url,retrievedAt:page.retrievedAt,count:entries.length});
 }
 if(new Set(items.map(i=>i.key)).size!==items.length)throw new Error('Duplicate catalogue key');
 return {schema:1,source:'Офіційна публічна бібліотека Carnage',capturedAt:'2026-11-01',scope:'Опубліковані записи 22 категорій; тотожність усій базі поточного сервера не підтверджена.',integration:'reference-only',localization:'Назви оригіналу збережені лише для зіставлення; nameUk потребує редакторської перевірки.',currencyScale:100,fieldLabels,sources,items};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [sourceDir,output]=process.argv.slice(2);if(!sourceDir||!output)throw new Error('Usage: node scripts/import-carnage-catalog.mjs SOURCE_DIR OUTPUT');
 const catalog=importCatalog(sourceDir);fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,JSON.stringify(catalog,null,2)+'\n');console.log(catalog.items.length+' numeric records from '+catalog.sources.length+' categories');
}
