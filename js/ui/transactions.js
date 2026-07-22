// ── ui/transactions.js ────────────────────────────────────────
import { state } from '../config.js';
import { db, addLog } from '../data.js';
import { fmt, todayStr, showLoading } from '../utils.js';
import { tgYatirim } from '../telegram.js';
import { renderCustomers, populateCustSelect } from './customers.js';
import { updateKasaMetrics } from './kasa.js';
import { renderTop10 } from './top10.js';

export function calcBonusAmt(amt, type){
  const rule = state.bonusRules[type];
  if(!rule||!rule.enabled) return 0;
  if(rule.multiple_of&&amt>=rule.min_amount&&amt%rule.min_amount===0) return Math.round(amt*(rule.rate/100));
  if(!rule.multiple_of&&amt>=rule.min_amount) return Math.round(amt*(rule.rate/100));
  return 0;
}

export function calcBonus(){
  const amt  = parseFloat(document.getElementById("new-amount")?.value)||0;
  const type = document.getElementById("new-type")?.value;
  const info = document.getElementById("bonus-info");
  const bonus = calcBonusAmt(amt,type);
  if(bonus>0){
    info.innerHTML=`<i class="ti ti-gift" style="margin-right:4px"></i>${type} bonusu: ${fmt(bonus)} (%${state.bonusRules[type]?.rate}) → Toplam: ${fmt(amt+bonus)}`;
    info.classList.remove("hidden");
  } else {
    info.classList.add("hidden");
  }
}

export async function saveTransaction(){
  const custId = document.getElementById("new-cust-select")?.value;
  const amt    = parseFloat(document.getElementById("new-amount")?.value)||0;
  const type   = document.getElementById("new-type")?.value;
  const note   = document.getElementById("new-note")?.value.trim();
  if(!custId||!amt){ alert("Üye ve tutar zorunludur."); return; }
  const cust  = state.customers.find(c=>c.id===custId);
  const bonus = calcBonusAmt(amt,type);
  const total = amt+bonus;
  if(!confirm(`${cust.name} — ${fmt(amt)}${bonus>0?" + "+fmt(bonus)+" bonus":""} (${type})\nToplam: ${fmt(total)}\nOnayla?`)) return;
  showLoading(true);
  const tx = {cust_id:custId,cust_name:cust.name,amount:amt,bonus,total,type,note,date:todayStr(),user_name:state.currentUser,cancelled:false};
  const {data} = await db.from("transactions").insert(tx).select();
  if(data&&data[0]) state.transactions.unshift(data[0]);
  const oldBal = cust.balance||0;
  cust.balance = oldBal+total;
  await db.from("customers").update({balance:cust.balance}).eq("id",custId);
  await db.from("balance_history").insert({
    cust_id:custId, cust_name:cust.name,
    old_balance:oldBal, new_balance:cust.balance, change_amount:total,
    reason:`Yükleme — ${fmt(amt)}${bonus>0?" +"+fmt(bonus)+" bonus":""} (${type})`,
    user_name:state.currentUser
  });
  await addLog("add",`Yatırım — ${fmt(amt)} (${type})`,cust.name);
  await tgYatirim(tx,cust);
  showLoading(false);
  renderNewTxTable();
  updateKasaMetrics();
  renderCustomers();
  clearTxForm();
  renderTop10();
}

export async function cancelTransaction(txId){
  const tx = state.transactions.find(t=>t.id===txId);
  if(!tx||tx.cancelled) return;
  if(!confirm(`"${tx.cust_name}" için ${fmt(tx.amount)} tutarındaki işlem iptal edilsin mi?`)) return;
  showLoading(true);
  tx.cancelled = true;
  await db.from("transactions").update({cancelled:true}).eq("id",txId);
  const cust = state.customers.find(c=>c.id===tx.cust_id);
  if(cust){
    const oldBal = cust.balance||0;
    cust.balance = Math.max(0,oldBal-tx.total);
    await db.from("customers").update({balance:cust.balance}).eq("id",cust.id);
    await db.from("balance_history").insert({
      cust_id:cust.id, cust_name:cust.name,
      old_balance:oldBal, new_balance:cust.balance, change_amount:-tx.total,
      reason:`İptal — ${fmt(tx.amount)} (${tx.type})`,
      user_name:state.currentUser
    });
  }
  await addLog("cancel",`İşlem iptal — ${fmt(tx.amount)} (${tx.type})`,tx.cust_name);
  showLoading(false);
  renderNewTxTable();
  updateKasaMetrics();
  renderCustomers();
  renderTop10();
}

