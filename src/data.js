/* Catalog content comes exclusively from GET /api/catalog, before the original UI starts. */
const CATALOG=window.FamilyMenuCatalog;
const ING=Object.fromEntries(CATALOG.ingredients.map(i=>[i.id,[i.name,i.category,i.unit,i.price,i.allergens,i.flags,i.nutrition]]));
const LAVKA=Object.fromEntries(CATALOG.ingredients.filter(i=>i.lavkaPrice!=null).map(i=>[i.id,[i.lavkaPrice,i.lavkaPrice,i.name,i.lavkaPath || '']]));
const VV_PROMO=CATALOG.promos.map(p=>[p.name,p.price,p.regularPrice,p.condition,p.until]);
const legacyRecipe=r=>({id:r.id,art:window.FamilyMenuArtwork[r.id],n:r.name,imageUrl:r.imageUrl,m:r.meal,t:r.minutes,tags:[...r.tags],i:r.ingredients.map(i=>[i.id,i.quantity]),sp:r.spices || [],s:r.steps,stepSeconds:r.stepSeconds,stepTips:r.stepTips});
const R=CATALOG.recipes.map(legacyRecipe);
const PRICE_SOURCE='ВкусВилл, Москва, 20.10.2026';
const CITIES={msk:['Москва',1],mo:['Московская область',0.92],spb:['Санкт-Петербург',0.97],kgd:['Калининград',0.985],kzn:['Казань',0.74],khv:['Хабаровск',1.12],oms:['Омск',0.725],sar:['Саратов',0.71],other:['Другой город',0.845]};
const LAVKA_SOURCE='Яндекс Лавка, Москва, 21.10.2026';
const CAT_ORDER=['Овощи и зелень','Фрукты и ягоды','Мясо и рыба','Молочное и яйца','Бакалея','Хлеб'];

/* Allergens: first 14 follow the mandatory-labelling list of TR TS 022/2011; citrus & honey are common everyday allergies */
const ALLERG={gluten:'Глютен (пшеница, рожь, овёс)',milk:'Белок коровьего молока',lactose:'Лактоза',egg:'Яйца',fish:'Рыба',crustacean:'Креветки и ракообразные',mollusc:'Кальмары и моллюски',peanut:'Арахис',nuts:'Орехи',soy:'Соя',sesame:'Кунжут',mustard:'Горчица',celery:'Сельдерей',citrus:'Цитрусовые',honey:'Мёд'};

/* Eating type (hard rule) and goals (soft) */
const DIETS={
 all:['Едим всё',''],
 halal:['Без свинины','халяль и не только'],
 pesc:['Пескетарианство','без мяса, рыба есть'],
 veg:['Вегетарианство','без мяса и рыбы'],
 vegan:['Веганство','только растительное'],
 lent:['Постное','без мяса, молочного и яиц; рыба — по разрешённым дням'],
};
const GOALS={pp:'Правильное питание',protein:'Белковое',mass:'Набор массы',lose:'Похудение',lowcarb:'Меньше углеводов'};

/* Likes: expandable groups. 'i:' = ingredient key, 't:' = tag */
const LIKE_GROUPS=[
 ['Крупы и гарниры',{'i:buckwheat':'Гречка','i:rice':'Рис','i:bulgur':'Булгур','i:oats':'Овсянка','i:millet':'Пшено','i:quinoa':'Киноа','i:pasta':'Макароны','i:potato':'Картофель'}],
 ['Мясо и птица',{'i:chicken_fillet':'Куриное филе','i:chicken_thigh':'Курица на кости','i:turkey':'Индейка','i:beef':'Говядина','i:pork':'Свинина','t:mince':'Фарш','i:chicken_liver':'Печень'}],
 ['Рыба и морепродукты',{'t:whitefish':'Белая рыба','i:salmon':'Красная рыба','i:tuna':'Тунец','i:shrimp':'Креветки','i:squid':'Кальмары'}],
 ['Овощи',{'i:zucchini':'Кабачки','i:broccoli':'Брокколи','i:cauliflower':'Цветная капуста','i:pumpkin':'Тыква','i:eggplant':'Баклажаны','i:mushrooms':'Грибы','i:cabbage':'Капуста','i:bell_pepper':'Перец'}],
 ['Молочное и яйца',{'i:cottage':'Творог','i:cheese':'Сыр','i:eggs':'Яйца','i:yogurt':'Йогурт','i:tofu':'Тофу'}],
 ['Бобовые',{'i:lentils':'Чечевица','i:chickpeas':'Нут','i:beans':'Фасоль'}],
 ['Блюда',{'t:soup':'Супы','t:porridge':'Каши','t:pasta':'Паста','t:casserole':'Запеканки','t:salad':'Салаты','t:pancake':'Блины и сырники','t:cutlets':'Котлеты','t:stew':'Тушёное'}],
 ['Кухни',{'t:ru':'Домашняя русская','t:asia':'Азиатская','t:it':'Итальянская','t:cauc':'Кавказская и восточная'}],
 ['Особое',{'t:quick':'Быстрое','t:kids':'Любят дети','t:baked':'В духовке','t:keeps':'Хорошо хранится'}],
];

/* Recipes: base 4 servings. m: b=breakfast, m=main. t: minutes. art: illustration spec. */
