// ── ui/bonus.js ───────────────────────────────────────────────
import { state } from '../config.js';
import { db, addLog } from '../data.js';
import { fmt, showLoading, showToast } from '../utils.js';

export function openBonusRuleModal(){
  showToast("💡 Kurallar aşağıdaki listeden düzenlenip kaydedilebilir. Yeni ödeme türü eklenemez.");
}

export function renderBonusRulesEditor(){
  const el=document.getElementById("bonus-rules-list"); if(!el) return;
  const icons={"Havale":"ti-building-bank","Shopier":"ti-brand-shopee","Kripto":"ti-currency-bitcoin"};
  const colors={"Havale":"rgba(59,130,246,.15)","Shopier":"rgba(16,185,129,.15)","Kripto":"rgba(245,158,11,.15)"};
  const tColors={"Havale":"var(--info)","Shopier":"var(--success)","Kripto":"var(--warning)"};
  const examples={"Havale":[500,1000,750],"Shopier":[500,1000,300],"Kripto":[500,800,1200]};

  el.innerHTML=Object.entries(state.bonusRules).map(([type,rule])=>{
    const ex=examples[type]||[500,1000];
    const bColors={"Havale":"rgba(59,130,246,.2)","Shopier":"rgba(16,185,129,.2)","Kripto":"rgba(245,158,11,.2)"};
    const lines=ex.map(amt=>{const b=calcBonusAmtLocal(amt,rule);return`<div style="font-size:11px;color:var(--text3);padding:3px 0">${fmt(amt)} → <span style="color:${b>0?"var(--success)":"var(--text3)"}">${b>0?"+"+fmt(b)+" = "+fmt(amt+b):"bonus yok"}</span></div>`;}).join("");
    return `<div class="bonus-rule-row">
      <div class="bonus-rule-icon" style="background:${colors[type]};color:${tColors[type]}"><i class="ti ${icons[type]}"></i></div>
      <div class="bonus-rule-info">
        <div class="bonus-rule-title">${type}</div>
        <div style="font-size:11px;color:var(--text3)">${rule.multiple_of?"Katlarında":"Ve üzerinde"} bonus</div>
        <div style="margin-top:6px;padding:8px;background:var(--bg2);border-radius:8px;border:1px solid ${bColors[type]||"var(--border)"}">${lines}</div>
      </div>
      <div class="bonus-rule-inputs">
        <div style="display:flex;flex-direction:column;gap:3px;align-items:center"><span style="font-size:10px;color:var(--text3)">Min ₺</span><input type="number" id="rule-min-${type}" value="${rule.min_amount}" min="0" step="100"></div>
        <div style="display:flex;flex-direction:column;gap:3px;align-items:center"><span style="font-size:10px;color:var(--text3)">Oran %</span><input type="number" id="rule-rate-${type}" value="${rule.rate}" min="0" max="100"></div>
        <div style="display:flex;flex-direction:column;gap:3px;align-items:center"><span style="font-size:10px;color:var(--text3)">Katları</span><select id="rule-mult-${type}"><option value="1" ${rule.multiple_of?"selected":""}>Evet</option><option value="0" ${!rule.multiple_of?"selected":""}>Hayır</option></select></div>
        <div style="display:flex;flex-direction:column;gap:3px;align-items:center"><span style="font-size:10px;color:var(--text3)">Aktif</span><select id="rule-enabled-${type}"><option value="1" ${rule.enabled?"selected":""}>Açık</option><option value="0" ${!rule.enabled?"selected":""}>Kapalı</option></select></div>
        <button onclick="saveBonusRule('${type}')" class="btn-xs" style="margin-top:16px">Kaydet</button>
      </div>
    </div>`;
  }).join("");
}

function calcBonusAmtLocal(amt,rule){
  if(!rule||!rule.enabled) return 0;
  if(rule.multiple_of&&amt>=rule.min_amount&&amt%rule.min_amount===0) return Math.round(amt*(rule.rate/100));
  if(!rule.multiple_of&&amt>=rule.min_amount) return Math.round(amt*(rule.rate/100));
  return 0;
}

export async function saveBonusRule(type){
  const min=parseFloat(document.getElementById(`rule-min-${type}`)?.value)||0;
  const rate=parseFloat(document.getElementById(`rule-rate-${type}`)?.value)||0;
  const mult=document.getElementById(`rule-mult-${type}`)?.value==="1";
  const enabled=document.getElementById(`rule-enabled-${type}`)?.value==="1";
  const rule={type,min_amount:min,rate,multiple_of:mult,enabled};
  showLoading(true);
  const existing=state.bonusRules[type];
  if(existing?.id){
    await db.from("bonus_rules").update(rule).eq("id",existing.id);
  } else {
    const {data}=await db.from("bonus_rules").insert(rule).select();
    if(data&&data[0]) rule.id=data[0].id;
  }
  state.bonusRules[type]=rule;
  await addLog("edit",`${type} bonus kuralı güncellendi`,`Min:${min} Oran:%${rate}`);
  showLoading(false);
  renderBonusRulesEditor();
  showToast(`✅ ${type} bonus kuralı kaydedildi!`);
}
