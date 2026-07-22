// ── ui/sms.js ─────────────────────────────────────────────────
// SMS Takip sayfası — Hero SMS API entegrasyonu
import { state, HERO_BASE, HERO_KEY } from '../config.js';
import { db } from '../data.js';
import { fmt, showToast } from '../utils.js';
import { sendTelegram } from '../telegram.js';

const LOW_BALANCE_THRESHOLD = 50;
let activeActivationsData = [];
let histFilter = "all";
let autoRefreshTimer = null;

const COUNTRY_NAMES = {
  0:"Rusya",1:"Ukrayna",2:"Kazakistan",3:"Çin",4:"Filipinler",5:"Myanmar",
  6:"İndonezya",7:"Malezya",8:"Kenya",22:"Türkiye",29:"ABD",
  31:"İngiltere",33:"Fransa",34:"İspanya",39:"İtalya",44:"Hollanda",
  49:"Almanya",55:"Brezilya",62:"Hindistan",64:"Endonezya",66:"Tayland",
  77:"Meksika",84:"Pakistan",86:"Mısır",88:"Nijerya"
};

const SERVICE_NAMES = {
  "vk":"VKontakte","ok":"Odnoklassniki","wa":"WhatsApp","viber":"Viber",
  "tg":"Telegram","ig":"Instagram","fb":"Facebook","tw":"Twitter/X",
  "go":"Google","yt":"YouTube","am":"Amazon","tt":"TikTok",
  "ln":"LinkedIn","ds":"Discord","ub":"Uber","af":"Airbnb",
  "nf":"Netflix","sp":"Spotify","pp":"PayPal","ma":"Mail.ru",
  "ya":"Yandex","av":"Avito","wb":"Wildberries","oz":"Ozon",
  "sn":"Snapchat","pt":"Pinterest","rd":"Reddit","ms":"Microsoft"
};
const SERVICE_COLORS = {
  "vk":"#4680C2","ok":"#F7931A","wa":"#25D366","viber":"#7360F2",
  "tg":"#2AABEE","ig":"#E1306C","fb":"#1877F2","tw":"#000000",
  "go":"#4285F4","yt":"#FF0000","am":"#FF9900","tt":"#000000",
  "ln":"#0A66C2","ds":"#5865F2"
};
const SERVICE_ICONS = {
  "wa":"ti-brand-whatsapp","tg":"ti-brand-telegram","ig":"ti-brand-instagram",
  "fb":"ti-brand-facebook","tw":"ti-brand-twitter","go":"ti-brand-google",
  "yt":"ti-brand-youtube","am":"ti-brand-amazon","tt":"ti-brand-tiktok",
  "ln":"ti-brand-linkedin","ds":"ti-brand-discord","vk":"ti-brand-vk"
};

function getCountryName(code){ return COUNTRY_NAMES[parseInt(code)]||("Ülke "+code); }

export async function loadSmsLogs(){
  try {
    const {data}=await db.from("sms_logs").select("*").order("created_at",{ascending:false}).limit(500);
    state.smsLogs=data||[];
  } catch(e){ state.smsLogs=[]; }
}

export function renderSmsPage(){
  fetchHeroBalance();
  loadActiveActivations();
  renderSmsHistory();
  renderSmsStats();
  renderSmsBody();
}

// ── SMS Takip sayfasındaki ana log tablosu (#sms-body) ─────────
export async function loadSMSHistory(){
  await loadSmsLogs();
  renderSmsBody();
  showToast("✅ SMS geçmişi güncellendi.");
}

function renderSmsBody(){
  const tbody=document.getElementById("sms-body"); if(!tbody) return;
  const logs=[...state.smsLogs].sort((a,b)=>(new Date(b.created_at||0))-(new Date(a.created_at||0)));
  const statusLabels={"success":"✅ Tamamlandı","cancelled":"❌ İptal","pending":"⏳ Bekliyor"};
  const statusColors={"success":"var(--success)","cancelled":"var(--danger)","pending":"var(--warning)"};
  tbody.innerHTML = logs.length ? logs.slice(0,200).map(l=>{
    const svcKey=(l.service||"").toLowerCase();
    const svcName=SERVICE_NAMES[svcKey]||l.service||"—";
    const sc=statusColors[l.status]||"var(--text3)";
    const dt=l.created_at
      ? new Date(l.created_at).toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"})+" "+new Date(l.created_at).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})
      : "—";
    return `<tr>
      <td style="font-size:11px;color:var(--text3)">${l.activation_id||"—"}</td>
      <td style="font-size:11px;font-weight:600">${l.phone||"—"}</td>
      <td style="font-size:12px">${svcName}</td>
      <td style="font-size:11px;color:var(--warning)">$${parseFloat(l.cost||l.price||0).toFixed(4)}</td>
      <td><span style="font-size:10px;padding:2px 7px;border-radius:10px;background:${sc}20;color:${sc};border:1px solid ${sc}40">${statusLabels[l.status]||l.status||"—"}</span></td>
      <td style="font-size:11px;color:var(--text3)">${dt}</td>
    </tr>`;
  }).join("") : `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text3)">Kayıt yok.</td></tr>`;
}

