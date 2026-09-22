// ==========================================
// MEMBROS — Seleção, Login/Logout, Welcome Modal
// ==========================================

function selectActiveMember(memberId, force = false) {
  const lockedId = getLockedUserId();
  if (!force && lockedId && lockedId !== memberId && window.clubState.members.some(m => m.id === lockedId)) {
    playSound('error');
    showToast(`Troca bloqueada! Este dispositivo está vinculado a ${getMemberName(lockedId)}.`, 'warning');
    return false;
  }

  window.localCurrentUser = memberId;
  setLockedUserId(memberId);
  document.getElementById('memberDropdown')?.classList.add('hidden');
  document.getElementById('welcomeModal')?.classList.add('hidden');
  invalidateRenderCache();
  window.renderUI();
  playSound('click');
  showToast(`Você está operando como ${getMemberName(memberId)}`, 'info');
  return true;
}

function toggleMemberDropdown(e) {
  if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
  if (typeof closeMobileHeaderMenu === 'function') closeMobileHeaderMenu();
  document.getElementById('memberDropdown')?.classList.toggle('hidden');
}

function showBlockedSwitchAlert(targetName, myName) {
  playSound('error');
  showToast(`Identidade bloqueada neste navegador! Você está logado como "${myName}".`, 'warning');
}

function openLogoutModal() {
  const currentMem = window.clubState?.members?.find(m => m.id === window.localCurrentUser);
  const name = currentMem ? currentMem.name : 'este perfil';
  const desc = document.getElementById('logoutModalDesc');
  if (desc) desc.innerHTML = `Deseja realmente sair de <strong>${escapeHtml(name)}</strong> neste aparelho?<br><br>Isso liberará este navegador para você entrar ou criar outro integrante.`;
  document.getElementById('memberDropdown')?.classList.add('hidden');
  if (typeof closeMobileHeaderMenu === 'function') closeMobileHeaderMenu();
  document.getElementById('logoutModal')?.classList.remove('hidden');
}

function closeLogoutModal() {
  document.getElementById('logoutModal')?.classList.add('hidden');
}

function executeLogoutMember() {
  closeLogoutModal();
  clearLockedUserId();
  window.localCurrentUser = null;
  document.getElementById('memberDropdown')?.classList.add('hidden');
  const activeLabel = document.getElementById('activeMemberLabel');
  if (activeLabel) activeLabel.innerText = 'Identificar-se';
  const activeLabelMobile = document.getElementById('activeMemberLabelMobile');
  if (activeLabelMobile) activeLabelMobile.innerText = 'Identificar';
  invalidateRenderCache();
  playSound('click');
  showToast('Você saiu do perfil.', 'info');
  openWelcomeModal();
}

function promptAddNewMember() {
  openPromptModal('Seu Nome (ou do novo integrante):', '', async (newName) => {
    if (newName && newName.trim()) {
      const newId = 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
      const newMember = { id: newId, name: newName.trim(), book1: null, book2: null };
      
      // Se estiver conectado ao Firestore, mesclar com a lista remota mais recente
      if (window.currentRoomId && db) {
        try {
          const freshDoc = await db.collection("clubes").doc(window.currentRoomId).get();
          if (freshDoc.exists && freshDoc.data()?.state?.members) {
            const remoteMembers = freshDoc.data().state.members;
            const memberMap = new Map();
            remoteMembers.forEach(m => memberMap.set(m.id, m));
            window.clubState.members.forEach(m => {
              if (!memberMap.has(m.id)) memberMap.set(m.id, m);
            });
            memberMap.set(newId, newMember);
            window.clubState.members = Array.from(memberMap.values());
          } else {
            window.clubState.members.push(newMember);
          }
        } catch(e) {
          window.clubState.members.push(newMember);
        }
      } else {
        window.clubState.members.push(newMember);
      }

      if (!window.clubState.votes[newId]) window.clubState.votes[newId] = {};
      
      invalidateRenderCache();
      await persistState('state.members');

      // Se este aparelho ainda NÃO tiver usuário vinculado, vincula a este novo!
      if (!window.localCurrentUser || !getLockedUserId()) {
        selectActiveMember(newId, true);
        showToast(`${newName.trim()} entrou no clube e está vinculado a este dispositivo!`, 'success');
      } else {
        // Se já tiver usuário vinculado, apenas avisa que o novo integrante foi cadastrado!
        window.renderUI();
        showToast(`${newName.trim()} foi adicionado(a) ao clube!`, 'success');
      }
    }
  });
}

