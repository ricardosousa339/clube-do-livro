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

function changeStage(newStage) {
  // FIX: Stage é local — NÃO sincroniza na nuvem
  window.localStage = newStage;
  localStorage.setItem('clubeDoLivro_localStage', newStage);
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
  const historyLen = (state.history || []).length;
  if (historyBadge) {
    if (historyLen > 0) { historyBadge.innerText = historyLen; historyBadge.classList.remove('hidden'); } 
    else { historyBadge.classList.add('hidden'); }
  }

  const activeMemberLabel = document.getElementById('activeMemberLabel');
  if (activeMemberLabel) {
    const currentMem = state.members.find(m => m.id === window.localCurrentUser);
    if (currentMem) {
      activeMemberLabel.innerHTML = `<span class="truncate max-w-[110px] sm:max-w-[150px]">${escapeHtml(currentMem.name)}</span> <i class="ph ph-lock-key-fill text-burgundy text-xs" title="Perfil vinculado a este dispositivo"></i>`;
    } else {
      activeMemberLabel.innerText = state.members[0]?.name || 'Identificar-se';
    }
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

  // FIX: Usar localStage em vez de state.stage — cada usuário controla sua navegação
  ['home', 'nominations', 'voting', 'results', 'draw'].forEach(s => {
    const section = document.getElementById(`section-${s}`);
    const btn = document.getElementById(`stepBtn-${s}`);
    const icon = document.getElementById(`stepIcon-${s}`);
    if (section && btn && icon) {
      if (s === window.localStage) {
        section.classList.remove('hidden');
        btn.className = "flex items-center gap-3 p-3 rounded-2xl border transition-all text-left bg-white border-burgundy shadow-sm ring-2 ring-burgundy/20";
        icon.className = "w-8 h-8 rounded-xl bg-burgundy text-white flex items-center justify-center font-bold text-sm shrink-0";
      } else {
        section.classList.add('hidden');
        btn.className = "flex items-center gap-3 p-3 rounded-2xl border transition-all text-left bg-white/60 border-stone-200 text-stone-400 hover:border-stone-300";
        icon.className = "w-8 h-8 rounded-xl bg-stone-100 text-stone-500 flex items-center justify-center font-bold text-sm shrink-0";
      }
    }
  });

  renderHomeScreen();
  renderNominationsGrid();
  renderVotingSection();
  renderResultsGrid();
  renderRouletteView();
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
      <div class="bg-white rounded-3xl p-8 sm:p-12 border border-[#EBE4D8] shadow-xs text-center space-y-4 max-w-xl mx-auto">
        <div class="w-16 h-16 rounded-3xl bg-burgundy/10 text-burgundy flex items-center justify-center text-4xl mx-auto">
          <i class="ph ph-books"></i>
        </div>
        <div class="space-y-1">
          <h3 class="text-2xl font-serif font-bold text-stone-900">Bem-vindos ao Clube!</h3>
          <p class="text-xs sm:text-sm text-stone-500 max-w-md mx-auto">Ainda não há nenhum livro sorteado neste clube. Comece adicionando as indicações dos integrantes para a primeira rodada!</p>
        </div>
        <div class="pt-2">
          <button onclick="changeStage('nominations')" class="px-6 py-3 rounded-2xl bg-burgundy hover:bg-burgundyLight text-white font-bold text-sm shadow-md shadow-burgundy/20 transition inline-flex items-center gap-2">
            <i class="ph ph-plus-circle text-lg"></i> Iniciar Indicações da 1ª Leitura
          </button>
        </div>
      </div>
    `;
    return;
  }

  const coverUrl = book.cover || (typeof DEFAULT_BOOK_COVER !== 'undefined' ? DEFAULT_BOOK_COVER : '');

  container.innerHTML = `
    <div class="space-y-6">
      <!-- HERO DO LIVRO ATUAL -->
      <div class="bg-gradient-to-br from-[#FAF5EC] via-white to-[#F5EDE1] rounded-3xl p-6 sm:p-8 border border-gold/30 shadow-xl relative overflow-hidden">
        <div class="absolute -right-12 -top-12 w-48 h-48 bg-gold/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div class="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-stone-200/60">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-burgundy/10 text-burgundy font-black text-xs uppercase tracking-wider">
              <i class="ph ph-book-open text-sm"></i> Leitura Atual do Clube
            </span>
            ${monthLabel ? `<span class="text-xs text-stone-500 font-semibold">• ${escapeHtml(monthLabel)}</span>` : ''}
          </div>
          <button onclick="changeStage('nominations')" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-black text-white text-xs font-bold transition shadow-xs">
            <span>Iniciar Nova Rodada</span> <i class="ph ph-arrow-right"></i>
          </button>
        </div>

        <div class="flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-8">
          <!-- Capa com proporção padrão 2:3 -->
          <div class="relative shrink-0 group">
            <img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(book.title)}" class="w-44 sm:w-56 aspect-[2/3] object-cover rounded-2xl shadow-2xl border-2 border-gold/30 transition transform group-hover:scale-[1.02] book-cover" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;">
            <div class="absolute inset-0 rounded-2xl ring-1 ring-black/5 pointer-events-none"></div>
          </div>

          <!-- Informações -->
          <div class="flex-1 text-center md:text-left space-y-3 min-w-0">
            <div class="space-y-1.5">
              <span class="text-sm font-bold text-burgundy uppercase tracking-wider flex items-center justify-center md:justify-start gap-1.5">
                <i class="ph ph-sparkle text-gold text-base"></i> Indicado por ${escapeHtml(memberName || 'Integrante')}
              </span>
              <h2 class="text-3xl sm:text-4xl font-serif font-bold text-stone-900 leading-tight">${escapeHtml(book.title || 'Sem título')}</h2>
              <p class="text-lg sm:text-xl font-medium text-stone-700">${escapeHtml(book.author || 'Autor não informado')}</p>
            </div>

            ${book.description ? `<p class="text-sm sm:text-base text-stone-600 italic font-serif line-clamp-3 bg-white/60 p-3.5 rounded-xl border border-stone-200/50">"${escapeHtml(book.description)}"</p>` : ''}

            <div class="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-2.5 text-sm text-stone-600 font-medium">
              ${drawDate ? `
                <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 text-stone-800">
                  <i class="ph ph-calendar-blank text-burgundy"></i> Sorteado em ${escapeHtml(drawDate)}
                </span>` : ''}
              <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 text-stone-800">
                <i class="ph ph-users text-burgundy"></i> ${state.members.length} Leitores
              </span>
            </div>

            <!-- Botões de Ação Separados -->
            <div class="pt-4 flex flex-wrap items-center justify-center md:justify-start gap-3">
              <button onclick="downloadCurrentMonthCard()" class="px-4.5 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-white font-bold text-sm transition flex items-center gap-2 shadow-sm">
                <i class="ph ph-download-simple text-base text-gold"></i><span>Baixar Card</span>
              </button>
              <button onclick="shareMonthCardWhatsApp()" class="px-4.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition flex items-center gap-2 shadow-sm shadow-emerald-700/20">
                <i class="ph ph-whatsapp-logo text-base"></i><span>Enviar para o WhatsApp</span>
              </button>
              <button onclick="openHistoryModal()" class="px-4.5 py-2.5 rounded-xl border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-700 font-bold text-sm transition flex items-center gap-2 shadow-xs">
                <i class="ph ph-clock-counter-clockwise text-base text-burgundy"></i><span>Ver Histórico</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- CARD CONVIDATIVO PARA O PRÓXIMO SORTEIO -->
      <div class="p-5 rounded-2xl bg-white border border-[#EBE4D8] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-3 text-center sm:text-left">
          <div class="w-11 h-11 rounded-2xl bg-burgundy/10 text-burgundy flex items-center justify-center text-2xl shrink-0">
            <i class="ph ph-sparkle"></i>
          </div>
          <div>
            <h4 class="font-serif font-bold text-sm text-stone-900">Preparando a Próxima Leitura?</h4>
            <p class="text-xs text-stone-500">Inicie a rodada de indicações para o próximo encontro do clube.</p>
          </div>
        </div>
        <button onclick="changeStage('nominations')" class="px-5 py-2.5 rounded-xl bg-burgundy hover:bg-burgundyLight text-white font-bold text-xs shadow-md shadow-burgundy/20 transition flex items-center gap-2 shrink-0">
          <i class="ph ph-plus-circle text-base"></i><span>Iniciar Nova Rodada</span>
        </button>
      </div>
    </div>
  `;
}
