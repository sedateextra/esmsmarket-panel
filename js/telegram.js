// ── telegram.js — Telegram bot bildirimleri ───────────────────
import { TG_TOKEN, TG_CHAT_ID, state } from './config.js';
import { fmt, nowStr } from './utils.js';

export async function sendTelegram(msg){
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({chat_id: TG_CHAT_ID, text: msg, parse_mode: "HTML"})
    });
  } catch(e){ console.error("Telegram hatası:", e); }
}

export async function tgYeniUye(c){
  await sendTelegram(`👤 <b>Yeni Üye Kaydı</b>
━━━━━━━━━━━━━━
İsim: ${c.name}
E-posta: ${c.email}
ID: ${c.id}
Kayıt: ${c.since||nowStr()}
👥 Toplam üye: ${state.customers.length}`);
}

export async function tgYatirim(tx, cust){
  await sendTelegram(`💰 <b>Yeni Yatırım</b>
━━━━━━━━━━━━━━
Üye: ${tx.cust_name} (${cust?.id||""})
Tutar: ${fmt(tx.amount)}
Bonus: +${fmt(tx.bonus)} (%${tx.bonus>0?Math.round((tx.bonus/tx.amount)*100):0})
Toplam: ${fmt(tx.total)}
Yöntem: ${tx.type}
İşlemci: ${tx.user_name}
⏰ ${nowStr()}`);
}

export async function tgBorcOdeme(b, amt){
  const kalan = (b.amount||0)-(b.paid||0);
  await sendTelegram(`✅ <b>Borç Ödemesi Alındı</b>
━━━━━━━━━━━━━━
Borçlu: ${b.name}
Alınan: ${fmt(amt)}
Kalan borç: ${fmt(kalan)}
Durum: ${b.status}
İşlemci: ${state.currentUser}
⏰ ${nowStr()}`);
}

export async function sendNightReport(){
  const today = new Date();
  const activeTx = state.transactions.filter(t=>!t.cancelled);
  const todayTx = activeTx.filter(t=>{
    if(!t.created_at) return false;
    return new Date(t.created_at).toDateString()===today.toDateString();
  });
  const monthStart = new Date(today.getFullYear(),today.getMonth(),1);
  const monthTx = activeTx.filter(t=>{
    if(!t.created_at) return false;
    return new Date(t.created_at)>=monthStart;
  });
  const todayIncome  = todayTx.reduce((s,t)=>s+t.amount,0);
  const todayBonus   = todayTx.reduce((s,t)=>s+t.bonus,0);
  const monthIncome  = monthTx.reduce((s,t)=>s+t.amount,0);
  const totalIncome  = activeTx.reduce((s,t)=>s+t.amount,0);
  const totalBonus2  = activeTx.reduce((s,t)=>s+t.bonus,0);
  const totalExpense = state.expenses.reduce((s,e)=>s+e.amount,0);
  const netKasa      = totalIncome-totalBonus2-totalExpense;
  const pendingDebt  = state.borclar.filter(b=>b.status!=="Ödendi").reduce((s,b)=>s+(b.amount||0)-(b.paid||0),0);
  const todayNew = state.customers.filter(c=>{
    const d = (c.since||"").split(".");
    if(d.length!==3) return false;
    return new Date(parseInt(d[2]),parseInt(d[1])-1,parseInt(d[0])).toDateString()===today.toDateString();
  }).length;

  await sendTelegram(`🌙 <b>ESMSMarket Gece Özeti</b>
📅 ${today.toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"})}
━━━━━━━━━━━━━━
💰 Bugünkü gelir: <b>${fmt(todayIncome)}</b>
🎁 Verilen bonus: <b>${fmt(todayBonus)}</b>
📊 İşlem sayısı: <b>${todayTx.length}</b>
👤 Yeni üye: <b>${todayNew}</b>
━━━━━━━━━━━━━━
💵 Aylık gelir: <b>${fmt(monthIncome)}</b>
⚠️ Bekleyen borç: <b>${fmt(pendingDebt)}</b>
👥 Toplam üye: <b>${state.customers.length}</b>
💎 Net kasa: <b>${fmt(netKasa)}</b>`);
}

export function scheduleNightReport(){
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24,0,0,0);
  setTimeout(async ()=>{
    await sendNightReport();
    setInterval(sendNightReport, 24*60*60*1000);
  }, midnight - now);
}
