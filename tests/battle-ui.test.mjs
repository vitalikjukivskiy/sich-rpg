import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.document={addEventListener(){}};
const {battleLog}=await import('../public/battle-ui.js');
test('літопис розрізняє звичайну й критичну шкоду в одному раунді',()=>{
 const html=battleLog(['Герой: удар у голову — 12 шкоди. Ворог: удар у груди — 34 шкоди! КРИТИЧНИЙ УДАР.'],['Герой','Ворог']);
 assert.match(html,/<strong class="event-damage">12 шкоди<\/strong>/);
 assert.match(html,/<strong class="event-critical">34 шкоди<\/strong>/);
 assert.match(html,/<strong>Герой<\/strong>/);
});
test('лікування та відповідь суперника мають окремі кольори',()=>{
 const html=battleLog(['Ви випили настоянку (+30 здоров’я). Суперник завдав 9 шкоди. Блок. УХИЛЕННЯ. ЧАС ВИЙШОВ. Дезорієнтація на наступний хід.']);
 for(const kind of ['heal','damage','block','dodge','timeout','effect'])assert.match(html,new RegExp('<strong class="event-'+kind+'">'));
});
test('імена з пунктуацією й довільний текст залишаються безпечними',()=>{
 const html=battleLog(['Герой [1]+: <img src=x onerror=alert(1)> 5 шкоди.'],['Герой [1]+']);
 assert.match(html,/<strong>Герой \[1\]\+<\/strong>/);
 assert.ok(!html.includes('<img'));
 assert.ok(html.includes('&lt;img'));
});
