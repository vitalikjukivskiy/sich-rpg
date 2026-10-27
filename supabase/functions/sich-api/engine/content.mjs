// Авторський контент. Параметри є ігровими умовностями козацького світу.
const equipment=[
 ['veteran_sabre','Шабля ветерана','weapon','sword',4,330,16,0,'Пам’ятає не один герць.'],
 ['border_sabre','Клинок прикордоння','weapon','sword',6,650,23,0,'Сталь майстрів прикордонних міст.'],
 ['hetman_sabre','Гетьманська шабля','weapon','sword',9,1350,33,0,'Відзнака за довгу службу.'],
 ['legend_sabre','Шабля П’яти Доріг','weapon','sword',12,2600,45,0,'Клинок, чиє ім’я стало легендою.'],
 ['carbine','Карабін дозорця','weapon','axe',4,440,18,0,'Коротший ствол для далеких доріг.'],
 ['swedish_musket','Арсенальний мушкет','weapon','axe',7,900,28,0,'Добре підігнаний замок і надійний ствол.'],
 ['master_musket','Мушкет славетного майстра','weapon','axe',11,2150,41,0,'Кожна деталь працює як єдине ціле.'],
 ['officer_pistol','Пістоль ротмістра','pistol','pistol',6,700,8,0,'Різьблене руків’я й перевірений замок.'],
 ['master_pistol','Пістоль Золотої Застави','pistol','pistol',10,1500,13,0,'Майстрова зброя прикордонної старшини.'],
 ['travel_coat','Похідний жупан','body','mail',3,260,0,10,'Щільна тканина не підводить у негоду.'],
 ['officer_coat','Жупан сотника','body','mail',6,600,0,18,'Добре скроєний захист для бувалого воїна.'],
 ['officer_plate','Панцир корогви','body','plate',9,1250,0,27,'Витриманий гарт і міцна нагрудна пластина.'],
 ['legend_coat','Жупан П’яти Доріг','body','mail',12,2450,0,36,'Нагорода за примирення торгових шляхів.'],
 ['officer_hat','Шапка старшини','head','helmet',4,280,0,6,'Добре пошите сукно з хутряним обідком.'],
 ['master_hat','Шапка гідної служби','head','helmet',8,740,0,11,'Річ, що свідчить про здобуту довіру.'],
 ['rider_boots','Чоботи вершника','boots','boots',4,270,0,5,'Товста шкіра й добра підошва.'],
 ['master_boots','Чоботи далеких походів','boots','boots',9,800,0,10,'Тисячі кроків залишаться позаду.'],
 ['officer_belt','Кушак хорунжого','belt','belt',5,340,0,5,'Щільне плетиво й надійний вузол.'],
 ['master_belt','Кушак П’яти Доріг','belt','belt',10,920,0,10,'Упізнаваний знак вільної дороги.'],
 ['officer_bag','Ладівниця дозорця','shield','shield',4,290,0,6,'Усе рушничне начиння має своє місце.'],
 ['master_bag','Арсенальна ладівниця','shield','shield',8,780,0,12,'Робота досвідченого шкіряника.'],
 ['guild_seal','Печатка купецької ради','ring','ring',5,410,5,4,'Довіра ремісників і торговців.'],
 ['five_roads_seal','Печатка П’яти Доріг','ring','ring',11,1400,10,8,'Символ завершеної прикордонної кампанії.'],
 ['pilgrim_amulet','Медальйон мандрівника','amulet','amulet',5,380,4,5,'Річ на згадку про довгу дорогу.'],
 ['master_amulet','Медальйон Золотої Застави','amulet','amulet',10,1150,8,10,'За службу людям усіх п’яти земель.']
];
export const extraItems=equipment.map(([id,name,slot,art,level,price,damage,armor,description])=>({id,name,slot,art,icon:slot==='weapon'?'sword':'shield',level,price,damage,armor,description,ranged:art==='axe'||slot==='pistol',rarity:level>=10?'legendary':level>=6?'rare':'fine'}));
extraItems.push(...[
 ['council_sabre','Шабля Ради П’яти Доріг','weapon','sword',14,3200,52,0,12],
 ['council_plate','Панцир вільних застав','body','plate',14,3000,0,42,12],
 ['council_seal','Печатка захисника доріг','ring','ring',12,2000,14,12,8],
 ['council_amulet','Медальйон визнаної служби','amulet','amulet',12,2000,12,14,8]
].map(([id,name,slot,art,level,price,damage,armor,honorCost])=>({id,name,slot,art,icon:slot==='weapon'?'sword':'shield',level,price,damage,armor,honorCost,rarity:'legendary',description:'Відзнака ради за перемоги у випробуваннях. Придбайте за відзнаки або знайдіть на спільному ринку.'})));
const enemyData=[
 ['road_scout','Дозорець степової дороги',2,'crimea'],['rogue_musketeer','Мушкетер без патенту',3,'sweden'],['rogue_hussar','Вершник Чорної Корогви',4,'commonwealth'],
 ['river_guard','Вартовий старої переправи',4,'cossacks'],['caravan_raider','Караванний нападник',5,'ottoman'],['powder_smuggler','Контрабандист пороху',5,'sweden'],
 ['red_captain','Капітан Червоної Застави',6,'commonwealth'],['steppe_chief','Ватажок степової ватаги',6,'crimea'],['harbor_duelist','Дуелянт старого порту',7,'ottoman'],
 ['iron_sergeant','Сержант Залізного Строю',7,'sweden'],['black_banner','Отаман Чорної Корогви',8,'cossacks'],['siege_master','Майстер облогового табору',9,'commonwealth'],
 ['salt_road_chief','Господар Соляної Дороги',10,'crimea'],['lost_commandant','Комендант покинутої застави',11,'ottoman'],['oathbreaker','Полковник зламаної присяги',12,'cossacks'],
 ['five_roads_boss','Маршал Чорної Корогви',14,'commonwealth']
];
export const extraOpponents=enemyData.map(([id,name,level,portrait])=>({id,name,level,portrait,hp:60+level*37,damage:7+level*3,armor:Math.floor(level*1.6),xp:30+level*48,gold:18+level*14,tag:'Прикордонний герць',difficulty:level>=10?'Легендарний':level>=6?'Складно':'Досвідчений',forest:false}));
export const chapters=[
 {id:'powder',name:'IV. Пороховий слід',text:'Відшукайте викрадені припаси й розкрийте шлях контрабандистів.',enemies:['road_scout','rogue_musketeer','powder_smuggler'],gold:300,xp:280,reputation:14,level:4,rewardItem:'veteran_sabre'},
 {id:'fortress',name:'V. Під мурами Кам’янця',text:'Пройдіть випробування прикордонної варти та звільніть торговий тракт.',enemies:['river_guard','rogue_hussar','red_captain'],gold:420,xp:370,reputation:16,level:5,rewardItem:'officer_hat'},
 {id:'steppe',name:'VI. Слід у високій траві',text:'Дізнайтеся, хто збирає плату з караванів посеред вільного степу.',enemies:['caravan_raider','steppe_chief','harbor_duelist'],gold:550,xp:480,reputation:18,level:6,rewardItem:'border_sabre'},
 {id:'baltic',name:'VII. Балтійський контракт',text:'Допоможіть арсенальним майстрам повернути майстрове креслення.',enemies:['powder_smuggler','iron_sergeant','black_banner'],gold:680,xp:600,reputation:20,level:7,rewardItem:'swedish_musket'},
 {id:'liman',name:'VIII. Вогні над лиманом',text:'Супроводіть посланця крізь неспокійні застави прибережного краю.',enemies:['harbor_duelist','black_banner','siege_master'],gold:800,xp:740,reputation:22,level:8,rewardItem:'officer_plate'},
 {id:'black_standard',name:'IX. Чорна Корогва',text:'Знайдіть табір ватаги, яка зіштовхує між собою п’ять земель.',enemies:['black_banner','siege_master','salt_road_chief'],gold:1000,xp:900,reputation:25,level:9,rewardItem:'hetman_sabre'},
 {id:'council',name:'X. Рада п’яти шляхів',text:'Виконайте останні випробування й заручіться довірою купецьких рад.',enemies:['salt_road_chief','lost_commandant','oathbreaker'],gold:1250,xp:1100,reputation:30,level:10,rewardItem:'master_amulet'},
 {id:'last_fort',name:'XI. Остання застава',text:'Пробийте шлях до схованки маршала Чорної Корогви.',enemies:['lost_commandant','oathbreaker','siege_master'],gold:1500,xp:1300,reputation:35,level:11,rewardItem:'master_musket'},
 {id:'five_roads',name:'XII. Клятва П’яти Доріг',text:'Завершіть історію Чорної Корогви й поверніть людям вільний шлях.',enemies:['oathbreaker','salt_road_chief','five_roads_boss'],gold:2000,xp:1700,reputation:50,level:12,rewardItem:'legend_sabre',finale:true}
];
export const extraQuests=[
 ['wins10','Десять чесних перемог','Здобудьте 10 перемог.',10,'wins',180,150],['wins25','Ім’я, яке знає майдан','Здобудьте 25 перемог.',25,'wins',400,300],
 ['wins50','Легенда герцю','Здобудьте 50 перемог.',50,'wins',800,600],['forge5','Учень доброго майстра','Виконайте 5 майстрових робіт.',5,'forged',160,120],
 ['forge15','Рука майстра','Виконайте 15 майстрових робіт.',15,'forged',430,320],['herbs25','Припас для всього куреня','Зберіть 25 пучків трав.',25,'gathered',190,140],
 ['chapter3','Перші три дороги','Завершіть 3 різні розділи кампанії.',3,'chapters',260,220],['chapter6','Між степом і морем','Завершіть 6 різних розділів кампанії.',6,'chapters',600,500],
 ['chapter9','Ворог під одним прапором','Завершіть 9 різних розділів кампанії.',9,'chapters',1000,850],['chapter12','Клятва виконана','Завершіть всю кампанію з 12 розділів.',12,'chapters',2000,1500],
 ['trader1','Перша угода','Продайте один лот на спільному ринку.',1,'marketSales',75,50],['trader10','Відомий комісіонер','Продайте 10 лотів.',10,'marketSales',400,300],
 ['buyer5','Добрий торг','Купіть 5 лотів у інших гравців.',5,'marketPurchases',180,120]
].map(([id,name,text,target,metric,gold,xp])=>({id,name,text,target,metric,gold,xp,icon:metric==='chapters'?'scroll':metric.startsWith('market')?'coin':'trophy'}));
export const recipes=[
 {id:'tonic',name:'Похідні настоянки',item:'potion',quantity:2,level:1,gold:10,materials:{herb:3},text:'Дві настоянки з лікувальних трав.'},
 {id:'veteran',name:'Шабля ветерана',item:'veteran_sabre',quantity:1,level:4,gold:130,materials:{ore:6,resin:2},text:'Загартований клинок власної роботи.'},
 {id:'carbine',name:'Карабін дозорця',item:'carbine',quantity:1,level:4,gold:175,materials:{ore:8,resin:4},text:'Вогнепальна зброя для наступних походів.'},
 {id:'seal',name:'Печатка купецької ради',item:'guild_seal',quantity:1,level:5,gold:160,materials:{ore:5,herb:3},text:'Майстрова річ для бувалого мандрівника.'},
 {id:'coat',name:'Жупан сотника',item:'officer_coat',quantity:1,level:6,gold:250,materials:{ore:6,herb:5},text:'Міцне спорядження для середини кампанії.'}
];
export const dailyQuests=[{id:'daily_wins',name:'Варта сьогоднішнього дня',metric:'wins',target:3,gold:90,xp:70},{id:'daily_herbs',name:'Поповнити аптечку',metric:'gathered',target:5,gold:35,xp:25},{id:'daily_trade',name:'Угода на майдані',metric:'marketSales',target:1,gold:55,xp:40}];
export function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
extraQuests.push(...[
 ['road1','Перший власний обоз','Завершіть одну дорожню подорож.',1,'journeysWon',80,60],
 ['roads5','Знавець п’яти трактів','Пройдіть усі п’ять різних доріг.',5,'routes',700,600],
 ['roads10','Досвідчений провідник','Проведіть 10 обозів.',10,'journeysWon',500,450],
 ['trial1','Рада знає ваше ім’я','Переможіть у першому випробуванні ради.',1,'trialWins',200,200],
 ['trials3','Чемпіон вільних доріг','Пройдіть усі три випробування ради.',3,'trials',1000,1000]
].map(([id,name,text,target,metric,gold,xp])=>({id,name,text,target,metric,gold,xp,icon:metric.startsWith('trial')?'trophy':'compass'})));
export function progressOf(p,metric){return metric==='chapters'?(p.completedContracts?.length||0):metric==='routes'?(p.journeyRoutes?.length||0):metric==='trials'?(p.trialsCompleted?.length||0):p[metric]||0;}
export function refreshDaily(p){const day=today();if(p.daily?.day!==day)p.daily={day,base:{wins:p.wins||0,gathered:p.gathered||0,marketSales:p.marketSales||0},claimed:[]};}