function confirmRemoveMember(memberId, memberName) {
  openPromptModal(`Digite "REMOVER" para confirmar:`, '', (val) => {
    if (val && val.toUpperCase() === 'REMOVER') {
      window.clubState.members = window.clubState.members.filter(m => m.id !== memberId);
      delete window.clubState.votes[memberId];
      Object.keys(window.clubState.votes).forEach(vKey => { if (window.clubState.votes[vKey]) delete window.clubState.votes[vKey][memberId]; });
      
      if (window.localCurrentUser === memberId) {
        window.localCurrentUser = null;
        clearLockedUserId();
      }

      invalidateRenderCache();
      persistState();
      if (!window.localCurrentUser) openWelcomeModal();
      showToast(`${memberName} removido(a).`, 'info');
    }
  });
}

// ==========================================
// WELCOME MODAL & INITIAL PROMPT
// ==========================================

window.checkInitialWelcomePrompt = function() {
  if (window.clubState.members.length === 0) {
    openWelcomeModal();
    return;
  }
  
  const lockedMember = getLockedUserId();
  if (lockedMember && window.clubState.members.some(m => m.id === lockedMember)) {
    window.localCurrentUser = lockedMember;
    setLockedUserId(lockedMember);
    const modal = document.getElementById('welcomeModal');
    if (modal) modal.classList.add('hidden');
    if (typeof window.renderUI === 'function') window.renderUI();
  } else {
    openWelcomeModal();
  }
};

function openWelcomeModal() {
  const modal = document.getElementById('welcomeModal');
  const list = document.getElementById('welcomeMemberList');
  if (!modal || !list) return;

  const lockedId = getLockedUserId();
  if (lockedId && window.clubState.members.some(m => m.id === lockedId)) {
    window.localCurrentUser = lockedId;
    modal.classList.add('hidden');
    if (typeof window.renderUI === 'function') window.renderUI();
    return;
  }
  
  if (window.clubState.members.length === 0) {
     list.innerHTML = `<div class="col-span-2 text-center py-4 text-sm text-stone-500 bg-stone-50 rounded-2xl border border-stone-200">A sala está vazia.<br>Seja o primeiro a entrar!</div>`;
  } else {
     list.innerHTML = window.clubState.members.map(m => `
       <button onclick="confirmInitialMember('${m.id}')" class="p-3.5 rounded-2xl border-2 border-stone-200 hover:border-burgundy hover:bg-burgundy/5 text-left transition flex flex-col justify-between group">
         <div class="w-8 h-8 rounded-xl bg-stone-100 group-hover:bg-burgundy group-hover:text-white text-stone-700 flex items-center justify-center font-bold text-xs transition mb-2">${escapeHtml(m.name.substring(0, 2).toUpperCase())}</div>
         <div><h4 class="font-bold text-xs text-stone-900 group-hover:text-burgundy truncate">${escapeHtml(m.name)}</h4><span class="text-[10px] text-stone-400">Entrar como este</span></div>
       </button>`).join('');
  }
  modal.classList.remove('hidden');
}

function confirmInitialMember(memberId) {
  const lockedId = getLockedUserId();
  if (lockedId && lockedId !== memberId && window.clubState.members.some(m => m.id === lockedId)) {
    playSound('error');
    showToast(`Troca bloqueada! Este dispositivo está vinculado a ${getMemberName(lockedId)}.`, 'warning');
    return;
  }
  window.localCurrentUser = memberId;
  setLockedUserId(memberId);
  document.getElementById('welcomeModal').classList.add('hidden');
  if (typeof window.renderUI === 'function') window.renderUI();
  playSound('advance');
  showToast(`Bem-vindo(a), ${getMemberName(memberId)}! Perfil vinculado a este dispositivo.`, 'success');
}
