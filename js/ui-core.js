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
  ['nominations', 'voting', 'results', 'draw'].forEach(s => {
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

  renderNominationsGrid();
  renderVotingSection();
  renderResultsGrid();
  renderRouletteView();
};