async function fetchHeroBalance(){
  const el=document.getElementById("sms-balance"); if(!el) return;
  el.textContent="...";
  try {
    const res=await fetch(`${HERO_BASE}?api_key=${HERO_KEY}&action=getBalance`);
    const text=await res.text();
    if(text.includes("ACCESS_BALANCE:")){
      const bal=parseFloat(text.split("ACCESS_BALANCE:")[1]);
      el.textContent="$"+bal.toFixed(2);
      if(bal<LOW_BALANCE_THRESHOLD){
        const today=new Date().toDateString();
        if(localStorage.getItem("hero_balance_warn")!==today){
          localStorage.setItem("hero_balance_warn",today);
          sendTelegram("⚠️ Hero SMS Düşük Bakiye! $"+bal+" (Limit: $"+LOW_BALANCE_THRESHOLD+")");
        }
      }
    } else { el.textContent="—"; }
  } catch(e){ el.textContent="—"; }
}

async function loadActiveActivations(){
  try {
    const res=await fetch(`${HERO_BASE}?api_key=${HERO_KEY}&action=getActiveActivations&limit=100`);
    const data=await res.json();
    const list=data.data||[];
    activeActivationsData=list;
    if(document.getElementById("active-badge")) document.getElementById("active-badge").textContent=list.length;
    if(document.getElementById("sms-active-count")) document.getElementById("sms-active-count").textContent=list.length;
    const tbody=document.getElementById("active-body"); if(!tbody) return;
    document.getElementById("no-active").style.display=list.length?"none":"block";
    tbody.innerHTML=list.map(a=>{
      const svcKey=(a.serviceCode||"").toLowerCase();
      const svcName=SERVICE_NAMES[svcKey]||a.serviceCode||"—";
      const color=SERVICE_COLORS[svcKey]||"#8b5cf6";
      const icon=SERVICE_ICONS[svcKey]||"ti-message-2";
      const country=a.countryName||getCountryName(a.countryCode);
      const dt=a.activationTime?a.activationTime.substring(0,16):"—";
      const statusMap={"1":"Bekliyor","2":"SMS Alındı","3":"Tamamlandı","8":"İptal","9":"İade"};
      const sl=statusMap[String(a.activationStatus)]||"Aktif";
      const sc=String(a.activationStatus)==="2"?"var(--success)":["8","9"].includes(String(a.activationStatus))?"var(--danger)":"var(--purple)";
      return `<tr onclick="openActivationModal('${a.activationId}')" style="cursor:pointer">
        <td style="font-size:11px;color:var(--text3)">${a.activationId||"—"}</td>
        <td><div style="display:flex;align-items:center;gap:6px"><div style="width:20px;height:20px;border-radius:5px;background:${color}20;display:flex;align-items:center;justify-content:center"><i class="ti ${icon}" style="color:${color};font-size:11px"></i></div><span style="font-size:12px;font-weight:600">${svcName}</span></div></td>
        <td style="font-size:11px">${a.phoneNumber||"—"}</td>
        <td style="font-size:11px;color:var(--text2)">${country}</td>
        <td style="font-size:11px;color:var(--warning)">$${parseFloat(a.activationCost||0).toFixed(4)}</td>
        <td><span style="font-size:10px;padding:2px 7px;border-radius:10px;background:${sc}20;color:${sc};border:1px solid ${sc}40">${sl}</span></td>
        <td style="font-size:11px;color:var(--text3)">${dt}</td>
      </tr>`;
    }).join("");
  } catch(e){ console.error("Active activations error:",e); }
}

