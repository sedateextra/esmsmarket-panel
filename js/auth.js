// ── auth.js — Giriş / çıkış / session ────────────────────────
import { USERS, state } from './config.js';
import { nowStr, showLoading } from './utils.js';
import { db, addLog } from './data.js';
import { scheduleNightReport } from './telegram.js';

export function initAuth(){
  // Kayıtlı oturumu kontrol et
  const saved = localStorage.getItem("esms_user");
  const loginTime = parseInt(localStorage.getItem("esms_login_time")||"0");
  if(saved && USERS[saved] && (Date.now()-loginTime < 30*60*1000)){
    state.currentUser = saved;
    startApp();
    return;
  }
  showLogin();
}

export function showLogin(){
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("app-screen").classList.add("hidden");
}

export function doLogin(){
  const u = document.getElementById("login-user").value.trim().toLowerCase();
  const p = document.getElementById("login-pass").value;
  const err = document.getElementById("login-err");
  if(!USERS[u] || USERS[u].pass !== p){
    err.textContent = "Kullanıcı adı veya şifre hatalı.";
    return;
  }
  state.currentUser = u;
  localStorage.setItem("esms_user", u);
  localStorage.setItem("esms_login_time", Date.now().toString());
  err.textContent = "";
  startApp();
}

export function doLogout(){
  localStorage.removeItem("esms_user");
  localStorage.removeItem("esms_login_time");
  state.currentUser = null;
  showLogin();
}

export function fillDemo(u){
  document.getElementById("login-user").value = u;
  document.getElementById("login-pass").value = USERS[u]?.pass||"";
}

function startApp(){
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");

  // Kullanıcı chip
  const udata = USERS[state.currentUser];
  document.getElementById("user-avatar").style.background = udata.avatarBg;
  document.getElementById("user-initials").textContent = udata.initials;
  document.getElementById("user-name-display").textContent = state.currentUser;
  document.getElementById("user-role-display").textContent = udata.role;

  // Session timer
  startSessionTimer();
  scheduleNightReport();

  // Veriyi yükle ve render et
  import('./data.js').then(({loadAll})=>{
    loadAll().then(()=>{
      import('./main.js').then(({renderAll})=>renderAll());
    });
  });

  addLog("login","Giriş yapıldı",state.currentUser);
}

function startSessionTimer(){
  state.sessionSecondsLeft = 30*60;
  if(state.sessionInterval) clearInterval(state.sessionInterval);
  state.sessionInterval = setInterval(()=>{
    state.sessionSecondsLeft--;
    if(state.sessionSecondsLeft <= 300){
      const tw = document.getElementById("timeout-warning");
      tw.style.display = "block";
      document.getElementById("timeout-countdown").textContent = Math.ceil(state.sessionSecondsLeft/60);
    }
    if(state.sessionSecondsLeft <= 0) doLogout();
  }, 1000);
}

export function resetSession(){
  state.sessionSecondsLeft = 30*60;
  document.getElementById("timeout-warning").style.display = "none";
  localStorage.setItem("esms_login_time", Date.now().toString());
}
