// ==========================================
// FIREBASE — Inicialização, Sync, Persistência
// ==========================================

function resolveRoomId() {
  const urlParams = new URLSearchParams(window.location.search);
  const querySala = urlParams.get('sala');
  if (querySala) return querySala.trim().toUpperCase();
  const hash = window.location.hash.replace(/^#/, '');
  if (hash.startsWith('sala=')) return hash.split('=')[1].trim().toUpperCase();
  if (hash && !hash.includes('=')) return hash.trim().toUpperCase();
  return null;
}

window.currentRoomId = resolveRoomId();

var db = null;

async function initDatabase() {
  if (!window.currentRoomId) {
    document.getElementById('lobbyModal').classList.remove('hidden');
    return; 
  }

  document.getElementById('lobbyModal').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  updateSyncStatus(false, "Conectando...");

  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
  } catch (e) {
    updateSyncStatus(false, "Erro de Conexão");
    return;
  }

  const docRef = db.collection("clubes").doc(window.currentRoomId);
  const docSnap = await docRef.get();
  
  if (!docSnap.exists) {
    showToast("Sala não encontrada! Verifique o código digitado.", "danger");
    window.currentRoomId = null;
    window.history.replaceState(null, '', window.location.pathname);
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('lobbyModal').classList.remove('hidden');
    return;
  }

  // Hidratação IMEDIATA a partir do .get() antes mesmo do primeiro onSnapshot disparar
  const initialCloudData = docSnap.data()?.state;
  if (initialCloudData) {
    handleIncomingState(initialCloudData);
    isInitialized = true;
    isFirstSync = false;
    updateSyncStatus(true);
    if (typeof window.checkInitialWelcomePrompt === 'function') window.checkInitialWelcomePrompt();
  }

  docRef.onSnapshot((doc) => {
    if (doc.exists) {
      const incomingData = doc.data().state;
      if (!incomingData) return;
      
      // Detectar se houve mudança real de conteúdo nos dados do clube
      const contentChanged = !isInitialized || hasContentChanged(window.clubState, incomingData);
      
      if (contentChanged) {
        handleIncomingState(incomingData);
      } else {
        // Apenas atualiza a presença sem re-renderizar todo o app nem recriar imagens
        window.clubState.presence = incomingData.presence || {};
        if (incomingData.updatedAt) window.clubState.updatedAt = incomingData.updatedAt;
        // Se estiver na tela de sorteio, atualiza os indicadores de quem está online sem recriar os cards
        if (window.localStage === 'draw' && typeof updateRoulettePresenceIndicators === 'function' && !isDrawing) {
          updateRoulettePresenceIndicators();
        }
      }
      if (typeof window.refreshAdminUIIfOpen === 'function') window.refreshAdminUIIfOpen();
      updateSyncStatus(true);
      
      if (isFirstSync) {
         isFirstSync = false;
         isInitialized = true;
         if (typeof window.checkInitialWelcomePrompt === 'function') window.checkInitialWelcomePrompt();
      }
    }
  }, (error) => {
    updateSyncStatus(false, "Erro de Conexão");
  });

  // Presence update — usa update() com path específico, não dispara re-render pesado
  setInterval(() => {
    if (window.localCurrentUser && window.currentRoomId && db) {
      db.collection("clubes").doc(window.currentRoomId).update({
        [`state.presence.${window.localCurrentUser}`]: Date.now()
      }).catch(()=>{});
    }
  }, 5000);
}

async function createNewRoom() {
  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    window.clubState.updatedAt = Date.now();
    
    await db.collection("clubes").doc(newCode).set({ state: window.clubState });
    window.location.href = `?sala=${newCode}`;
  } catch(e) {
    alert("Erro ao criar sala. Verifique sua conexão com a internet.");
  }
}

function joinExistingRoom() {
  const code = document.getElementById('lobbyRoomInput').value.trim().toUpperCase();
  if (!code) {
     showToast("Por favor, digite um código de sala.", "warning");
     return;
  }
  window.location.href = `?sala=${code}`;
}

