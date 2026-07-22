// ── ui/log.js ─────────────────────────────────────────────────
import { state } from '../config.js';

export function renderLog(){
  const el=document.getElementById("log-body"); if(!el) return;
  const q=(document.getElementById("log-search")?.value||"").toLowerCase();
  const filtered=state.logs.filter(l=>!l.deleted&&(!q||(l.detail||"").toLowerCase().includes(q)||(l.target||"").toLowerCase().includes(q)||(l.user_name||"").toLowerCase().includes(q)));
  const badge=a=>a==="add"?`<span class="rbadge r-add">eklendi</span>`:a==="edit"?`<span class="rbadge r-edit">düzenlendi</span>`:a==="delete"||a==="cancel"?`<span class="rbadge r-delete">silindi/iptal</span>`:a==="import"?`<span class="rbadge r-import">içe aktarıldı</span>`:a==="login"?`<span class="rbadge r-login">giriş</span>`:a==="nakit"?`<span class="rbadge r-add">nakit</span>`:`<span class="rbadge">${a}</span>`;
  el.innerHTML=filtered.slice(0,200).map(l=>`<tr><td style="font-size:11px;color:var(--text3)">${l.ts||"—"}</td><td style="font-size:11px;font-weight:600;color:var(--purple)">${l.user_name||"—"}</td><td>${badge(l.action)}</td><td style="font-size:11px;color:var(--text2)">${l.detail||"—"}</td><td style="font-size:11px;color:var(--text3)">${l.target||"—"}</td></tr>`).join("");
  const cnt=document.getElementById("log-count"); if(cnt) cnt.textContent=filtered.length+" kayıt";
}
