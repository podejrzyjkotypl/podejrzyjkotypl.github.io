/* Wspólny portfel i ekwipunek mini-gier podejrzyjkota.pl
   ZASADA: sklep NIGDY nie zmienia punktów rankingu (podejrzyjkota:v1.points / profiles.points) ani XP.
   Wydane punkty liczymy osobno: do wydania = punkty - wydane.
   Tryby:
   - gość: punkty z localStorage "podejrzyjkota:v1".points, wydane w "podejrzyjkota:items-v1".spent (brak gry = 0 pkt);
   - zalogowany (sesja "podejrzyjkota-auth" + w bazie funkcje get_shop_state/buy_item/set_equipped):
     stan z serwera, zakupy przez buy_item (profiles.points_spent). Jeśli funkcji jeszcze nie ma w bazie,
     zostajemy w trybie gościa (feature detection), więc strona działa przed wgraniem SQL.
   Przy pierwszym logowaniu lokalnie kupione rzeczy próbujemy kupić na serwerze (płatne z punktów konta, bez darmowych kopii).
   API: Wallet.points(), owns(id), buy(id) -> Promise<bool>, equipped(game,slot), equip(game,slot,id), onChange(fn), mode */
(function(){
const PK='podejrzyjkota:v1', INV='podejrzyjkota:items-v1', AUTH='podejrzyjkota-auth';
const RARITY={zwykle:{n:'Zwykłe',c:'#b9b0d6'},rzadkie:{n:'Rzadkie',c:'#5fb4ff'},epickie:{n:'Epickie',c:'#b07cff'},legendarne:{n:'Legendarne',c:'#ffcf33'}};
const CATALOG=[],subs=[];
let demo=null, srv=null, sb=null; // srv = {balance, owned:[], equipped:{'game:slot':id}, uid}
function load(){if(demo)return demo.inv;try{const v=JSON.parse(localStorage.getItem(INV));if(v)return Object.assign({owned:[],equipped:{},spent:0},v)}catch(e){}return{owned:[],equipped:{},spent:0}}
function store(inv){if(!demo)try{localStorage.setItem(INV,JSON.stringify(inv))}catch(e){}}
function real(){try{const g=JSON.parse(localStorage.getItem(PK));return g&&typeof g.points=='number'?g:null}catch(e){return null}}
function emit(){subs.forEach(f=>{try{f()}catch(e){console.error(e)}})}
function msg(e){return (e&&e.message)||'Coś poszło nie tak. Spróbuj za chwilę.'}
const W={RARITY,CATALOG,mode:'guest',lastError:null,
 register(items){items.forEach(i=>{if(!CATALOG.find(x=>x.id==i.id))CATALOG.push(i)})},
 item:id=>CATALOG.find(x=>x.id==id),
 forGame:(g,slot)=>CATALOG.filter(i=>(i.game==g||i.game=='*')&&(!slot||i.slot==slot)),
 onChange(f){subs.push(f)},
 points(){if(demo)return demo.pts;if(srv)return srv.balance;const g=real();return g?Math.max(0,(g.points|0)-(load().spent|0)):0},
 spent:()=>load().spent|0,
 owns(id){if(srv)return srv.owned.includes(id);return load().owned.includes(id)},
 async buy(id){const it=W.item(id);W.lastError=null;if(!it||W.owns(id))return false;
  if(W.points()<it.price){W.lastError='Masz za mało punktów.';return false}
  if(srv){try{const {data,error}=await sb.rpc('buy_item',{p_item:id});if(error)throw error;
     if(!srv.owned.includes(id))srv.owned.push(id);srv.balance=data.balance;emit();return true}catch(e){W.lastError=msg(e);emit();return false}}
  const inv=load();
  if(demo)demo.pts-=it.price;else{if(!real())return false;inv.spent=(inv.spent|0)+it.price}
  inv.owned.push(id);store(inv);emit();return true},
 equipped(game,slot){if(srv)return srv.equipped[game+':'+slot]||null;return (load().equipped[game]||{})[slot]||null},
 equip(game,slot,id){if(id&&!W.owns(id)&&W.item(id)?.price>0)return;
  if(srv){if(id)srv.equipped[game+':'+slot]=id;else delete srv.equipped[game+':'+slot];
   sb.rpc('set_equipped',{p_game:game,p_slot:slot,p_item:id||null}).then(r=>{if(r.error)console.warn(r.error)});return}
  const inv=load();inv.equipped[game]=inv.equipped[game]||{};inv.equipped[game][slot]=id;store(inv)},
 demo(pts,owned=[],equipped={}){demo={pts,inv:{owned,equipped,spent:0}};srv=null;W.mode='demo'}};
window.Wallet=W;

// ---------- tryb konta (feature-detected) ----------
async function initServer(){
  const cfg=window.PODEJRZYJKOTA_CONFIG;if(demo||!cfg||!cfg.supabaseUrl||!cfg.supabaseAnonKey)return;
  if(!localStorage.getItem(AUTH))return; // niezalogowany: nic nie ładujemy
  const base=(document.currentScript&&document.currentScript.src)||'';
  if(!(window.supabase&&window.supabase.createClient))await new Promise((ok,no)=>{const s=document.createElement('script');s.src='js/vendor/supabase.js';s.onload=ok;s.onerror=no;document.head.appendChild(s)});
  sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:AUTH}});
  const {data:{session}}=await sb.auth.getSession();if(!session)return;
  const {data,error}=await sb.rpc('get_shop_state');
  if(error){console.info('Sklep: tryb lokalny (serwer jeszcze bez funkcji sklepu).',error.code||'');return}
  srv={balance:data.balance|0,owned:data.owned||[],equipped:data.equipped||{},uid:session.user.id};W.mode='server';
  // jednorazowa migracja lokalnych zakupów (płatna z salda konta)
  const flag='podejrzyjkota:items-migrated:'+srv.uid;
  if(!localStorage.getItem(flag)){const inv=load();
    for(const id of inv.owned){if(srv.owned.includes(id)||!W.item(id))continue;
      const r=await sb.rpc('buy_item',{p_item:id});if(!r.error){srv.owned.push(id);srv.balance=r.data.balance}}
    for(const g in inv.equipped)for(const sl in inv.equipped[g]){const id=inv.equipped[g][sl];
      if(id&&srv.owned.includes(id)&&!srv.equipped[g+':'+sl]){srv.equipped[g+':'+sl]=id;sb.rpc('set_equipped',{p_game:g,p_slot:sl,p_item:id})}}
    localStorage.setItem(flag,new Date().toISOString())}
  emit();
}
W.ready=new Promise(r=>setTimeout(r,0)).then(initServer).catch(e=>console.info('Sklep: tryb lokalny.',e&&e.message));
})();
