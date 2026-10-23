/* v8.4: more filling snacks, used when the menu of a day is below the calorie norm.
   Added on the client to the server catalog; ingredients are catalog ingredients; 4 servings like every recipe. */
(() => {
  const C=window.FamilyMenuCatalog,ids=new Set(C.recipes.map(r=>r.id)),known=new Set(C.ingredients.map(i=>i.id));
  const R=(id,name,meal,minutes,tags,ingredients,steps,art)=>({id,name,meal,minutes,tags,ingredients:Object.entries(ingredients).map(([id,quantity])=>({id,quantity})),spices:[],steps,stepSeconds:steps.map(()=>0),stepTips:steps.map(()=>''),art});
  const extra=[
   R('x1','Сырники со сметаной и ягодами','s',25,['kids'],{cottage:500,eggs:2,flour:80,sugar:40,oil:30,sour_cream:150,berries:100},['Смешайте творог, яйца, сахар и муку.','Сформуйте сырники и обжарьте на масле по 3–4 минуты с каждой стороны.','Подавайте со сметаной и ягодами.'],'plate:syrniki,sourcream,berries'),
   R('x2','Тост с арахисовой пастой и бананом','s',5,['quick','kids'],{bread:0.5,peanut_butter:80,banana:2},['Подсушите ломтики хлеба на сухой сковороде.','Намажьте арахисовой пастой и выложите кружочки банана.'],'board:toast,peanut,banana'),
   R('x3','Йогурт с гранолой и мёдом','s',10,['quick'],{oats:200,walnuts:60,honey:60,yogurt:500,berries:150},['Обжарьте овсяные хлопья с орехами на сухой сковороде 5 минут.','Остудите, смешайте с мёдом.','Разложите йогурт, сверху гранолу и ягоды.'],'bowl:yogurt,granola,berries'),
   R('x4','Банановый смузи с овсянкой','s',5,['quick','kids'],{banana:3,milk:600,oats:80,peanut_butter:40},['Сложите всё в блендер.','Взбейте до однородности и разлейте по стаканам.'],'glass:smoothie,banana_top'),
   R('x5','Творог со сметаной, мёдом и изюмом','s',5,['quick','kids'],{cottage:600,sour_cream:150,honey:60,raisins:60},['Промойте изюм горячей водой.','Смешайте творог со сметаной, сверху мёд и изюм.'],'bowl:cottage,berries'),
   R('x6','Лаваш с курицей и сыром','s',20,['quick'],{lavash:2,chicken_fillet:400,cheese:120,tomato:200,cucumber:150,sour_cream:80,oil:15},['Обжарьте нарезанное филе на масле 7–8 минут.','Смажьте лаваш сметаной, выложите курицу, овощи и тёртый сыр.','Сверните рулетом, подрумяньте на сковороде и разрежьте.'],'board:toast,cheese,tomato'),
   R('x7','Бутерброды с лососем и плавленым сыром','s',10,['quick'],{bread:0.5,salmon:200,processed_cheese:2,cucumber:150},['Намажьте хлеб плавленым сыром.','Выложите тонкие ломтики лосося и огурца.'],'board:toast,cheese,cucumber'),
   R('x8','Орехи с изюмом и мёдом','s',5,['quick'],{walnuts:160,raisins:120,honey:40},['Смешайте орехи и изюм, полейте мёдом.'],'plate:raisins,nuts'),
   R('x9','Овсяное печенье с бананом','s',30,['kids','baked'],{oats:250,banana:3,raisins:60,honey:40,butter:40},['Разомните бананы, смешайте с хлопьями, мёдом, растопленным маслом и изюмом.','Выложите печенье на противень.','Запекайте 15–18 минут при 180°.'],'plate:cookies,banana'),
   R('x10','Тост с авокадо и яйцом','s',10,['quick'],{eggs:4,avocado:2,bread:0.5,lemon:0.5},['Сварите яйца 7 минут.','Разомните авокадо с лимонным соком, намажьте на подсушенный хлеб.','Сверху половинки яиц.'],'board:toast,avocado,egg'),
   R('x11','Шоколадно-банановый шейк','k',5,['quick','kids'],{milk:800,banana:3,cocoa:30,honey:30},['Взбейте всё в блендере до пены.'],'glass:smoothie,banana_top'),
   R('x12','Блины со сметаной','s',30,['kids'],{flour:250,milk:600,eggs:3,sugar:40,oil:40,sour_cream:200},['Смешайте яйца, сахар и молоко, вмешайте муку и 2 ложки масла.','Пеките тонкие блины на горячей сковороде.','Подавайте со сметаной.'],'plate:pancakes,sourcream'),
  ];
  for(const r of extra) if(!ids.has(r.id) && r.ingredients.every(q=>known.has(q.id))) {window.FamilyMenuArtwork[r.id]=r.art;const {art,...recipe}=r;C.recipes.push(recipe);}
})();
