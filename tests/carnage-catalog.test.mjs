import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseCategory} from '../scripts/import-carnage-catalog.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../reference/carnage-catalog.json',import.meta.url),'utf8'));
const progression=JSON.parse(fs.readFileSync(new URL('../reference/carnage-progression.json',import.meta.url),'utf8'));
test('публічний каталог зберігає всі 22 категорії, валюти, вимоги та числові одиниці',()=>{
 assert.equal(catalog.integration,'reference-only');assert.equal(catalog.items.length,1365);assert.equal(catalog.sources.length,22);assert.equal(new Set(catalog.items.map(i=>i.key)).size,1365);
 assert.equal(catalog.sources.reduce((n,s)=>n+s.count,0),1365);
 for(const source of catalog.sources)assert.equal(catalog.items.filter(i=>i.source===source.url).length,source.count);
 for(const item of catalog.items){assert.ok(Number.isInteger(item.priceMinor)&&item.priceMinor>=0);assert.ok(['florin','sesterce'].includes(item.currency));assert.ok(Number.isInteger(item.durability.maximum)&&item.durability.maximum>0);assert.ok(item.durability.wear>=0&&item.durability.wear<=item.durability.maximum);for(const field of [...Object.values(item.requirements),...Object.values(item.properties)])assert.ok(Number.isFinite(field.value));}
 const knife=catalog.items.find(i=>i.key==='kn-1');assert.equal(knife.priceMinor,1600);assert.equal(knife.requirements.agility.value,5);assert.equal(knife.requirements.instinct.value,5);assert.equal(knife.properties.minDamage.value,6);assert.equal(knife.properties.maxDamage.value,8);assert.equal(knife.properties.critical.value,4);
 const mail=catalog.items.find(i=>i.key==='armor-55');assert.equal(mail.durability.maximum,100);assert.equal(mail.properties.health.value,5);assert.equal(mail.properties.stamina.value,5);assert.equal(mail.requirements.level,undefined);
 const gem=catalog.items.find(i=>i.key==='stone-232');assert.equal(gem.currency,'sesterce');assert.equal(gem.priceMinor,4250);assert.equal(gem.properties.headArmor.value,1);assert.equal(gem.upgradeable,true);assert.equal(gem.effectNeedsReview,true);
 const multipart=catalog.items.find(i=>i.properties.lifetime?.parts.length>1);assert.ok(multipart);assert.equal(multipart.properties.lifetime.observationOnly,true);assert.equal(multipart.properties.lifetime.parts[1].unit,'hour');
});
test('імпортер зупиняється при невідомій властивості або частково прочитаній таблиці',()=>{
 const item='| ![](http://img.carnage.com.ru/i/kn/1.gif) | **Тест** (Масса: 1)<br>_Цена: **1.25** фл._<br>Долговечность: 0/20<br>**Требования:**<br>•Уровень: 1<br>**Свойства:**<br>•Критический удар: +4 |';
 const page={url:'http://lib.carnage.com.ru/items/kn',markdown:item};assert.equal(parseCategory(page,'kn')[0].priceMinor,125);
 assert.throws(()=>parseCategory({...page,markdown:item.replace('Критический удар','Новая формула')},'kn'),/Unparsed/);
 assert.throws(()=>parseCategory({...page,markdown:item.replace('+4','+4–8')},'kn'),/Unsupported unit/);
 assert.throws(()=>parseCategory({...page,markdown:item+'\n_Цена: **2.00** фл._'},'kn'),/Not every/);
});
test('архівні пороги досвіду зберігають проміжні виплати й накопичувальні суми',()=>{
 assert.equal(progression.status,'archival-reference-only');assert.equal(progression.rows.length,106);assert.equal(progression.crossCheckedPrefixRows,91);
 let stats=12,money=0,prior=-1;for(const step of progression.rows){assert.ok(step.xp>prior);prior=step.xp;stats+=step.statAward;money+=step.florinAwardMinor;assert.equal(step.totalStats,stats);assert.equal(step.totalFlorinsMinor,money);}
 assert.equal(progression.rows.find(r=>r.xp===200).level,1);assert.equal(progression.rows.find(r=>r.xp===600).level,2);assert.equal(progression.rows.find(r=>r.xp===7650).level,5);
 assert.equal(progression.rows.find(r=>r.xp===290000).florinAwardMinor,100);assert.equal(progression.rows.at(-1).totalStats,189);
 assert.equal(progression.coverage.level12AndAbove,'not-confirmed');
});