export function openActivationModal(activationId){
  const a=activeActivationsData.find(x=>String(x.activationId)===String(activationId));
  if(!a) return;
  const svcKey=(a.serviceCode||"").toLowerCase();
  const svcName=SERVICE_NAMES[svcKey]||a.serviceCode||"—";
  const color=SERVICE_COLORS[svcKey]||"#8b5cf6";
  const icon=SERVICE_ICONS[svcKey]||"ti-message-2";
  const countryName=a.countryName||getCountryName(a.countryCode);
  const statusMap={"1":"Bekliyor","2":"SMS Alındı","3":"Tamamlandı","4":"Yeniden Gönder","8":"İptal","9":"İade"};
  const statusLabel=statusMap[String(a.activationStatus)]||"Aktif";
  const statusColor=String(a.activationStatus)==="2"?"var(--success)":["8","9"].includes(String(a.activationStatus))?"var(--danger)":"var(--purple)";
  const el=document.getElementById("activation-detail-modal"); if(!el) return;
  el.innerHTML=`<div class="modal" style="max-width:480px">
    <div class="modal-hdr">
      <h3><div style="display:inline-flex;align-items:center;gap:8px"><div style="width:28px;height:28px;border-radius:7px;background:${color}20;display:flex;align-items:center;justify-content:center"><i class="ti ${icon}" style="color:${color}"></i></div>${svcName}</div></h3>
      <button onclick="document.getElementById('activation-detail-modal').style.display='none'"><i class="ti ti-x"></i></button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div class="metric"><div class="lbl">Numara</div><div style="font-size:14px;font-weight:700;color:var(--text)">${a.phoneNumber||"—"}</div></div>
      <div class="metric"><div class="lbl">Ülke</div><div style="font-size:14px;font-weight:700;color:var(--text)">${countryName}</div></div>
      <div class="metric"><div class="lbl">Durum</div><div style="font-size:13px;font-weight:700;color:${statusColor}">${statusLabel}</div></div>
      <div class="metric"><div class="lbl">Maliyet</div><div style="font-size:13px;font-weight:700;color:var(--warning)">$${parseFloat(a.activationCost||0).toFixed(4)}</div></div>
    </div>
    ${a.smsCode?`<div style="padding:14px;border-radius:10px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);text-align:center;margin-bottom:12px"><div style="font-size:11px;color:var(--text2);margin-bottom:4px">SMS Kodu</div><div style="font-size:22px;font-weight:700;color:var(--success);letter-spacing:4px">${a.smsCode}</div></div>`:''}
    <div style="font-size:11px;color:var(--text3);margin-bottom:12px">ID: ${a.activationId} · ${a.activationTime?a.activationTime.substring(0,16):"—"}</div>
    <button onclick="document.getElementById('activation-detail-modal').style.display='none'" class="btn-cancel" style="width:100%">Kapat</button>
  </div>`;
  el.style.display="flex";
}

function renderSmsHistory(){
  const tbody=document.getElementById("sms-history-body"); if(!tbody) return;
  const q=(document.getElementById("sms-hist-search")?.value||"").toLowerCase();
  let filtered=state.smsLogs;
  if(q) filtered=filtered.filter(l=>(l.phone||"").includes(q)||(l.service||"").toLowerCase().includes(q)||(l.sms_code||"").includes(q));
  if(histFilter!=="all") filtered=filtered.filter(l=>l.status===histFilter);
  const dateFrom=document.getElementById("sms-date-from")?.value||"";
  const dateTo=document.getElementById("sms-date-to")?.value||"";
  if(dateFrom||dateTo) filtered=filtered.filter(l=>{
    if(!l.created_at) return false;
    const d=new Date(l.created_at);
    if(dateFrom&&d<new Date(dateFrom)) return false;
    if(dateTo  &&d>new Date(dateTo+"T23:59:59")) return false;
    return true;
  });
  const sortBy=document.getElementById("sms-sort")?.value||"date-desc";
  filtered.sort((a,b)=>sortBy==="date-desc"?(new Date(b.created_at||0))-(new Date(a.created_at||0)):(new Date(a.created_at||0))-(new Date(b.created_at||0)));
  if(document.getElementById("sms-history-count")) document.getElementById("sms-history-count").textContent=filtered.length+" kayıt";
  if(document.getElementById("no-sms-hist")) document.getElementById("no-sms-hist").style.display=filtered.length?"none":"block";
  const statusColors={"success":"var(--success)","cancelled":"var(--danger)","pending":"var(--warning)"};
  const statusLabels={"success":"✅ Tamamlandı","cancelled":"❌ İptal","pending":"⏳ Bekliyor"};
  tbody.innerHTML=filtered.slice(0,200).map(l=>{
    const svcKey=(l.service||"").toLowerCase();
    const color=SERVICE_COLORS[svcKey]||"#8b5cf6";
    const icon=SERVICE_ICONS[svcKey]||"ti-message-2";
    const dt=l.created_at?new Date(l.created_at).toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"})+" "+new Date(l.created_at).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"}):"—";
    const sc=statusColors[l.status]||"var(--text3)";
    return `<tr>
      <td style="font-size:11px;color:var(--text3)">${l.activation_id||"—"}</td>
      <td><div style="display:flex;align-items:center;gap:5px"><div style="width:18px;height:18px;border-radius:4px;background:${color}20;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="ti ${icon}" style="color:${color};font-size:10px"></i></div><span style="font-size:12px">${SERVICE_NAMES[svcKey]||l.service||"—"}</span></div></td>
      <td style="font-size:11px;font-weight:600">${l.phone||"—"}</td>
      <td style="font-size:12px;font-weight:700;color:var(--success);letter-spacing:2px">${l.sms_code||"—"}</td>
      <td style="font-size:11px;color:var(--text2)">${getCountryName(l.country_id)||l.country||"—"}</td>
      <td style="font-size:11px;color:var(--warning)">$${parseFloat(l.cost||l.price||0).toFixed(4)}</td>
      <td><span style="font-size:10px;padding:2px 6px;border-radius:10px;background:${sc}20;color:${sc};border:1px solid ${sc}40">${statusLabels[l.status]||l.status||"—"}</span></td>
      <td style="font-size:11px;color:var(--text3)">${dt}</td>
    </tr>`;
  }).join("");
}