// Compara exclusivamente dados reais do clube e ignora presence/updatedAt/stage
function hasContentChanged(oldState, newState) {
  if (!oldState || !newState) return true;
  
  // 1. Nome do clube
  if ((oldState.clubName || '') !== (newState.clubName || '')) return true;

  // 2. Quantidade de membros
  const oldMembers = oldState.members || [];
  const newMembers = newState.members || [];
  if (oldMembers.length !== newMembers.length) return true;

  // 3. Detalhes de cada membro e seus livros
  for (let i = 0; i < oldMembers.length; i++) {
    const om = oldMembers[i];
    const nm = newMembers.find(m => m.id === om.id);
    if (!nm) return true;
    if (om.name !== nm.name) return true;

    // Compara book1
    const ob1 = om.book1;
    const nb1 = nm.book1;
    if (Boolean(ob1) !== Boolean(nb1)) return true;
    if (ob1 && nb1) {
      if (ob1.title !== nb1.title || ob1.author !== nb1.author || ob1.cover !== nb1.cover) return true;
    }

    // Compara book2
    const ob2 = om.book2;
    const nb2 = nm.book2;
    if (Boolean(ob2) !== Boolean(nb2)) return true;
    if (ob2 && nb2) {
      if (ob2.title !== nb2.title || ob2.author !== nb2.author || ob2.cover !== nb2.cover) return true;
    }
  }

  // 4. Votos registrados
  const oldVotes = oldState.votes || {};
  const newVotes = newState.votes || {};
  const oldVoters = Object.keys(oldVotes).sort();
  const newVoters = Object.keys(newVotes).sort();
  if (oldVoters.length !== newVoters.length) return true;
  for (const vId of oldVoters) {
    if (!newVotes[vId]) return true;
    const oVetoes = oldVotes[vId] || {};
    const nVetoes = newVotes[vId] || {};
    const oTargets = Object.keys(oVetoes).sort();
    const nTargets = Object.keys(nVetoes).sort();
    if (oTargets.length !== nTargets.length) return true;
    for (const tId of oTargets) {
      if (oVetoes[tId] !== nVetoes[tId]) return true;
    }
  }

  // 5. Vencedor do sorteio
  const oldWin = oldState.winner;
  const newWin = newState.winner;
  if (Boolean(oldWin) !== Boolean(newWin)) return true;
  if (oldWin && newWin) {
    if (oldWin.member !== newWin.member || oldWin.drawnAt !== newWin.drawnAt || oldWin.book?.title !== newWin.book?.title) return true;
  }

  // 6. Evento de sorteio
  const oldDraw = oldState.drawEvent;
  const newDraw = newState.drawEvent;
  if (Boolean(oldDraw) !== Boolean(newDraw)) return true;
  if (oldDraw && newDraw) {
    if (oldDraw.timestamp !== newDraw.timestamp || oldDraw.winnerIndex !== newDraw.winnerIndex) return true;
  }

  // 7. Histórico
  const oldHist = oldState.history || [];
  const newHist = newState.history || [];
  if (oldHist.length !== newHist.length) return true;

  // 8. Logs do sorteio
  const oldLogs = oldState.drawLogs || [];
  const newLogs = newState.drawLogs || [];
  if (oldLogs.length !== newLogs.length) return true;

  // 9. Geladeira
  const oldFridge = oldState.fridge || [];
  const newFridge = newState.fridge || [];
  if (oldFridge.length !== newFridge.length) return true;

  // 10. Ciclo Fechado
  const oldCycle = oldState.closedCycle || {};
  const newCycle = newState.closedCycle || {};
  if (Boolean(oldCycle.enabled) !== Boolean(newCycle.enabled)) return true;
  const oldCycleWinners = (oldCycle.winners || []).join(',');
  const newCycleWinners = (newCycle.winners || []).join(',');
  if (oldCycleWinners !== newCycleWinners) return true;

  return false; // Apenas presença ou timestamp mudou!
}

function handleIncomingState(data) {
  if (!data) return;
  invalidateRenderCache();
  
  const oldMembers = window.clubState.members || [];
  const oldVotes = window.clubState.votes || {};

  // FIX: Mesclar estado recebido, mas PRESERVAR o stage local
  // O stage NÃO vem mais da nuvem — cada usuário controla o seu
  const localStageBackup = window.localStage;
  window.clubState = { ...window.clubState, ...data };
  // Remover stage do estado compartilhado se vier acidentalmente
  delete window.clubState.stage;
  window.localStage = localStageBackup;
  
  if (!window.clubState.members) window.clubState.members = [];
  if (!window.clubState.votes) window.clubState.votes = {};
  if (!window.clubState.fridge) window.clubState.fridge = [];
  if (!window.clubState.closedCycle) window.clubState.closedCycle = { enabled: true, winners: [] };
  // Inicializa campeões a partir do histórico existente (ex: primeiro sorteio já ocorrido no clube)
  if (window.clubState.closedCycle.enabled && (!window.clubState.closedCycle.winners || window.clubState.closedCycle.winners.length === 0)) {
    const hist = window.clubState.history || [];
    const mems = window.clubState.members || [];
    if (hist.length > 0 && mems.length > 0) {
      window.clubState.closedCycle.winners = window.clubState.closedCycle.winners || [];
      for (const h of hist) {
        if (window.clubState.closedCycle.winners.length >= mems.length) break;
        const winnerMember = mems.find(m => m.name === h.winner?.member || m.id === h.winner?.memberId);
        if (winnerMember && !window.clubState.closedCycle.winners.includes(winnerMember.id)) {
          window.clubState.closedCycle.winners.push(winnerMember.id);
        }
      }
      if (window.clubState.closedCycle.winners.length >= mems.length) {
        window.clubState.closedCycle.winners = [];
      }
    }
  }

  if (data.drawEvent && data.drawEvent.timestamp && data.drawEvent.timestamp !== window.lastDrawTimestamp) {
      const isFirstLoad = (window.lastDrawTimestamp === 0);
      window.lastDrawTimestamp = data.drawEvent.timestamp;
      if (!isFirstLoad) {
         if (!isDrawing) {
           // FIX: Quando receber evento de sorteio, navegar automaticamente para a aba draw
           window.localStage = 'draw';
           localStorage.setItem('clubeDoLivro_localStage', 'draw');
           triggerSyncedDraw(data.drawEvent);
         }
      }
  }

  const newMembers = window.clubState.members;
  const newVotes = window.clubState.votes || {};
  const othersCount = newMembers.length > 1 ? newMembers.length - 1 : 0;

  newMembers.forEach(newM => {
    const oldM = oldMembers.find(m => m.id === newM.id);
    if (oldM && newM.id !== window.localCurrentUser) {
      const oldDone = oldM.book1 && oldM.book2;
      const newDone = newM.book1 && newM.book2;
      if (!oldDone && newDone) {
        if (typeof showToast === 'function') showToast(`📚 Oba! ${newM.name} registrou as indicações!`, 'success');
        playSound('advance');
      }
      const hadVoted = Object.keys(oldVotes[newM.id] || {}).length >= othersCount;
      const justVoted = Object.keys(newVotes[newM.id] || {}).length >= othersCount;
      if (!hadVoted && justVoted && othersCount > 0) {
        if (typeof showToast === 'function') showToast(`✅ ${newM.name} finalizou os vetos!`, 'success');
        playSound('advance');
      }
    }
  });

  if (window.localCurrentUser && !window.clubState.members.some(m => m.id === window.localCurrentUser)) {
    window.localCurrentUser = null;
    clearLockedUserId();
    openWelcomeModal(); 
  }

  if (!isDrawing && window.localCurrentUser) {
     if (typeof window.renderUI === 'function') window.renderUI();
  } else if (!window.localCurrentUser) {
     const welcomeModal = document.getElementById('welcomeModal');
     if (welcomeModal && !welcomeModal.classList.contains('hidden')) {
         openWelcomeModal();
     }
  }
  if (typeof window.refreshAdminUIIfOpen === 'function') window.refreshAdminUIIfOpen();
}

