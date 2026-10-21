/* Dish illustrations: top-down flat drawings composed from the recipe's art spec "vessel:part,part,...".
   Deterministic per recipe id, cached. Fixed palette (it is an image, not UI chrome). */
(function(){
const cache={};
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0}
function rng(seed){let a=seed;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const f1=n=>Math.round(n*10)/10;

// shape primitives: (g, x, y, s, c[]) -> svg
const SH={
 chunk(g,x,y,s,c){let p='';const n=7;for(let i=0;i<n;i++){const a=i/n*Math.PI*2+g()*.4,r=s*(.7+g()*.35);p+=(i?'L':'M')+f1(x+Math.cos(a)*r)+' '+f1(y+Math.sin(a)*r)}
   return `<path d="${p}Z" fill="${c[0]}"/><circle cx="${f1(x-s*.2)}" cy="${f1(y-s*.25)}" r="${f1(s*.35)}" fill="${c[1]||c[0]}" opacity=".7"/>`},
 circle(g,x,y,s,c){return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s)}" fill="${c[0]}"/><circle cx="${f1(x-s*.3)}" cy="${f1(y-s*.3)}" r="${f1(s*.35)}" fill="${c[1]||c[0]}" opacity=".8"/>`},
 oval(g,x,y,s,c){const a=g()*180;return `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(s)}" ry="${f1(s*.62)}" fill="${c[0]}" transform="rotate(${f1(a)} ${f1(x)} ${f1(y)})"/><ellipse cx="${f1(x-s*.25)}" cy="${f1(y-s*.15)}" rx="${f1(s*.4)}" ry="${f1(s*.2)}" fill="${c[1]||c[0]}" opacity=".7" transform="rotate(${f1(a)} ${f1(x)} ${f1(y)})"/>`},
 slice(g,x,y,s,c){let o=`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s)}" fill="${c[0]}"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s*.8)}" fill="${c[1]}"/>`;if(c[2])for(let i=0;i<5;i++){const a=i/5*Math.PI*2;o+=`<ellipse cx="${f1(x+Math.cos(a)*s*.4)}" cy="${f1(y+Math.sin(a)*s*.4)}" rx="${f1(s*.12)}" ry="${f1(s*.07)}" fill="${c[2]}" transform="rotate(${f1(a*57.3)} ${f1(x+Math.cos(a)*s*.4)} ${f1(y+Math.sin(a)*s*.4)})"/>`}return o},
 wedge(g,x,y,s,c){const a=g()*Math.PI*2,b=a+1.3;const P=(t,r)=>f1(x+Math.cos(t)*r)+' '+f1(y+Math.sin(t)*r);
   return `<path d="M${P(a,0)}L${P(a,s)}A${f1(s)} ${f1(s)} 0 0 1 ${P(b,s)}Z" fill="${c[0]}"/><path d="M${P(a+.15,s*.2)}L${P(a+.15,s*.8)}A${f1(s*.8)} ${f1(s*.8)} 0 0 1 ${P(b-.15,s*.8)}Z" fill="${c[1]||c[0]}"/>`},
 stick(g,x,y,s,c){const a=g()*180;return `<rect x="${f1(x-s)}" y="${f1(y-s*.18)}" width="${f1(s*2)}" height="${f1(s*.36)}" rx="${f1(s*.18)}" fill="${c[0]}" transform="rotate(${f1(a)} ${f1(x)} ${f1(y)})"/>`},
 leaf(g,x,y,s,c){const a=g()*180;return `<g transform="rotate(${f1(a)} ${f1(x)} ${f1(y)})"><ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(s)}" ry="${f1(s*.42)}" fill="${c[0]}"/><path d="M${f1(x-s*.9)} ${f1(y)}H${f1(x+s*.9)}" stroke="${c[1]||'#3d6b2c'}" stroke-width="${f1(s*.08)}"/></g>`},
 cluster(g,x,y,s,c){let o=`<rect x="${f1(x-s*.12)}" y="${f1(y)}" width="${f1(s*.24)}" height="${f1(s*.8)}" rx="${f1(s*.1)}" fill="${c[2]||c[1]||c[0]}"/>`;for(let i=0;i<6;i++){const a=i/6*Math.PI*2;o+=`<circle cx="${f1(x+Math.cos(a)*s*.42)}" cy="${f1(y-s*.15+Math.sin(a)*s*.32)}" r="${f1(s*.36)}" fill="${c[0]}"/>`}
   return o+`<circle cx="${f1(x)}" cy="${f1(y-s*.15)}" r="${f1(s*.32)}" fill="${c[1]||c[0]}"/>`},
 curl(g,x,y,s,c){const a=g()*360;return `<g transform="rotate(${f1(a)} ${f1(x)} ${f1(y)})"><path d="M${f1(x-s)} ${f1(y)}A${f1(s)} ${f1(s)} 0 1 1 ${f1(x)} ${f1(y+s)}" fill="none" stroke="${c[0]}" stroke-width="${f1(s*.7)}" stroke-linecap="round"/><path d="M${f1(x-s)} ${f1(y)}A${f1(s)} ${f1(s)} 0 1 1 ${f1(x)} ${f1(y+s)}" fill="none" stroke="${c[1]}" stroke-width="${f1(s*.2)}" stroke-linecap="round" stroke-dasharray="${f1(s*.3)} ${f1(s*.3)}"/></g>`},
 ring(g,x,y,s,c){return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s*.75)}" fill="none" stroke="${c[0]}" stroke-width="${f1(s*.35)}"/>`},
 cube(g,x,y,s,c){const a=g()*90;return `<g transform="rotate(${f1(a)} ${f1(x)} ${f1(y)})"><rect x="${f1(x-s*.7)}" y="${f1(y-s*.7)}" width="${f1(s*1.4)}" height="${f1(s*1.4)}" rx="${f1(s*.25)}" fill="${c[0]}"/><rect x="${f1(x-s*.5)}" y="${f1(y-s*.5)}" width="${f1(s*.7)}" height="${f1(s*.45)}" rx="${f1(s*.15)}" fill="${c[1]||c[0]}" opacity=".7"/></g>`},
 dot(g,x,y,s,c){return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s)}" fill="${c[Math.floor(g()*c.length)]}"/>`},
 seed(g,x,y,s,c){const a=g()*180;return `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(s)}" ry="${f1(s*.5)}" fill="${c[Math.floor(g()*c.length)]}" transform="rotate(${f1(a)} ${f1(x)} ${f1(y)})"/>`},
 fillet(g,x,y,s,c){const a=g()*40-20;let o=`<g transform="rotate(${f1(a)} ${f1(x)} ${f1(y)})"><ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(s*1.7)}" ry="${f1(s)}" fill="${c[0]}"/>`;for(let i=-2;i<=2;i++)o+=`<path d="M${f1(x+i*s*.5-s*.15)} ${f1(y-s*.8)}Q${f1(x+i*s*.5+s*.25)} ${f1(y)} ${f1(x+i*s*.5-s*.15)} ${f1(y+s*.8)}" fill="none" stroke="${c[1]}" stroke-width="${f1(s*.1)}"/>`;return o+'</g>'},
 patty(g,x,y,s,c){const a=g()*180;return `<g transform="rotate(${f1(a)} ${f1(x)} ${f1(y)})"><ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(s*1.25)}" ry="${f1(s*.9)}" fill="${c[0]}"/><ellipse cx="${f1(x-s*.15)}" cy="${f1(y-s*.15)}" rx="${f1(s*.85)}" ry="${f1(s*.55)}" fill="${c[1]}" opacity=".85"/></g>`},
 toast(g,x,y,s,c){const a=g()*30-15;return `<g transform="rotate(${f1(a)} ${f1(x)} ${f1(y)})"><rect x="${f1(x-s)}" y="${f1(y-s*.85)}" width="${f1(s*2)}" height="${f1(s*1.7)}" rx="${f1(s*.35)}" fill="${c[1]}"/><rect x="${f1(x-s*.85)}" y="${f1(y-s*.7)}" width="${f1(s*1.7)}" height="${f1(s*1.4)}" rx="${f1(s*.25)}" fill="${c[0]}"/></g>`},
 dollop(g,x,y,s,c){return `<circle cx="${f1(x+s*.08)}" cy="${f1(y+s*.1)}" r="${f1(s)}" fill="rgba(0,0,0,.08)"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s)}" fill="${c[0]}"/><path d="M${f1(x-s*.5)} ${f1(y)}a${f1(s*.5)} ${f1(s*.5)} 0 1 1 ${f1(s*.5)} ${f1(s*.4)}" fill="none" stroke="${c[1]}" stroke-width="${f1(s*.12)}"/>`},
 egg(g,x,y,s,c){let p='';for(let i=0;i<9;i++){const a=i/9*Math.PI*2,r=s*(.85+g()*.3);p+=(i?'L':'M')+f1(x+Math.cos(a)*r)+' '+f1(y+Math.sin(a)*r)}return `<path d="${p}Z" fill="#fbfaf4" stroke="#efe8d6" stroke-width="1.5" stroke-linejoin="round"/><circle cx="${f1(x+s*.1)}" cy="${f1(y)}" r="${f1(s*.38)}" fill="#f4b221"/><circle cx="${f1(x)}" cy="${f1(y-s*.1)}" r="${f1(s*.12)}" fill="#fbd96a"/>`},
 egghalf(g,x,y,s,c){const a=g()*180;return `<g transform="rotate(${f1(a)} ${f1(x)} ${f1(y)})"><ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(s)}" ry="${f1(s*.72)}" fill="#fbfaf4" stroke="#ece4d0"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s*.42)}" fill="#f2b42a"/></g>`},
 strand(g,x,y,s,c){const a=g()*180;return `<path d="M${f1(x-s*1.4)} ${f1(y)}q${f1(s*.35)} ${f1(-s*.5)} ${f1(s*.7)} 0t${f1(s*.7)} 0t${f1(s*.7)} 0t${f1(s*.7)} 0" fill="none" stroke="${c[Math.floor(g()*c.length)]}" stroke-width="${f1(s*.22)}" stroke-linecap="round" transform="rotate(${f1(a)} ${f1(x)} ${f1(y)})"/>`},
 tube(g,x,y,s,c){const a=g()*180;return `<g transform="rotate(${f1(a)} ${f1(x)} ${f1(y)})"><rect x="${f1(x-s*.7)}" y="${f1(y-s*.3)}" width="${f1(s*1.4)}" height="${f1(s*.6)}" rx="${f1(s*.28)}" fill="${c[0]}"/><rect x="${f1(x-s*.5)}" y="${f1(y-s*.12)}" width="${f1(s)}" height="${f1(s*.2)}" rx="${f1(s*.1)}" fill="${c[1]}"/></g>`},
 stack(g,x,y,s,c){let o='';for(let i=4;i>=0;i--)o+=`<circle cx="${f1(x+i*s*.06)}" cy="${f1(y+i*s*.05)}" r="${f1(s)}" fill="${i%2?c[1]:c[0]}"/>`;return o+`<circle cx="${f1(x-s*.25)}" cy="${f1(y-s*.25)}" r="${f1(s*.3)}" fill="#f6dfa0" opacity=".7"/>`},
 roll(g,x,y,s,c){let o=`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s)}" fill="#ead6a2"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s*.8)}" fill="#f6ecd2"/>`;const cs=['#d79a52','#7fb069','#e0442f','#fbfaf4','#d79a52'];for(let i=0;i<10;i++){const a=g()*Math.PI*2,r=g()*s*.6;o+=`<circle cx="${f1(x+Math.cos(a)*r)}" cy="${f1(y+Math.sin(a)*r)}" r="${f1(s*.17)}" fill="${cs[i%cs.length]}"/>`}return o},
 pepperstuffed(g,x,y,s,c){return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s)}" fill="#d8402c"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s*.72)}" fill="#8a5a3c"/><circle cx="${f1(x-s*.2)}" cy="${f1(y-s*.2)}" r="${f1(s*.2)}" fill="#f2ecdc"/>`},
 swirl(g,x,y,s,c){return `<path d="M${f1(x-s)} ${f1(y)}c${f1(s*.4)} ${f1(-s*.8)} ${f1(s*1.4)} ${f1(-s*.6)} ${f1(s*1.2)} ${f1(s*.1)}s${f1(-s*1.2)} ${f1(s*.7)} ${f1(-s*.6)} ${f1(s*.2)}" fill="none" stroke="${c[0]}" stroke-width="${f1(s*.22)}" stroke-linecap="round"/>`},
 bapple(g,x,y,s,c){return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s)}" fill="${c[0]}"/><circle cx="${f1(x-s*.3)}" cy="${f1(y-s*.3)}" r="${f1(s*.3)}" fill="#e05a48" opacity=".7"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s*.35)}" fill="${c[1]}"/>`},
 cake(g,x,y,s,c){const P=(t,r)=>f1(x+Math.cos(t)*r)+' '+f1(y+Math.sin(t)*r),a=-0.5,b=0.9;return `<path d="M${P(a,0)}L${P(a,s)}A${f1(s)} ${f1(s)} 0 0 1 ${P(b,s)}Z" fill="${c[1]}"/><path d="M${P(a+.06,s*.08)}L${P(a+.06,s*.88)}A${f1(s*.88)} ${f1(s*.88)} 0 0 1 ${P(b-.06,s*.88)}Z" fill="${c[0]}"/>`},
 cookie(g,x,y,s,c){let o=`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s)}" fill="${c[0]}"/>`;for(let i=0;i<5;i++)o+=`<circle cx="${f1(x+(g()-.5)*s*1.2)}" cy="${f1(y+(g()-.5)*s*1.2)}" r="${f1(s*.12)}" fill="${c[1]}"/>`;return o},
};
// parts: kind 'fill' (spreads as a layer) or 'items'
const PT={
 milk:{k:'fill',c:['#f5efe1','#ebe2cc']}, oatmeal:{k:'fill',c:['#e8d7b2','#d6c193'],tex:'#cdb684'}, yogurt:{k:'fill',c:['#fbfaf5','#efeadd']},
 cottage:{k:'fill',c:['#fbf8f0','#efe8d8'],tex:'#e5dcc6'}, omelet:{k:'fill',c:['#f3d36b','#e8c051'],tex:'#f8e39a'},
 soup_red:{k:'fill',c:['#b8332a','#a02a22'],tex:'#cf4a3d'}, soup_gold:{k:'fill',c:['#e8c25e','#dcb04a'],tex:'#f2d585'}, soup_orange:{k:'fill',c:['#e98a2e','#d97a22'],tex:'#f2a656'},
 soup_beige:{k:'fill',c:['#cfb184','#bf9f72'],tex:'#ddc49d'}, soup_clear:{k:'fill',c:['#ead9a4','#dcc78f'],tex:'#f3e6bd'}, stew:{k:'fill',c:['#c4612f','#b25426'],tex:'#d8783f'},
 curry:{k:'fill',c:['#e3a33c','#d49230'],tex:'#efbd62'}, sauce_red:{k:'fill',c:['#c8432c','#b33826'],tex:'#da5a41'}, sauce_cream:{k:'fill',c:['#efe2c3','#e3d3ad'],tex:'#f6ecd4'},
 lettuce:{k:'items',sh:'leaf',c:['#8cc265','#5f8f3e'],n:14,s:.2},
 ricegrain:{k:'fill',c:['#f5efe1','#ece2c9'],tex:'#fffdf6'}, oatsgrain:{k:'fill',c:['#ecdcb6','#dcc697'],tex:'#cdb684'},
 rice:{k:'grain',c:['#f3efe4','#fffdf7','#e6dfcd']}, buckwheat:{k:'grain',c:['#9b6a43','#7a4f2f','#b07d52']}, bulgur:{k:'grain',c:['#d8b26e','#c49a52','#e6c78a']},
 quinoa:{k:'grain',c:['#e8d9ae','#d4c08a','#f2e6c6']}, millet:{k:'grain',c:['#f0c75a','#e3b03c','#f6d880']}, plov:{k:'grain',c:['#e9b85e','#d79a44','#f2cd84'],extra:[['stick',['#ef8a2b'],8,.09],['chunk',['#c97b3a','#dc9a5a'],5,.12]]},
 plov_veg:{k:'grain',c:['#e9b85e','#d79a44','#f2cd84'],extra:[['stick',['#ef8a2b'],10,.09]]}, friedrice:{k:'grain',c:['#e6c98f','#d4b273','#f0dcaa']},
 mash:{k:'blob',c:['#f1dc9a','#f8eac0'],sw:true}, hummus:{k:'blob',c:['#e6cf9a','#d6bb80'],sw:true,extra:[['dot',['#c9a227'],10,.025]]},
 pasta:{k:'items',sh:'tube',c:['#f1d27a','#e3b955'],n:26,s:.13}, pasta_red:{k:'items',sh:'tube',c:['#e48a4c','#c8432c'],n:26,s:.13}, pasta_cream:{k:'items',sh:'tube',c:['#f3dd9b','#e6c878'],n:26,s:.13},
 noodles:{k:'items',sh:'strand',c:['#f0d27f','#e6c46a'],n:18,s:.14},
 potato:{k:'items',sh:'wedge',c:['#d9a24b','#f0c46a'],n:9,s:.17}, potato_cubes:{k:'items',sh:'cube',c:['#f1dc9a','#f8eac0'],n:8,s:.08},
 roast:{k:'items',sh:'chunk',c:['#b9692e','#d58f4c'],n:4,s:.2}, chicken:{k:'items',sh:'chunk',c:['#d79a52','#ebbd7c'],n:7,s:.11}, chicken_grill:{k:'items',sh:'fillet',c:['#d89a55','#a8692e'],n:2,s:.15},
 chicken_glaze:{k:'items',sh:'chunk',c:['#9a5524','#c27a3c'],n:8,s:.11}, beef:{k:'items',sh:'chunk',c:['#7b3a25','#9b5539'],n:8,s:.1}, turkey:{k:'items',sh:'chunk',c:['#e2b47c','#f0cc9a'],n:7,s:.1},
 beef_sauce:{k:'blob',c:['#8f3d22','#a94f2e'],extra:[['chunk',['#6a2c1a','#8a4126'],7,.08]]}, beef_cream:{k:'blob',c:['#d9b48a','#c99d70'],extra:[['stick',['#7b3a25'],9,.09]]},
 mince:{k:'items',sh:'dot',c:['#8a5a3c','#7a4a2f','#a06a46'],n:60,s:.025}, liver:{k:'items',sh:'chunk',c:['#6a2a20','#8a4030'],n:7,s:.1},
 cutlet:{k:'items',sh:'patty',c:['#8d5631','#a86c3e'],n:3,s:.13}, cutlet_fish:{k:'items',sh:'patty',c:['#c8955a','#ddb27a'],n:3,s:.13}, chop:{k:'items',sh:'patty',c:['#c2803f','#d99c5c'],n:2,s:.19},
 syrniki:{k:'items',sh:'patty',c:['#d48a43','#efc184'],n:5,s:.13}, draniki:{k:'items',sh:'patty',c:['#c98a3a','#e3b064'],n:5,s:.13},
 meatballs:{k:'blob',c:['#c8432c','#b33826'],extra:[['circle',['#7d4428','#9b5a37'],7,.09]]}, meatball_small:{k:'items',sh:'circle',c:['#a77050','#c08a68'],n:8,s:.06},
 golubtsy:{k:'fill',c:['#cf6a43','#c05c37'],tex:'#e08a62',extra:[['oval',['#e9d9b2','#f3e7c8'],6,.13]]}, stuffed_pepper:{k:'items',sh:'pepperstuffed',c:[],n:3,s:.14},
 fish:{k:'items',sh:'fillet',c:['#f2ece2','#e2d6c3'],n:2,s:.15}, salmon:{k:'items',sh:'fillet',c:['#ef8b5f','#fbd5c2'],n:1,s:.2}, tuna:{k:'items',sh:'chunk',c:['#d9b8a0','#e8cdb8'],n:7,s:.07},
 shrimp:{k:'items',sh:'curl',c:['#f29a72','#fbd3bf'],n:8,s:.06}, squid:{k:'items',sh:'ring',c:['#efe6d6'],n:10,s:.07}, tofu:{k:'items',sh:'cube',c:['#f1e2bd','#faf1d9'],n:8,s:.07},
 chickpeas:{k:'items',sh:'circle',c:['#dfbd76','#efd59c'],n:16,s:.04}, beans:{k:'items',sh:'oval',c:['#8c2f2f','#a84646'],n:16,s:.045}, lentil:{k:'items',sh:'dot',c:['#d9822b','#c86f1f'],n:40,s:.02},
 egg:{k:'items',sh:'egg',c:[],n:2,s:.15}, egg_half:{k:'items',sh:'egghalf',c:[],n:4,s:.08}, egg_bits:{k:'items',sh:'chunk',c:['#f6d66a','#fbf4dc'],n:8,s:.05},
 cucumber:{k:'items',sh:'slice',c:['#3f7d3a','#cfe6b8','#9cc77f'],n:6,s:.08}, tomato:{k:'items',sh:'wedge',c:['#d83a28','#ef6a4f'],n:5,s:.1},
 pepper:{k:'items',sh:'stick',c:['#e2482f'],n:4,s:.09,alt:['#f2c230']}, greens:{k:'items',sh:'leaf',c:['#5a9e48','#2f6b28'],n:7,s:.035}, spinach:{k:'items',sh:'leaf',c:['#3f7a32','#2a5521'],n:7,s:.07},
 broccoli:{k:'items',sh:'cluster',c:['#4f8a3d','#6aa552','#7a9e5a'],n:4,s:.09}, cauli:{k:'items',sh:'cluster',c:['#efe6cf','#f8f2e2','#d8cfae'],n:5,s:.09},
 carrot:{k:'items',sh:'stick',c:['#ef8a2b'],n:7,s:.06}, zucchini:{k:'items',sh:'slice',c:['#5b8a3a','#d6e6a6','#bcd486'],n:6,s:.08}, eggplant:{k:'items',sh:'slice',c:['#5b2a5e','#e8dcb5'],n:5,s:.08},
 pumpkin:{k:'items',sh:'cube',c:['#f0913a','#f6b26d'],n:8,s:.05}, cabbage:{k:'items',sh:'stick',c:['#dfe8c2'],n:14,s:.06}, mushroom:{k:'items',sh:'circle',c:['#d9c3a2','#efe2cd'],n:7,s:.06},
 peas:{k:'items',sh:'dot',c:['#7cb342','#8fc556'],n:18,s:.022}, avocado:{k:'items',sh:'wedge',c:['#4b6b2a','#b5d17a'],n:4,s:.12}, berries:{k:'items',sh:'dot',c:['#9b2c48','#3d3a7a','#d63a3a'],n:16,s:.03},
 banana:{k:'items',sh:'slice',c:['#efe0a8','#f8eecb','#d8c27a'],n:5,s:.06}, apple:{k:'items',sh:'cube',c:['#f3e3b0','#fbf2d4'],n:7,s:.045}, orange:{k:'items',sh:'wedge',c:['#f28c1c','#f7b04d'],n:3,s:.09},
 lemon:{k:'items',sh:'wedge',c:['#f2d33a','#f8e88a'],n:1,s:.1}, nuts:{k:'items',sh:'chunk',c:['#a8743f','#c79560'],n:6,s:.035}, sesame:{k:'items',sh:'seed',c:['#f6efd8'],n:22,s:.012},
 pumpkin_seeds:{k:'items',sh:'seed',c:['#4c7a35','#6a9a4c'],n:10,s:.02}, cream_swirl:{k:'items',sh:'swirl',c:['#fbf6ea'],n:1,s:.18},
 sourcream:{k:'items',sh:'dollop',c:['#fbfaf4','#e6dfcb'],n:1,s:.08}, yogurt_dollop:{k:'items',sh:'dollop',c:['#fbfaf5','#e8e2d2'],n:1,s:.09},
 cheese:{k:'items',sh:'chunk',c:['#f5cf5d','#fae39a'],n:9,s:.05}, feta:{k:'items',sh:'cube',c:['#fbfbf5','#ffffff'],n:7,s:.05}, croutons:{k:'items',sh:'cube',c:['#d9a45f','#ecc584'],n:7,s:.045},
 granola:{k:'items',sh:'chunk',c:['#c98f4a','#ddae6c'],n:12,s:.05}, peanut:{k:'items',sh:'swirl',c:['#b7793d'],n:2,s:.08},
 pancakes:{k:'items',sh:'stack',c:['#e8b562','#f1c97e'],n:1,s:.4}, toast:{k:'items',sh:'toast',c:['#e8c48a','#b9783c'],n:2,s:.24}, wrap:{k:'items',sh:'roll',c:[],n:4,s:.15},
 apple_slices:{k:'items',sh:'wedge',c:['#c9443a','#f6e6b8'],n:6,s:.1}, honey_drizzle:{k:'items',sh:'swirl',c:['#e2a22a'],n:2,s:.12}, carrot_sticks:{k:'items',sh:'stick',c:['#ef8a2b'],n:7,s:.12},
 raisins:{k:'items',sh:'seed',c:['#6b3a2a','#8a5136','#c9a24a'],n:40,s:.03},
 mors:{k:'fill',c:['#b8233a','#a01c31'],tex:'#d24a5c'}, compote:{k:'fill',c:['#c5617a','#b04e66'],tex:'#da8399'}, cocoa:{k:'fill',c:['#7b4a2e','#6a3e25'],tex:'#9a6545'},
 tea:{k:'fill',c:['#b5651d','#9c5415'],tex:'#cc8040'}, smoothie:{k:'fill',c:['#c9637a','#b85068'],tex:'#e08aa0'}, kefir_drink:{k:'fill',c:['#f6f3ec','#e9e3d6'],tex:'#ffffff'},
 juice:{k:'fill',c:['#f39a1e','#e58a10'],tex:'#f8b956'},
 berries_top:{k:'items',sh:'dot',c:['#c0283c','#8e1d2d'],n:8,s:.035}, banana_top:{k:'items',sh:'slice',c:['#efe0a8','#f8eecb','#d8c27a'],n:2,s:.07},
 lemon_slice:{k:'items',sh:'slice',c:['#f2d33a','#f8e88a','#fbf3c4'],n:1,s:.11}, orange_slice:{k:'items',sh:'slice',c:['#f28c1c','#f7b04d','#fbd38a'],n:1,s:.12},
 baked_apple:{k:'items',sh:'bapple',c:['#c0392b','#e8b56a'],n:3,s:.13}, cottage_bake:{k:'fill',c:['#f2d9a2','#e6c582'],tex:'#f8e8c4'},
 cake_slice:{k:'items',sh:'cake',c:['#ecc77f','#c98f4a'],n:1,s:.42}, cookies:{k:'items',sh:'cookie',c:['#d4a35f','#b07a3a'],n:6,s:.12},
 berrybase:{k:'fill',c:['#8e2a4a','#7a2140'],tex:'#b04a6a'}, crumble:{k:'items',sh:'chunk',c:['#dcb47c','#ecd0a0'],n:26,s:.05},
 icecream:{k:'items',sh:'circle',c:['#c99a72','#e0bb95'],n:3,s:.16},
 dumplings:{k:'items',sh:'oval',c:['#f6efe0','#fffaf0'],n:12,s:.06}, soup_green:{k:'fill',c:['#8fb35a','#7da04a'],tex:'#a8c878'},
 soup_cream:{k:'fill',c:['#efe1c5','#e3d2b0'],tex:'#f7ecd8'}, soup_white:{k:'fill',c:['#f4f1ea','#e8e3d8'],tex:'#ffffff'},
 salmon_bits:{k:'items',sh:'cube',c:['#ef8b5f','#f7b394'],n:8,s:.05}, barley:{k:'grain',c:['#d8c49a','#c4ae80','#e6d6b2']},
};
const BGS=[['#e8ddca','#dccfb7'],['#dfe4da','#d1d8cb'],['#e6dbd3','#d9ccc2'],['#d8dde3','#c9d0d8'],['#eee2cc','#e1d2b6'],['#dfd8cc','#d0c7b8']];

