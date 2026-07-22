// ── data.js — Supabase veri yükleme ve log ────────────────────
import { state, HERO_BASE, HERO_KEY } from './config.js';
import { nowStr, showLoading } from './utils.js';

export let db; // Supabase client — main.js'de set edilir
export function setDb(client){ db = client; }

export async function loadAll(){
  showLoading(true);
  try {
    const [cRes,tRes,eRes,lRes,bRes,borRes,scRes] = await Promise.all([
      db.from("customers").select("*").order("id",{ascending:false}),
      db.from("transactions").select("*").order("created_at",{ascending:false}),
      db.from("expenses").select("*").order("created_at",{ascending:false}),
      db.from("logs").select("*").order("created_at",{ascending:false}),
      db.from("bonus_rules").select("*"),
      db.from("borclar").select("*").order("created_at",{ascending:false}),
      db.from("shopier_collections").select("*").order("payment_date",{ascending:false})
    ]);
    state.customers          = (cRes.data||[]).map(c=>({...c,notes:c.notes||[]}));
    state.transactions       = tRes.data||[];
    state.expenses           = eRes.data||[];
    state.logs               = lRes.data||[];
    state.borclar            = (borRes.data||[]).map(b=>({...b,payments:b.payments||[]}));
    state.shopierCollections = scRes.data||[];

    // Nakit kasa
    const {data:nakitData} = await db.from("logs").select("*").eq("action","nakit").order("created_at",{ascending:false}).limit(50);
    state.nakitHareketler = nakitData||[];

    // SMS logs
    await loadSmsLogs();

    // Bonus kuralları
    state.bonusRules = {};
    (bRes.data||[]).forEach(r=>{ state.bonusRules[r.type]=r; });
    if(!state.bonusRules["Havale"]) state.bonusRules = {
      "Havale":  {type:"Havale",  min_amount:500, rate:20, multiple_of:true,  enabled:true},
      "Shopier": {type:"Shopier", min_amount:500, rate:20, multiple_of:true,  enabled:true},
      "Kripto":  {type:"Kripto",  min_amount:500, rate:25, multiple_of:false, enabled:true}
    };
  } catch(e){ console.error("loadAll hatası:", e); }
  showLoading(false);
}

export async function loadSmsLogs(){
  try {
    const {data} = await db.from("sms_logs").select("*").order("created_at",{ascending:false}).limit(500);
    state.smsLogs = data||[];
  } catch(e){ state.smsLogs=[]; }
}

export async function addLog(action, detail, target){
  const entry = {ts:nowStr(), user_name:state.currentUser, action, detail, target, deleted:false};
  state.logs.unshift(entry);
  await db.from("logs").insert(entry);
}