window.persistState = async function(granularPath) {
  // Bloqueia persistState antes da inicialização para nunca salvar estado vazio prematuro
  if (!isInitialized) {
    console.warn('[Sync] persistState bloqueado — aguardando inicialização completa da sala');
    return;
  }

  window.clubState.updatedAt = Date.now();
  // Remover stage do estado que vai para a nuvem (stage é puramente local por leitor)
  const stateForCloud = { ...window.clubState };
  delete stateForCloud.stage;

  if (!isDrawing && typeof window.renderUI === 'function') window.renderUI();

  if (window.currentRoomId && db) {
    try {
      // PROTEÇÃO CRÍTICA CONTRA RESET ACIDENTAL:
      // Se members está vazio no estado local, checar se a sala remota já possuía integrantes
      if (stateForCloud.members && stateForCloud.members.length === 0) {
        const currentDoc = await db.collection("clubes").doc(window.currentRoomId).get();
        if (currentDoc.exists && currentDoc.data()?.state?.members?.length > 0) {
          console.error('[Sync] BLOQUEIO DE SEGURANÇA: tentativa de salvar lista de integrantes vazia quando a sala já continha membros.');
          // Restaura os integrantes do servidor para o estado local
          window.clubState.members = currentDoc.data().state.members;
          if (currentDoc.data().state.votes) window.clubState.votes = currentDoc.data().state.votes;
          if (typeof window.renderUI === 'function') window.renderUI();
          return;
        }
      }

      if (granularPath) {
        // Update granular — altera única e exclusivamente o campo afetado
        const val = getNestedValue(stateForCloud, granularPath.replace('state.', ''));
        await db.collection("clubes").doc(window.currentRoomId).update({
          [granularPath]: val !== undefined ? val : null,
          'state.updatedAt': stateForCloud.updatedAt
        });
      } else {
        // Update com merge para nunca excluir acidentalmente coleções ou campos paralelos
        await db.collection("clubes").doc(window.currentRoomId).set({ state: stateForCloud }, { merge: true });
      }
      updateSyncStatus(true);
    } catch (error) {
      console.error('[Sync] Erro ao salvar:', error);
      updateSyncStatus(false, "Erro ao salvar");
    }
  }
};

// Helper para acessar valor aninhado por path (ex: 'votes.m1' → clubState.votes.m1)
function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

function updateSyncStatus(online, customLabel) {
  const badge = document.getElementById('syncBadge');
  const indicator = document.getElementById('syncIndicator');
  if (!badge || !indicator) return;

  if (online) {
    badge.className = "flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50 border border-emerald-200 cursor-help shadow-sm transition-colors";
    badge.title = "Sincronizado";
    indicator.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse";
  } else {
    badge.className = "flex items-center justify-center w-7 h-7 rounded-full bg-rose-50 border border-rose-200 cursor-help shadow-sm transition-colors";
    badge.title = customLabel || "Desconectado";
    indicator.className = "w-2.5 h-2.5 rounded-full bg-rose-500";
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initDatabase();
});
