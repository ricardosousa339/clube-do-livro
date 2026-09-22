// ==========================================
// UI CORE — Som, Toast, Helpers, renderUI principal
// ==========================================

var synth = null;
function playSound(type) {
  try {
    if (!synth && window.Tone) {
      synth = new Tone.PolySynth(Tone.Synth).toDestination();
      synth.volume.value = -20;
    }
    if (window.Tone && Tone.context.state !== 'running') Tone.start();
    if (!synth) return;
    const now = Tone.now();
    if (type === 'click') synth.triggerAttackRelease("C5", "32n", now);
    else if (type === 'veto') synth.triggerAttackRelease(["E3", "G3"], "16n", now);
    else if (type === 'advance') synth.triggerAttackRelease(["C4", "E4", "G4", "C5"], "8n", now);
    else if (type === 'winner') synth.triggerAttackRelease(["C4", "G4", "C5", "E5", "G5"], "4n", now);
  } catch (e) {}
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  const colors = {
    info: 'bg-stone-900 text-white border-stone-800',
    success: 'bg-emerald-800 text-white border-emerald-700',
    warning: 'bg-amber-800 text-white border-amber-700',
    danger: 'bg-rose-800 text-white border-rose-700'
  };
  toast.className = `px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-2 transform transition-all duration-300 opacity-0 translate-y-3 pointer-events-auto ${colors[type] || colors.info}`;
  toast.innerHTML = `<i class="ph ph-bell text-base"></i><span>${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.remove('opacity-0', 'translate-y-3'));
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-3');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function getMemberName(memberId) {
  const mem = window.clubState?.members.find(m => m.id === memberId);
  return mem ? mem.name : 'Integrante';
}

function isRoundActive() {
  const state = window.clubState;
  if (!state) return true;

  // Verifica se há livro atual (vencedor da rodada ou último do histórico)
  const hasCurrentBook = !!(state.winner && state.winner.book) || 
                         !!(state.history && state.history.length > 0 && state.history[0]?.winner);

  // Se não há nenhum livro cadastrado (clube novo sem leituras), a rodada está aberta
  if (!hasCurrentBook) return true;

  // Se há livro atual, as etapas 1 a 4 só abrem se uma nova rodada tiver sido explicitamente iniciada
  return state.roundStarted === true;
}

function startNewRound() {
  const state = window.clubState;
  if (!state) return;

  // Se já há um vencedor pendente de arquivamento no histórico
  if (state.winner && state.winner.book) {
    if (typeof openResetCycleModal === 'function') {
      openResetCycleModal();
    } else {
      handleArchiveAndStartNewMonth();
    }
    return;
  }

  // Se o vencedor já foi arquivado (está no histórico) ou não há vencedor
  // Inicia a nova rodada de indicações
  state.members.forEach(m => { m.book1 = null; m.book2 = null; });
  state.votes = {};
  state.winner = null;
  state.drawEvent = null;
  state.drawLogs = [];
  state.roundStarted = true;

  if (typeof persistState === 'function') persistState();
  if (typeof invalidateRenderCache === 'function') invalidateRenderCache();

  changeStage('nominations');
  if (typeof showToast === 'function') {
    showToast('Nova rodada iniciada! Cadastre as indicações.', 'success');
  }
}

// ==========================================
// VALIDAÇÃO DE ACESSO PROGRESSIVO ÀS ETAPAS
// ==========================================

function checkStageAccess(targetStage) {
  const state = window.clubState;
  if (!state) return { allowed: true };

  // 1. Etapa Início sempre liberada
  if (targetStage === 'home') {
    return { allowed: true };
  }

  // 2. Se o sorteio acabou de acontecer na tela ou está em andamento (roleta girando)
  if (targetStage === 'draw' && (window._justFinishedDraw || (typeof isDrawing !== 'undefined' && isDrawing))) {
    return { allowed: true };
  }

  // 3. Todas as etapas de sorteio/votação exigem rodada ativa
  if (!isRoundActive()) {
    return { 
      allowed: false, 
      reason: 'Inicie uma nova rodada para acessar as etapas.' 
    };
  }

  // 4. Etapa 1: Indicações liberada quando rodada está ativa
  if (targetStage === 'nominations') {
    return { allowed: true };
  }

  // 5. Verificação de membros mínimos para votação, apuração e sorteio
  const members = state.members || [];
  if (members.length < 2) {
    return { 
      allowed: false, 
      reason: 'É preciso de pelo menos 2 membros no clube para prosseguir.' 
    };
  }

  // 6. Etapa 2 (Votação) e seguintes exigem que TODOS tenham indicado os 2 livros
  const isBookValid = (b) => !!(b && typeof b.title === 'string' && b.title.trim().length > 0);
  const missingNominations = members.filter(m => !isBookValid(m.book1) || !isBookValid(m.book2));
  if (missingNominations.length > 0) {
    const names = missingNominations.map(m => m.name).join(', ');
    return { 
      allowed: false, 
      reason: `Faltam indicações de: ${names}.` 
    };
  }

  if (targetStage === 'voting') {
    return { allowed: true };
  }

  // 7. Etapa 3 (Apuração) e Etapa 4 (Sorteio) exigem que TODOS tenham votado em todos os colegas
  const votes = state.votes || {};
  const missingVoters = [];
  members.forEach(m => {
    const otherMemberIds = members.filter(other => other.id !== m.id).map(other => other.id);
    const mVotes = votes[m.id] || {};
    const votedAll = otherMemberIds.length > 0 && otherMemberIds.every(id => !!mVotes[id]);
    if (!votedAll) {
      missingVoters.push(m.name);
    }
  });

  if (missingVoters.length > 0) {
    return { 
      allowed: false, 
      reason: `Aguardando a votação. Faltam votos de: ${missingVoters.join(', ')}.` 
    };
  }

  if (targetStage === 'results') {
    return { allowed: true };
  }

  // 8. Etapa 4: O Sorteio
  if (targetStage === 'draw') {
    if (state.winner && state.winner.book) {
      return { allowed: true };
    }
    if (typeof calculateFinalists === 'function') {
      const finalists = calculateFinalists();
      const valid = finalists.filter(f => f && f.survivingBook);
      if (valid.length === 0) {
        return { 
          allowed: false, 
          reason: 'Conclua a apuração dos votos antes de iniciar o sorteio.' 
        };
      }
    }
    return { allowed: true };
  }

  return { allowed: true };
}
window.checkStageAccess = checkStageAccess;

// ==========================================
// CONTROLE DE INTERFACE MOBILE (Colapsar / Expandir)
// ==========================================

function toggleMobileStages() {
  const container = document.getElementById('stageButtonsContainer');
  const chevron = document.getElementById('mobileStagesChevron');
  if (!container) return;

  const isHidden = container.classList.contains('hidden');
  if (isHidden) {
    container.classList.remove('hidden');
    if (chevron) chevron.classList.add('rotate-180');
  } else {
    container.classList.add('hidden');
    if (chevron) chevron.classList.remove('rotate-180');
  }
}

function toggleMobileHeaderMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('mobileHeaderDropdown');
  if (!menu) return;
  menu.classList.toggle('hidden');
}

function closeMobileHeaderMenu() {
  const menu = document.getElementById('mobileHeaderDropdown');
  if (menu) menu.classList.add('hidden');
}

function toggleElement(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('hidden');
}

// Fechar menu mobile ao clicar fora
document.addEventListener('click', (e) => {
  const menu = document.getElementById('mobileHeaderDropdown');
  const btn = document.getElementById('mobileMenuBtn');
  if (menu && !menu.classList.contains('hidden')) {
    if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
      menu.classList.add('hidden');
    }
  }
});

function updateMobileStageBar(activeStage, isLocked) {
  const iconEl = document.getElementById('mobileActiveStageIcon');
  const badgeEl = document.getElementById('mobileActiveStageBadge');
  const titleEl = document.getElementById('mobileActiveStageTitle');
  if (!iconEl || !badgeEl || !titleEl) return;

  const stageMeta = {
    home: { badge: 'Início', title: 'Livro Atual', icon: '<i class="ph ph-book-open-text text-sm"></i>' },
    nominations: { badge: 'Etapa 1', title: 'Indicações', icon: '1' },
    voting: { badge: 'Etapa 2', title: 'Voto de Exclusão', icon: '2' },
    results: { badge: 'Etapa 3', title: 'Apuração', icon: '3' },
    draw: { badge: 'Etapa 4', title: 'O Sorteio', icon: '4' }
  };

  const meta = stageMeta[activeStage] || stageMeta.home;
  badgeEl.innerText = meta.badge;
  titleEl.innerText = meta.title;

  if (isLocked) {
    iconEl.className = "w-7 h-7 rounded-xl bg-stone-100 text-stone-400 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs";
    iconEl.innerHTML = '<i class="ph ph-lock text-xs"></i>';
    badgeEl.className = "text-[10px] font-bold text-stone-400 uppercase tracking-wider leading-none";
  } else {
    iconEl.className = "w-7 h-7 rounded-xl bg-burgundy text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs";
    iconEl.innerHTML = meta.icon;
    badgeEl.className = "text-[10px] font-bold text-burgundy uppercase tracking-wider leading-none";
  }
}

function changeStage(newStage) {
  // FIX: Stage é local — NÃO sincroniza na nuvem
  window._justFinishedDraw = false;

  // Validação progressiva: impede acesso a etapas antes da hora
  const access = checkStageAccess(newStage);
  if (!access.allowed) {
    showToast(access.reason, 'warning');
    return;
  }

  window.localStage = newStage;
  localStorage.setItem('clubeDoLivro_localStage', newStage);

  // No celular, colapsa a grade de etapas após a troca
  const container = document.getElementById('stageButtonsContainer');
  const chevron = document.getElementById('mobileStagesChevron');
  if (container && window.innerWidth < 640) {
    container.classList.add('hidden');
    if (chevron) chevron.classList.remove('rotate-180');
  }

  if (typeof window.renderUI === 'function') window.renderUI();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// RENDER UI PRINCIPAL
// ==========================================
window.renderUI = function() {
  if (isDrawing || !window.localCurrentUser) return; 
  
  const state = window.clubState;
  if (!state) return;
  
  const count = state.members.length;
  document.getElementById('clubTitleHeader').innerText = state.clubName;
  document.getElementById('clubSubtitleHeader').innerText = `${count} Leitores • ${count * 2} Obras • 1 Vencedor`;

  const historyBadge = document.getElementById('historyCountBadge');
  const historyBadgeMobile = document.getElementById('historyCountBadgeMobile');
  const historyLen = (state.history || []).length;
  if (historyBadge) {
    if (historyLen > 0) { historyBadge.innerText = historyLen; historyBadge.classList.remove('hidden'); } 
    else { historyBadge.classList.add('hidden'); }
  }
  if (historyBadgeMobile) {
    if (historyLen > 0) { historyBadgeMobile.innerText = historyLen; historyBadgeMobile.classList.remove('hidden'); } 
    else { historyBadgeMobile.classList.add('hidden'); }
  }

  const activeMemberLabel = document.getElementById('activeMemberLabel');
  const activeMemberLabelMobile = document.getElementById('activeMemberLabelMobile');
  const currentMem = state.members.find(m => m.id === window.localCurrentUser);
  if (activeMemberLabel) {
    if (currentMem) {
      activeMemberLabel.innerHTML = `<span class="truncate max-w-[110px] sm:max-w-[150px]">${escapeHtml(currentMem.name)}</span> <i class="ph ph-lock-key-fill text-burgundy text-xs" title="Perfil vinculado a este dispositivo"></i>`;
    } else {
      activeMemberLabel.innerText = state.members[0]?.name || 'Identificar-se';
    }
  }
  if (activeMemberLabelMobile) {
    activeMemberLabelMobile.innerText = currentMem ? currentMem.name : 'Identificar';
  }

  const dropdownList = document.getElementById('memberDropdownList');
  if (dropdownList) {
    if (state.members.length === 0) {
       dropdownList.innerHTML = `<div class="px-3 py-2 text-xs text-stone-400 text-center">Ninguém no clube ainda.</div>`;
    } else {
      const currentMem = state.members.find(m => m.id === window.localCurrentUser);
      const otherMembers = state.members.filter(m => m.id !== window.localCurrentUser);

      let html = '';
      if (currentMem) {
        html += `
          <div class="p-3 bg-burgundy/5 border border-burgundy/20 rounded-2xl mb-2 shadow-xs">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-xl bg-burgundy text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  ${escapeHtml(currentMem.name.substring(0, 2).toUpperCase())}
                </div>
                <div class="min-w-0">
                  <div class="text-xs font-bold text-stone-900 truncate">${escapeHtml(currentMem.name)}</div>
                  <div class="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                    <i class="ph ph-lock-key-fill text-xs"></i> Perfil vinculado
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-1">
                <button onclick="openEditMemberNameModal('${currentMem.id}', '${escapeHtml(currentMem.name)}')" title="Renomear seu perfil" class="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-200/60 transition"><i class="ph ph-pencil text-xs"></i></button>
                <button onclick="openLogoutModal()" title="Sair do perfil neste aparelho" class="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"><i class="ph ph-sign-out text-sm"></i></button>
              </div>
            </div>
            <div class="mt-2.5 pt-2 border-t border-burgundy/10 flex items-center justify-between">
              <span class="text-[10px] text-stone-400">Neste aparelho</span>
              <button onclick="openLogoutModal()" class="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 transition py-0.5 px-2 rounded-lg hover:bg-rose-50">
                <i class="ph ph-sign-out text-xs"></i> Sair do perfil
              </button>
            </div>
          </div>
        `;
      }

      if (otherMembers.length > 0) {
        if (currentMem) {
          html += `<div class="px-2 py-1 text-[10px] font-bold text-stone-400 uppercase tracking-wider">Outros Integrantes (${otherMembers.length}):</div>`;
        }
        html += otherMembers.map(m => {
          if (currentMem) {
            return `
              <div onclick="showBlockedSwitchAlert('${escapeHtml(m.name)}', '${escapeHtml(currentMem.name)}')" class="flex items-center justify-between px-3 py-2 rounded-xl text-xs bg-stone-50/70 border border-stone-100 text-stone-500 cursor-not-allowed opacity-85 select-none hover:bg-stone-100 transition">
                <div class="flex-1 text-left truncate flex items-center gap-2">
                  <i class="ph ph-user text-stone-400"></i>
                  <span class="truncate">${escapeHtml(m.name)}</span>
                </div>
                <span class="text-[10px] text-stone-400 font-medium flex items-center gap-1">
                  <i class="ph ph-lock text-[11px]"></i> Bloqueado
                </span>
              </div>
            `;
          } else {
            return `
              <div class="flex items-center justify-between px-3 py-2 rounded-xl text-xs hover:bg-stone-100 text-stone-700">
                <button onclick="selectActiveMember('${m.id}')" class="flex-1 text-left truncate flex items-center gap-2">
                  <i class="ph ph-user"></i><span>${escapeHtml(m.name)}</span>
                </button>
              </div>
            `;
          }
        }).join('');
      }
      dropdownList.innerHTML = html;
    }
  }

  // Valida se o stage local atual é acessível; se não for, redireciona para o mais avançado permitido
  const currentAccess = checkStageAccess(window.localStage);
  if (!currentAccess.allowed && !window._justFinishedDraw) {
    let fallback = 'home';
    if (checkStageAccess('results').allowed) fallback = 'results';
    else if (checkStageAccess('voting').allowed) fallback = 'voting';
    else if (checkStageAccess('nominations').allowed) fallback = 'nominations';

    window.localStage = fallback;
    localStorage.setItem('clubeDoLivro_localStage', fallback);
  }

  const stageIcons = {
    home: '<i class="ph ph-book-open-text text-base"></i>',
    nominations: '1',
    voting: '2',
    results: '3',
    draw: '4'
  };

  // FIX: Usar localStage em vez de state.stage — cada usuário controla sua navegação
  ['home', 'nominations', 'voting', 'results', 'draw'].forEach(s => {
    const section = document.getElementById(`section-${s}`);
    const btn = document.getElementById(`stepBtn-${s}`);
    const icon = document.getElementById(`stepIcon-${s}`);
    if (section && btn && icon) {
      const access = checkStageAccess(s);
      const isLocked = !access.allowed;

      if (s === window.localStage && !isLocked) {
        section.classList.remove('hidden');
        btn.className = "flex items-center gap-3 p-3 rounded-2xl border transition-all text-left bg-white border-burgundy shadow-sm ring-2 ring-burgundy/20";
        icon.className = "w-8 h-8 rounded-xl bg-burgundy text-white flex items-center justify-center font-bold text-sm shrink-0";
        icon.innerHTML = stageIcons[s];
        btn.title = '';
        btn.onclick = () => changeStage(s);
      } else if (isLocked) {
        section.classList.add('hidden');
        btn.className = "flex items-center gap-3 p-3 rounded-2xl border transition-all text-left bg-stone-50 border-stone-200 text-stone-300 cursor-not-allowed opacity-60";
        icon.className = "w-8 h-8 rounded-xl bg-stone-100 text-stone-300 flex items-center justify-center font-bold text-sm shrink-0";
        icon.innerHTML = '<i class="ph ph-lock text-base"></i>';
        btn.title = access.reason || 'Etapa bloqueada';
        btn.onclick = (e) => {
          e.preventDefault();
          showToast(access.reason, 'warning');
        };
      } else {
        section.classList.add('hidden');
        btn.className = "flex items-center gap-3 p-3 rounded-2xl border transition-all text-left bg-white/60 border-stone-200 text-stone-400 hover:border-stone-300";
        icon.className = "w-8 h-8 rounded-xl bg-stone-100 text-stone-500 flex items-center justify-center font-bold text-sm shrink-0";
        icon.innerHTML = stageIcons[s];
        btn.title = '';
        btn.onclick = () => changeStage(s);
      }
    }
  });

  renderHomeScreen();
  renderNominationsGrid();
  renderVotingSection();
  renderResultsGrid();
  renderRouletteView();

  updateMobileStageBar(window.localStage, !checkStageAccess(window.localStage).allowed);
};

// ==========================================
// RENDER HOME — LIVRO ATUAL
// ==========================================
function renderHomeScreen() {
  const container = document.getElementById('homeCurrentBookContainer');
  if (!container) return;

  const state = window.clubState;
  if (!state) return;

  // Busca o livro atual (vencedor da rodada ou o mais recente do histórico)
  const currentWinner = state.winner;
  const latestHistory = state.history && state.history.length > 0 ? state.history[0] : null;

  let book = null;
  let memberName = '';
  let monthLabel = '';
  let drawDate = '';

  if (currentWinner && currentWinner.book) {
    book = currentWinner.book;
    memberName = currentWinner.member;
    monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date());
    drawDate = new Date().toLocaleDateString('pt-BR');
  } else if (latestHistory && latestHistory.winner) {
    book = latestHistory.winner;
    memberName = latestHistory.winner.member;
    monthLabel = latestHistory.monthLabel || '';
    drawDate = latestHistory.archivedAt || '';
  }

  const homeSignature = JSON.stringify({
    title: book?.title || '',
    author: book?.author || '',
    cover: book?.cover || '',
    memberName,
    monthLabel,
    drawDate,
    membersCount: state.members.length
  });

  if (_lastHomeScreenSignature === homeSignature && container.children.length > 0) return;
  _lastHomeScreenSignature = homeSignature;

  if (!book) {
    // Estado Vazio: Nenhum livro sorteado ainda
    container.innerHTML = `
      <div class="bg-white rounded-3xl p-6 sm:p-12 border border-[#EBE4D8] shadow-xs text-center space-y-4 max-w-xl mx-auto">
        <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-burgundy/10 text-burgundy flex items-center justify-center text-3xl sm:text-4xl mx-auto">
          <i class="ph ph-books"></i>
        </div>
        <div class="space-y-1">
          <h3 class="text-xl sm:text-2xl font-serif font-bold text-stone-900">Bem-vindos ao Clube!</h3>
          <p class="text-xs sm:text-sm text-stone-500 max-w-md mx-auto">Ainda não há nenhum livro sorteado neste clube. Comece adicionando as indicações dos integrantes para a primeira rodada!</p>
        </div>
        <div class="pt-2">
          <button onclick="changeStage('nominations')" class="px-5 py-2.5 sm:px-6 sm:py-3 rounded-2xl bg-burgundy hover:bg-burgundyLight text-white font-bold text-xs sm:text-sm shadow-md shadow-burgundy/20 transition inline-flex items-center gap-2">
            <i class="ph ph-plus-circle text-base sm:text-lg"></i> Iniciar Indicações da 1ª Leitura
          </button>
        </div>
      </div>
    `;
    return;
  }

  const coverUrl = book.cover || (typeof DEFAULT_BOOK_COVER !== 'undefined' ? DEFAULT_BOOK_COVER : '');

  container.innerHTML = `
    <div class="space-y-4 sm:space-y-6">
      <!-- HERO DO LIVRO ATUAL -->
      <div class="bg-gradient-to-br from-[#FAF5EC] via-white to-[#F5EDE1] rounded-3xl p-4 sm:p-8 border border-gold/30 shadow-xl relative overflow-hidden">
        <div class="absolute -right-12 -top-12 w-48 h-48 bg-gold/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div class="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-stone-200/60">
          <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-burgundy/10 text-burgundy font-black text-[10px] sm:text-xs uppercase tracking-wider">
              <i class="ph ph-book-open text-xs sm:text-sm"></i> Leitura Atual
            </span>
            ${monthLabel ? `<span class="text-[11px] sm:text-xs text-stone-500 font-semibold">• ${escapeHtml(monthLabel)}</span>` : ''}
          </div>
          <button onclick="startNewRound()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-black text-white text-xs font-bold transition shadow-xs">
            <span>Iniciar Nova Rodada</span> <i class="ph ph-arrow-right text-xs"></i>
          </button>
        </div>

        <div class="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-8">
          <!-- Capa com proporção padrão 2:3 -->
          <div class="relative shrink-0 group">
            <img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(book.title)}" class="w-32 sm:w-56 aspect-[2/3] object-cover rounded-2xl shadow-xl border-2 border-gold/30 transition transform group-hover:scale-[1.02] book-cover" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;">
            <div class="absolute inset-0 rounded-2xl ring-1 ring-black/5 pointer-events-none"></div>
          </div>

          <!-- Informações -->
          <div class="flex-1 text-center sm:text-left space-y-2 sm:space-y-3 min-w-0">
            <div class="space-y-1">
              <span class="text-xs sm:text-sm font-bold text-burgundy uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1.5">
                <i class="ph ph-sparkle text-gold text-sm sm:text-base"></i> Indicado por ${escapeHtml(memberName || 'Integrante')}
              </span>
              <h2 class="text-2xl sm:text-4xl font-serif font-bold text-stone-900 leading-tight">${escapeHtml(book.title || 'Sem título')}</h2>
              <p class="text-base sm:text-xl font-medium text-stone-700">${escapeHtml(book.author || 'Autor não informado')}</p>
            </div>

            ${book.description ? `<p class="text-xs sm:text-base text-stone-600 italic font-serif line-clamp-2 sm:line-clamp-3 bg-white/60 p-2.5 sm:p-3.5 rounded-xl border border-stone-200/50">"${escapeHtml(book.description)}"</p>` : ''}

            <div class="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm text-stone-600 font-medium">
              ${drawDate ? `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-stone-100 text-stone-800">
                  <i class="ph ph-calendar-blank text-burgundy"></i> Sorteado em ${escapeHtml(drawDate)}
                </span>` : ''}
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-stone-100 text-stone-800">
                <i class="ph ph-users text-burgundy"></i> ${state.members.length} Leitores
              </span>
            </div>

            <!-- Botões de Ação -->
            <div class="pt-2 sm:pt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3">
              <button onclick="openCardPreviewModal()" class="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-stone-900 hover:bg-black text-white font-bold text-xs sm:text-sm transition flex items-center gap-1.5 sm:gap-2 shadow-sm">
                <i class="ph ph-eye text-base text-gold"></i><span>Visualizar Card</span>
              </button>
              <button onclick="openHistoryModal()" class="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-700 font-bold text-xs sm:text-sm transition flex items-center gap-1.5 sm:gap-2 shadow-xs">
                <i class="ph ph-clock-counter-clockwise text-base text-burgundy"></i><span>Ver Histórico</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- CARD CONVIDATIVO PARA O PRÓXIMO SORTEIO -->
      <div class="p-4 sm:p-5 rounded-2xl bg-white border border-[#EBE4D8] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
        <div class="flex items-center gap-3 text-center sm:text-left">
          <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-burgundy/10 text-burgundy flex items-center justify-center text-xl sm:text-2xl shrink-0">
            <i class="ph ph-sparkle"></i>
          </div>
          <div>
            <h4 class="font-serif font-bold text-xs sm:text-sm text-stone-900">Preparando a Próxima Leitura?</h4>
            <p class="text-[11px] sm:text-xs text-stone-500">Inicie a rodada de indicações para o próximo encontro do clube.</p>
          </div>
        </div>
        <button onclick="startNewRound()" class="w-full sm:w-auto px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-burgundy hover:bg-burgundyLight text-white font-bold text-xs shadow-md shadow-burgundy/20 transition flex items-center justify-center gap-2 shrink-0">
          <i class="ph ph-plus-circle text-base"></i><span>Iniciar Nova Rodada</span>
        </button>
      </div>
    </div>
  `;
}
