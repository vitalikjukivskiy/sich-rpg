import test from 'node:test';
import assert from 'node:assert/strict';
import {navigationGroups,groupForRoute,contextNavigation} from '../public/navigation.js';
import {preferences,savePreference} from '../public/interface-pages.js';
test('вкладки Лютеції охоплюють старі й нові сторінки без дублів',()=>{
 assert.deepEqual(navigationGroups.map(g=>g.label),['Локація','Інвентар','Поєдинки','Завдання','Банк','Навички','Налаштування']);
 const routes=navigationGroups.flatMap(g=>g.routes.map(([id])=>id));assert.equal(routes.length,20);assert.equal(new Set(routes).size,20);
 for(const route of routes)assert.ok(groupForRoute(route).routes.some(([id])=>id===route));
 assert.match(contextNavigation('smith'),/aria-current="page">Кузня/);
 assert.match(contextNavigation('market'),/href="#bank"/);
});
test('налаштування зберігаються окремо для кожного персонажа та відновлюють безпечні значення',()=>{
 const map=new Map();globalThis.localStorage={getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)};
 assert.deepEqual(preferences('a'),{chatTime:true,largeText:false});savePreference('a','chatTime',false);savePreference('a','largeText',true);
 assert.deepEqual(preferences('a'),{chatTime:false,largeText:true});assert.deepEqual(preferences('b'),{chatTime:true,largeText:false});
 savePreference('a','other',true);assert.equal(map.size,1);map.set('sich_interface_v1:a','invalid JSON');assert.deepEqual(preferences('a'),{chatTime:true,largeText:false});
});