function scatter(g,n,reg,fn){let o='';for(let i=0;i<n;i++){const a=g()*Math.PI*2,r=Math.sqrt(g());o+=fn(reg.x+Math.cos(a)*r*reg.rx,reg.y+Math.sin(a)*r*reg.ry,i)}return o}
function blobPath(g,x,y,rx,ry){let p='';const n=10;for(let i=0;i<n;i++){const a=i/n*Math.PI*2,k=.86+g()*.18;p+=(i?'L':'M')+f1(x+Math.cos(a)*rx*k)+' '+f1(y+Math.sin(a)*ry*k)}return p+'Z'}
function drawPart(g,name,reg,asBase,R0){
  const p=PT[name]; if(!p) return '';
  let o='';
  if(p.k==='fill'||(asBase&&(p.k==='grain'||p.k==='blob'))){
    o+=`<ellipse cx="${f1(reg.x)}" cy="${f1(reg.y)}" rx="${f1(reg.rx)}" ry="${f1(reg.ry)}" fill="${p.c[0]}"/>`;
    o+=`<ellipse cx="${f1(reg.x-reg.rx*.25)}" cy="${f1(reg.y-reg.ry*.3)}" rx="${f1(reg.rx*.45)}" ry="${f1(reg.ry*.25)}" fill="${p.c[1]}" opacity=".5"/>`;
    if(p.tex) o+=scatter(g,26,{x:reg.x,y:reg.y,rx:reg.rx*.9,ry:reg.ry*.9},(x,y)=>SH.dot(g,x,y,R0*.012,[p.tex]));
    if(p.k==='grain') o+=scatter(g,140,{x:reg.x,y:reg.y,rx:reg.rx*.92,ry:reg.ry*.92},(x,y)=>SH.seed(g,x,y,R0*.014,p.c.slice(1)));
  } else if(p.k==='grain'){
    o+=`<path d="${blobPath(g,reg.x,reg.y,reg.rx,reg.ry)}" fill="${p.c[0]}"/>`;
    o+=scatter(g,110,{x:reg.x,y:reg.y,rx:reg.rx*.85,ry:reg.ry*.85},(x,y)=>SH.seed(g,x,y,R0*.014,p.c.slice(1)));
  } else if(p.k==='blob'){
    o+=`<path d="${blobPath(g,reg.x,reg.y,reg.rx,reg.ry)}" fill="${p.c[0]}"/>`;
    if(p.sw) for(let i=0;i<3;i++) o+=SH.swirl(g,reg.x+(g()-.5)*reg.rx,reg.y+(g()-.5)*reg.ry,reg.rx*.35,[p.c[1]]);
  } else {
    const n=asBase?Math.round(p.n*1.3):p.n;
    o+=scatter(g,n,{x:reg.x,y:reg.y,rx:reg.rx*.7,ry:reg.ry*.7},(x,y,i)=>SH[p.sh](g,x,y,R0*p.s*1.45,p.alt&&i%2?p.alt:p.c));
  }
  if(p.extra) p.extra.forEach(([sh,c,n,s])=>{o+=scatter(g,n,{x:reg.x,y:reg.y,rx:reg.rx*.7,ry:reg.ry*.7},(x,y)=>SH[sh](g,x,y,R0*s*1.35,c))});
  return o;
}
window.dishArt=function(r){
  if(cache[r.id]) return cache[r.id];
  const W=400,H=260,g=rng(hash(r.id)),[v,partsS]=(r.art||'plate:rice').split(':'),parts=partsS.split(',');
  const bg=BGS[hash(r.id+'bg')%BGS.length];
  let o=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${r.n.replace(/"/g,'')}" preserveAspectRatio="xMidYMid slice"><rect width="${W}" height="${H}" fill="${bg[0]}"/>`;
  for(let i=0;i<9;i++) o+=`<rect x="0" y="${i*30+8}" width="${W}" height="2" fill="${bg[1]}" opacity=".6"/>`;
  const cx=W/2,cy=H/2+4,R0=112;
  if(v==='tray'){
    o+=`<rect x="${cx-150+6}" y="${cy-92+8}" width="300" height="184" rx="26" fill="rgba(0,0,0,.12)"/><rect x="${cx-150}" y="${cy-92}" width="300" height="184" rx="26" fill="#f6f1e7" stroke="#d8ccb6" stroke-width="3"/>`;
    const reg={x:cx,y:cy,rx:128,ry:72};
    const b0=PT[parts[0]];o+=`<rect x="${cx-132}" y="${cy-74}" width="264" height="148" rx="16" fill="${b0&&b0.k!=='items'?b0.c[0]:'#ead9b4'}"/>`;
    o+=drawPart(g,parts[0],{x:cx,y:cy,rx:118,ry:64},true,R0);
    parts.slice(1).forEach(pn=>o+=drawPart(g,pn,reg,false,R0));
  } else if(v==='glass'||v==='mug'){
    const r0=R0*.62;
    if(v==='mug') o+=`<circle cx="${cx+r0+18}" cy="${cy}" r="26" fill="none" stroke="#f4efe6" stroke-width="14"/><circle cx="${cx+r0+18}" cy="${cy}" r="26" fill="none" stroke="#ddd5c6" stroke-width="2"/>`;
    o+=`<circle cx="${cx+6}" cy="${cy+8}" r="${r0}" fill="rgba(0,0,0,.13)"/><circle cx="${cx}" cy="${cy}" r="${r0}" fill="${v==='mug'?'#f7f3eb':'#e9f0f2'}" stroke="${v==='mug'?'#ddd5c6':'#c9d6da'}" stroke-width="4"/>`;
    o+=drawPart(g,parts[0],{x:cx,y:cy,rx:r0*.82,ry:r0*.82},true,R0);
    parts.slice(1).forEach(pn=>o+=drawPart(g,pn,{x:cx,y:cy,rx:r0*.6,ry:r0*.6},false,R0));
    if(v==='glass'){o+=`<path d="M${cx-r0*.55} ${cy-r0*.55}A${r0*.8} ${r0*.8} 0 0 1 ${cx+r0*.2} ${cy-r0*.78}" stroke="#ffffff" stroke-width="5" fill="none" opacity=".7" stroke-linecap="round"/><rect x="${cx+10}" y="${cy-r0-40}" width="9" height="${r0+30}" rx="4" fill="#e4572e" transform="rotate(28 ${cx+14} ${cy})"/>`}
  } else if(v==='board'){
    o+=`<rect x="${cx-160+6}" y="${cy-95+8}" width="320" height="190" rx="22" fill="rgba(0,0,0,.12)"/><rect x="${cx-160}" y="${cy-95}" width="320" height="190" rx="22" fill="#c99a62"/>`;
    for(let i=0;i<6;i++) o+=`<path d="M${cx-150} ${cy-80+i*32}H${cx+150}" stroke="#b9884f" stroke-width="2" opacity=".6"/>`;
    const regs=[{x:cx-60,y:cy-5,rx:85,ry:70},{x:cx+75,y:cy+5,rx:70,ry:65}];
    if(parts[0]==='toast'){ [[cx-70,cy-5],[cx+70,cy+5]].forEach(([x,y],i)=>{o+=SH.toast(g,x,y,62,PT.toast.c); if(parts[1]) o+=drawPart(g,parts[1],{x,y,rx:46,ry:42},parts[1]==='hummus'||parts[1]==='avocado'||parts[1]==='peanut',R0); (parts.slice(2)).forEach(pn=>o+=drawPart(g,pn,{x,y,rx:44,ry:38},false,R0*.8));}); }
    else { o+=drawPart(g,parts[0],{x:cx,y:cy,rx:120,ry:72},true,R0); parts.slice(1).forEach(pn=>o+=drawPart(g,pn,{x:cx,y:cy,rx:110,ry:60},false,R0)); }
  } else {
    // round vessels
    const pan=v==='pan', bowl=v==='bowl';
    if(pan) o+=`<rect x="${cx+95}" y="${cy-14}" width="110" height="28" rx="12" fill="#2b2b2b"/>`;
    o+=`<circle cx="${cx+6}" cy="${cy+8}" r="${R0}" fill="rgba(0,0,0,.13)"/>`;
    o+=`<circle cx="${cx}" cy="${cy}" r="${R0}" fill="${pan?'#3b3b3b':'#fbfaf7'}" stroke="${pan?'#262626':'#e3ded3'}" stroke-width="3"/>`;
    const inner=pan?R0*.9:bowl?R0*.8:R0*.78;
    o+=`<circle cx="${cx}" cy="${cy}" r="${inner}" fill="${pan?'#2f2f2f':'#ffffff'}"/>`;
    if(bowl) o+=`<circle cx="${cx}" cy="${cy}" r="${inner}" fill="none" stroke="#eee9df" stroke-width="6"/>`;
    if(bowl||pan){
      const base={x:cx,y:cy,rx:inner*.92,ry:inner*.92};
      o+=drawPart(g,parts[0],base,true,R0);
      parts.slice(1).forEach(pn=>o+=drawPart(g,pn,{x:cx,y:cy,rx:inner*.8,ry:inner*.8},false,R0));
    } else {
      const k=parts.length;
      const main=parts[0];
      if(k===1) o+=drawPart(g,main,{x:cx,y:cy,rx:inner*.82,ry:inner*.82},true,R0);
      else {
        // first part = side on the left half, second = protein on the right, rest = garnish spots
        const reg=[{x:cx-inner*.38,y:cy,rx:inner*.52,ry:inner*.62},{x:cx+inner*.32,y:cy-inner*.08,rx:inner*.5,ry:inner*.5},{x:cx+inner*.3,y:cy+inner*.5,rx:inner*.32,ry:inner*.22},{x:cx-inner*.1,y:cy-inner*.6,rx:inner*.3,ry:inner*.18}];
        parts.forEach((pn,i)=>o+=drawPart(g,pn,reg[Math.min(i,3)],i===0,R0));
      }
    }
  }
  o+='</svg>';
  cache[r.id]=o; return o;
};
})();
