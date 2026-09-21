// ==========================================
// ESTADO GLOBAL DA APLICAÇÃO
// ==========================================

window.clubState = {
  clubName: 'Clube do Livro',
  members: [], 
  votes: {}, 
  history: [],
  winner: null,
  updatedAt: 0,
  presence: {},    
  drawEvent: null, 
  drawLogs: [],
  fridge: [],                                    // Geladeira: livros finalistas que perderam o sorteio
  closedCycle: { enabled: true, winners: [] }    // Ciclo Fechado: campeões ficam de fora da roleta até todos vencerem
};

// Stage é LOCAL — cada usuário controla sua própria navegação
// A Home ('home') agora é a tela inicial com o Livro Atual
window.localStage = localStorage.getItem('clubeDoLivro_localStage') || 'home';

window.localCurrentUser = null;
window.isEditingBooks = false; 
window.isEditingVotes = false;
window.lastDrawTimestamp = 0;
var isDrawing = false;
var isFirstSync = true;
var isInitialized = false; // FIX: Bloqueia persistState até o primeiro sync completar

console.log('%c[Clube do Livro] v6.1-stable carregado', 'color: #832837; font-weight: bold; font-size: 14px;');

// ==========================================
// ASSINATURAS DE CACHE (impede re-render desnecessário)
// ==========================================
var _lastHomeScreenSignature = '';
var _lastNominationsSignature = '';
var _lastVotingCanvasSignature = '';
var _lastResultsSignature = '';
var _lastRouletteCardsSignature = '';
var _lastWinnerCardSignature = '';

function invalidateRenderCache() {
  _lastHomeScreenSignature = '';
  _lastNominationsSignature = '';
  _lastVotingCanvasSignature = '';
  _lastResultsSignature = '';
  _lastRouletteCardsSignature = '';
  _lastWinnerCardSignature = '';
}

// ==========================================
// SISTEMA DE BLOQUEIO DE IDENTIDADE (COOKIES & STORAGE)
// Impede troca de identidade por aparelho
// ==========================================
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
}

function setCookie(name, value, days = 365) {
  const d = new Date();
  d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}

function deleteCookie(name) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`;
}

function getLockedCookieKey() {
  return 'clube_locked_' + (window.currentRoomId || 'default');
}

function getLockedUserId() {
  const roomKey = getLockedCookieKey();
  // 1. Cookie da sala específica
  const roomCookie = getCookie(roomKey);
  if (roomCookie) return roomCookie;
  // 2. Cookie geral
  const generalCookie = getCookie('clube_locked_user');
  if (generalCookie) return generalCookie;
  // 3. Fallback localStorage
  return localStorage.getItem(roomKey) || localStorage.getItem('clube_locked_user') || localStorage.getItem('clubUserId');
}

function setLockedUserId(memberId) {
  if (!memberId) return;
  const roomKey = getLockedCookieKey();
  setCookie(roomKey, memberId, 365);
  setCookie('clube_locked_user', memberId, 365);
  localStorage.setItem(roomKey, memberId);
  localStorage.setItem('clube_locked_user', memberId);
  localStorage.setItem('clubUserId', memberId);
}

function clearLockedUserId() {
  const roomKey = getLockedCookieKey();
  deleteCookie(roomKey);
  deleteCookie('clube_locked_user');
  localStorage.removeItem(roomKey);
  localStorage.removeItem('clube_locked_user');
  localStorage.removeItem('clubUserId');
}
