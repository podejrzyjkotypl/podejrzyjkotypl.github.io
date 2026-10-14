/* Wspólny portfel i ekwipunek dla mini-gier podejrzyjkota.pl
   Punkty: localStorage "podejrzyjkota:v1".points (gra w karty). Brak gry = 0 pkt.
   ZASADA: sklep NIGDY nie zmienia podejrzyjkota:v1.points (ranking i poziomy). Wydane punkty liczymy osobno w items-v1.spent;
   do wydania = max(0, punkty z gry - wydane).
   Docelowo (konto): Wallet.backend = obiekt z rpc buy_item / get_inventory (Supabase), patrz README.
   Katalog: id unikalne globalnie, game = 'kotek' | 'snake' | 'profil' | '*', slot, rarity, price, level (na później). */
(function(){
const PK='podejrzyjkota:v1', MOCK='podejrzyjkota:mock-pts', INV='podejrzyjkota:items-v1';
const RARITY={zwykle:{n:'Zwykłe',c:'#b9b0d6',mult:1},rzadkie:{n:'Rzadkie',c:'#5fb4ff',mult:2.5},epickie:{n:'Epickie',c:'#b07cff',mult:6},legendarne:{n:'Legendarne',c:'#ffcf33',mult:15}};
const CATALOG=[];
let demo=null; // podgląd: stały stan w pamięci
function load(){if(demo)return demo.inv;try{return JSON.parse(localStorage.getItem(INV))||{owned:[],equipped:{}}}catch(e){return{owned:[],equipped:{}}}}
function store(inv){if(!demo)localStorage.setItem(INV,JSON.stringify(inv))}
function real(){try{const g=JSON.parse(localStorage.getItem(PK));return g&&typeof g.points=='number'?g:null}catch(e){return null}}
const W={RARITY,CATALOG,
 register(items){items.forEach(i=>{if(!CATALOG.find(x=>x.id==i.id))CATALOG.push(i)})},
 item:id=>CATALOG.find(x=>x.id==id),
 forGame:(g,slot)=>CATALOG.filter(i=>(i.game==g||i.game=='*')&&(!slot||i.slot==slot)),
 points(){if(demo)return demo.pts;const g=real();return g?Math.max(0,(g.points|0)-(load().spent|0)):0},
 isMock(){return !!demo||!real()},
 spent:()=>load().spent|0,
 owns:id=>load().owned.includes(id),
 buy(id){const it=W.item(id),inv=load();if(!it||inv.owned.includes(id))return false;const p=W.points();if(p<it.price)return false;
  if(demo)demo.pts-=it.price;else{if(!real())return false;inv.spent=(inv.spent|0)+it.price}
  inv.owned.push(id);store(inv);return true},
 equipped(game,slot){return (load().equipped[game]||{})[slot]||null},
 equip(game,slot,id){const inv=load();inv.equipped[game]=inv.equipped[game]||{};if(id&&!inv.owned.includes(id)&&W.item(id)?.price>0)return;inv.equipped[game][slot]=id;store(inv)},
 demo(pts,owned=[],equipped={}){demo={pts,inv:{owned,equipped}}}};
window.Wallet=W;})();