function renderSmsStats(){
  const logs=state.smsLogs;
  const success=logs.filter(l=>l.status==="success");
  const totalCost=logs.reduce((s,l)=>s+(parseFloat(l.cost||l.price||0)),0);
  const successCost=success.reduce((s,l)=>s+(parseFloat(l.cost||l.price||0)),0);
  const successRate=logs.length?Math.round((success.length/logs.length)*100):0;
  const $=id=>document.getElementById(id);
  if($("sms-total-count"))   $("sms-total-count").textContent=logs.length;
  if($("sms-success-count")) $("sms-success-count").textContent=success.length;
  if($("sms-success-rate"))  $("sms-success-rate").textContent=successRate+"%";
  if($("sms-total-cost"))    $("sms-total-cost").textContent="$"+totalCost.toFixed(2);

  // Ülke dağılımı
  const countryCounts={};
  logs.forEach(l=>{const c=getCountryName(l.country_id)||l.country||"Bilinmiyor";if(!countryCounts[c])countryCounts[c]=0;countryCounts[c]++;});
  const topCountries=Object.entries(countryCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const totalLogs=logs.length||1;
  const countryEl=document.getElementById("sms-country-dist");
  if(countryEl) countryEl.innerHTML=topCountries.map(([c,cnt])=>{
    const pct=Math.round((cnt/totalLogs)*100);
    return `<div class="type-item"><div class="type-hdr"><div class="type-name">${c}</div><div class="type-stats"><span class="type-cnt">${cnt}</span><span class="type-tot">${pct}%</span></div></div><div class="bar-bg"><div class="bar-fg" style="width:${pct}%;background:var(--purple)"></div></div></div>`;
  }).join("");

  // Servis dağılımı
  const serviceCounts={};
  logs.forEach(l=>{const k=(l.service||"").toLowerCase();const n=SERVICE_NAMES[k]||l.service||"?";if(!serviceCounts[n])serviceCounts[n]=0;serviceCounts[n]++;});
  const topServices=Object.entries(serviceCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const serviceEl=document.getElementById("sms-service-dist");
  if(serviceEl) serviceEl.innerHTML=topServices.map(([s,cnt])=>{
    const pct=Math.round((cnt/totalLogs)*100);
    return `<div class="type-item"><div class="type-hdr"><div class="type-name">${s}</div><div class="type-stats"><span class="type-cnt">${cnt}</span><span class="type-tot">${pct}%</span></div></div><div class="bar-bg"><div class="bar-fg" style="width:${pct}%;background:var(--pink)"></div></div></div>`;
  }).join("");
}

export function setSmsHistFilter(f,el){
  histFilter=f;
  document.querySelectorAll("#page-sms-takip .chip").forEach(c=>c.classList.remove("active"));
  el.classList.add("active");
  renderSmsHistory();
}

export function startAutoRefresh(){
  if(autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer=setInterval(loadActiveActivations,30000);
  loadActiveActivations();
  showToast("🔄 Otomatik yenileme açık (30sn)");
}
export function stopAutoRefresh(){
  if(autoRefreshTimer){ clearInterval(autoRefreshTimer); autoRefreshTimer=null; }
  showToast("⏸ Otomatik yenileme kapalı");
}