export function renderNewTxTable(){
  const tbody = document.getElementById("new-tx-body");
  if(!tbody) return;
  const filterVal = document.getElementById("tx-source-filter")?.value||"all";
  const filtered = state.transactions.filter(t=>{
    if(filterVal==="shopier") return t.user_name==="shopier-bot";
    if(filterVal==="manuel")  return t.user_name!=="shopier-bot";
    return true;
  });
  document.getElementById("no-tx").style.display = filtered.length?"none":"block";
  tbody.innerHTML = filtered.map(t=>{
    const isShopier = t.user_name==="shopier-bot";
    const srcBadge = isShopier
      ? `<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:rgba(16,185,129,.15);color:var(--success);border:1px solid rgba(16,185,129,.3);font-weight:600">🤖 Shopier</span>`
      : `<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:rgba(139,92,246,.15);color:var(--purple);border:1px solid rgba(139,92,246,.3);font-weight:600">👤 Manuel</span>`;
    return `<tr class="${t.cancelled?"cancelled-row":""}">
      <td>${t.cust_name}</td>
      <td style="font-weight:700">${fmt(t.amount)}</td>
      <td style="color:var(--success)">${t.bonus>0?fmt(t.bonus):"—"}</td>
      <td style="font-weight:700">${fmt(t.total)}</td>
      <td><span class="tbadge">${t.type}</span></td>
      <td>${srcBadge}</td>
      <td style="color:var(--text3)">${t.date}</td>
      <td style="color:var(--text3)">${t.note||"—"}</td>
      <td>${!t.cancelled?`<button class="btn-warning-sm" onclick="cancelTransaction(${t.id})"><i class="ti ti-arrow-back-up"></i></button>`:`<span class="rbadge r-cancel">iptal</span>`}</td>
    </tr>`;
  }).join("");
}

export function clearTxForm(){
  ["new-cust-select","new-amount","new-note"].forEach(i=>{
    const el=document.getElementById(i); if(el) el.value="";
  });
  const nt = document.getElementById("new-type"); if(nt) nt.value="Havale";
  document.getElementById("bonus-info")?.classList.add("hidden");
}

export function renderSidebar(){
  const el = document.getElementById("tx-list"); if(!el) return;
  const active = state.transactions.filter(t=>!t.cancelled).slice(0,5);
  const tGrads = {"Havale":"linear-gradient(135deg,#3b82f6,#1d4ed8)","Shopier":"linear-gradient(135deg,#10b981,#047857)","Kripto":"linear-gradient(135deg,#f59e0b,#d97706)"};
  el.innerHTML = active.length ? active.map(t=>{
    const isS = t.user_name==="shopier-bot";
    const gr  = isS?"linear-gradient(135deg,#10b981,#047857)":(tGrads[t.type]||"var(--card2)");
    const em  = isS?"🤖":({"Havale":"🏦","Shopier":"🤖","Kripto":"₿"}[t.type]||"💰");
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
      <div style="width:30px;height:30px;border-radius:8px;background:${gr};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">${em}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.cust_name}</div>
        <div style="font-size:10px;color:var(--text3)">${t.type}${isS?" · 🤖 Shopier":""}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:12px;font-weight:700;color:var(--success)">${fmt(t.amount)}</div>
        <div style="font-size:10px;color:var(--text3)">${t.date||""}</div>
      </div>
    </div>`;
  }).join("") : '<div style="font-size:12px;color:var(--text3);padding:.5rem 0;text-align:center">Henüz işlem yok.</div>';
}
