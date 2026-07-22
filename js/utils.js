// ── utils.js — Yardımcı fonksiyonlar ─────────────────────────
import { state, USD_TRY, PRICE_USD } from './config.js';

export function fmt(n){
  return "₺" + parseFloat(n||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
}

export function nowStr(){
  const d = new Date();
  return d.toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"})
    + " " + d.toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});
}

export function todayStr(){
  const d = new Date();
  return d.toLocaleDateString("tr-TR",{day:"numeric",month:"short",year:"numeric"})
    + " " + d.toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});
}

export function dateStr(){
  return new Date().toLocaleDateString("tr-TR");
}

export function showLoading(v){
  document.getElementById("loading-overlay").style.display = v ? "flex" : "none";
}

export function showToast(msg, duration=3000){
  let t = document.getElementById("esms-toast");
  if(!t){
    t = document.createElement("div");
    t.id = "esms-toast";
    t.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--card2);border:1px solid var(--border2);border-radius:12px;padding:12px 20px;font-size:13px;color:var(--text);z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,.4);transition:opacity .3s;pointer-events:none";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>{ t.style.opacity = "0"; }, duration);
}

export function parseSince(s){
  if(!s) return null;
  const p = s.split(".");
  if(p.length >= 3) return new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]));
  return null;
}

export function numCount(balance){
  return Math.floor((balance||0) / (PRICE_USD * USD_TRY));
}

export function parseShopierDate(raw){
  if(!raw) return null;
  const p = raw.trim().split(/[\/\-]/);
  if(p.length !== 3) return null;
  return p[0].length === 4
    ? new Date(p[0], p[1]-1, p[2])
    : new Date(p[2], p[1]-1, p[0]);
}
