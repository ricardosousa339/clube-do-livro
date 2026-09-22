// ==========================================
// PAINEL DE ADMINISTRAÇÃO — Clube do Livro
// Acesso discreto, segurança via hash SHA-256 e controle total da sala
// ==========================================

window._isAdminAuthenticated = false;
let _currentAdminTab = 'current';
let _badgeClickCount = 0;
let _badgeClickTimer = null;
let _adminAuthMode = 'verify'; // 'create' | 'verify' | 'change'

// ==========================================
// CRIPTOGRAFIA / HASHING (Web Crypto API)
// ==========================================
async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ==========================================
// GATILHO DISCRETO — TRIPLE CLICK NO BADGE
// ==========================================
function initAdminBadgeTrigger() {
  const badge = document.getElementById('versionBadge');
  if (!badge) return;

  badge.setAttribute('title', 'Versão do Clube do Livro');

  badge.addEventListener('click', () => {
    _badgeClickCount++;
    if (_badgeClickCount === 1) {
      _badgeClickTimer = setTimeout(() => {
        _badgeClickCount = 0;
      }, 1200);
    } else if (_badgeClickCount >= 3) {
      clearTimeout(_badgeClickTimer);
      _badgeClickCount = 0;
      handleAdminTrigger();
    }
  });
}

async function handleAdminTrigger() {
  if (!window.currentRoomId || !db) {
    if (typeof showToast === 'function') {
      showToast('Entre em uma sala para acessar o painel de admin.', 'warning');
    } else {
      alert('Entre em uma sala para acessar o painel de admin.');
    }
    return;
  }

  // Se já está autenticado nesta sessão, abre direto
  if (window._isAdminAuthenticated) {
    openAdminModal();
    return;
  }

  // Verifica no Firestore se já existe hash configurado para a sala
  try {
    const docRef = db.collection('clubes').doc(window.currentRoomId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      showToast('Sala não encontrada no banco de dados.', 'danger');
      return;
    }

    const adminHash = docSnap.data()?.adminHash;
    if (!adminHash) {
      // Primeiro acesso: criar senha
      openAdminAuthModal('create');
    } else {
      // Próximos acessos: verificar senha
      openAdminAuthModal('verify');
    }
  } catch (err) {
    console.error('[Admin] Erro ao verificar credenciais:', err);
    showToast('Erro ao consultar status de admin da sala.', 'danger');
  }
}

// ==========================================
// MODAL DE AUTENTICAÇÃO / CRIAÇÃO DE SENHA
// ==========================================
function openAdminAuthModal(mode = 'verify') {
  _adminAuthMode = mode;
  const modal = document.getElementById('adminAuthModal');
  const title = document.getElementById('adminAuthTitle');
  const subtitle = document.getElementById('adminAuthSubtitle');
  const label = document.getElementById('adminAuthLabel');
  const confirmGroup = document.getElementById('adminAuthConfirmGroup');
  const submitBtn = document.getElementById('adminAuthSubmitBtn');
  const errorBox = document.getElementById('adminAuthError');
  const input = document.getElementById('adminAuthInput');
  const confirmInput = document.getElementById('adminAuthConfirmInput');

  if (!modal) return;

  if (errorBox) {
    errorBox.innerText = '';
    errorBox.classList.add('hidden');
  }

  if (input) input.value = '';
  if (confirmInput) confirmInput.value = '';

  if (mode === 'create') {
    if (title) title.innerText = 'Criar Senha de Administrador';
    if (subtitle) subtitle.innerHTML = `Primeiro acesso à sala <strong class="text-amber-400">${escapeHtml(window.currentRoomId)}</strong>`;
    if (label) label.innerText = 'Defina a nova senha (mínimo 4 caracteres):';
    if (confirmGroup) confirmGroup.classList.remove('hidden');
    if (submitBtn) submitBtn.innerText = 'Criar Senha e Entrar';
  } else if (mode === 'change') {
    if (title) title.innerText = 'Alterar Senha de Administrador';
    if (subtitle) subtitle.innerHTML = `Sala <strong class="text-amber-400">${escapeHtml(window.currentRoomId)}</strong>`;
    if (label) label.innerText = 'Nova senha (mínimo 4 caracteres):';
    if (confirmGroup) confirmGroup.classList.remove('hidden');
    if (submitBtn) submitBtn.innerText = 'Salvar Nova Senha';
  } else {
    if (title) title.innerText = 'Acesso de Administrador';
    if (subtitle) subtitle.innerHTML = `Sala <strong class="text-amber-400">${escapeHtml(window.currentRoomId)}</strong>`;
    if (label) label.innerText = 'Senha do Painel:';
    if (confirmGroup) confirmGroup.classList.add('hidden');
    if (submitBtn) submitBtn.innerText = 'Acessar Painel';
  }

  modal.classList.remove('hidden');
  setTimeout(() => input?.focus(), 100);
}

function closeAdminAuthModal() {
  const modal = document.getElementById('adminAuthModal');
  if (modal) modal.classList.add('hidden');
}

function toggleAdminPasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function handleAdminAuthSubmit(event) {
  if (event) event.preventDefault();

  const input = document.getElementById('adminAuthInput');
  const confirmInput = document.getElementById('adminAuthConfirmInput');
  const errorBox = document.getElementById('adminAuthError');
  const pwd = input?.value || '';
  const confirmPwd = confirmInput?.value || '';

  function showError(msg) {
    if (errorBox) {
      errorBox.innerText = msg;
      errorBox.classList.remove('hidden');
    } else {
      showToast(msg, 'danger');
    }
    if (typeof playSound === 'function') playSound('error');
  }

  if (_adminAuthMode === 'create' || _adminAuthMode === 'change') {
    if (pwd.length < 4) {
      showError('A senha deve conter no mínimo 4 caracteres.');
      return;
    }
    if (pwd !== confirmPwd) {
      showError('As senhas digitadas não coincidem.');
      return;
    }

    try {
      const hash = await sha256(pwd);
      await db.collection('clubes').doc(window.currentRoomId).set({ adminHash: hash }, { merge: true });
      window._isAdminAuthenticated = true;
      closeAdminAuthModal();
      openAdminModal();
      showToast(_adminAuthMode === 'create' ? 'Senha admin criada com sucesso!' : 'Senha admin alterada com sucesso!', 'success');
      if (typeof playSound === 'function') playSound('advance');
    } catch (err) {
      console.error('[Admin] Erro ao salvar senha:', err);
      showError('Falha ao salvar senha no banco de dados.');
    }
    return;
  }

  // Modo 'verify'
  if (!pwd) {
    showError('Por favor, digite a senha.');
    return;
  }

  try {
    const docSnap = await db.collection('clubes').doc(window.currentRoomId).get();
    const storedHash = docSnap.data()?.adminHash;

    if (!storedHash) {
      // Se não havia senha, entra em modo criação
      openAdminAuthModal('create');
      return;
    }

    const enteredHash = await sha256(pwd);
    if (enteredHash === storedHash) {
      window._isAdminAuthenticated = true;
      closeAdminAuthModal();
      openAdminModal();
      showToast('Acesso de administrador concedido!', 'success');
      if (typeof playSound === 'function') playSound('advance');
    } else {
      showError('Senha incorreta.');
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  } catch (err) {
    console.error('[Admin] Erro ao validar senha:', err);
    showError('Erro de conexão ao validar senha.');
  }
}

function adminLogout() {
  window._isAdminAuthenticated = false;
  closeAdminModal();
  showToast('Sessão de administrador encerrada.', 'info');
}

function promptChangeAdminPassword() {
  openAdminAuthModal('change');
}

// ==========================================
// PAINEL PRINCIPAL — ABERTURA E NAVEGAÇÃO
// ==========================================
function openAdminModal() {
  if (!window._isAdminAuthenticated) {
    handleAdminTrigger();
    return;
  }

  const modal = document.getElementById('adminModal');
  if (!modal) return;

  const roomBadge = document.getElementById('adminRoomBadge');
  if (roomBadge) roomBadge.innerText = window.currentRoomId || 'SEM SALA';

  const clubNameDisplay = document.getElementById('adminClubNameDisplay');
  if (clubNameDisplay) clubNameDisplay.innerText = window.clubState?.clubName || 'Clube do Livro';

  modal.classList.remove('hidden');
  switchAdminTab(_currentAdminTab || 'current');
}

function closeAdminModal() {
  const modal = document.getElementById('adminModal');
  if (modal) modal.classList.add('hidden');
}

function switchAdminTab(tabName) {
  _currentAdminTab = tabName;
  const tabs = ['current', 'members', 'nominations', 'votes', 'backup', 'presence', 'danger'];

  tabs.forEach(t => {
    const btn = document.getElementById(`adminTabBtn-${t}`);
    if (!btn) return;
    if (t === tabName) {
      if (t === 'danger') {
        btn.className = 'admin-tab-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-xs';
      } else {
        btn.className = 'admin-tab-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs';
      }
    } else {
      if (t === 'danger') {
        btn.className = 'admin-tab-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap text-rose-400/80 hover:text-rose-300 hover:bg-rose-950/40';
      } else {
        btn.className = 'admin-tab-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap text-stone-400 hover:text-stone-200 hover:bg-stone-800/60';
      }
    }
  });

  renderAdminCurrentTab();
}

function renderAdminCurrentTab() {
  const container = document.getElementById('adminTabContent');
  if (!container) return;

  switch (_currentAdminTab) {
    case 'current':
      renderAdminCurrentBookTab(container);
      break;
    case 'members':
      renderAdminMembersTab(container);
      break;
    case 'nominations':
      renderAdminNominationsTab(container);
      break;
    case 'votes':
      renderAdminVotesTab(container);
      break;
    case 'backup':
      renderAdminBackupTab(container);
      break;
    case 'presence':
      renderAdminPresenceTab(container);
      break;
    case 'danger':
      renderAdminDangerTab(container);
      break;
    default:
      renderAdminCurrentBookTab(container);
  }
}

// Hook chamado quando o Firestore sincroniza remotamente
window.refreshAdminUIIfOpen = function() {
  const modal = document.getElementById('adminModal');
  if (modal && !modal.classList.contains('hidden')) {
    renderAdminCurrentTab();
  }
};

// ==========================================
// TAB: GERENCIAMENTO DO LIVRO ATUAL & DOWNLOAD
// ==========================================
function renderAdminCurrentBookTab(container) {
  const state = window.clubState;
  const currentWinner = state?.winner;
  const latestHistory = state?.history && state.history.length > 0 ? state.history[0] : null;

  let currentBook = null;
  let bookSource = null; // 'winner' | 'history'
  let memberName = '';
  let dateOrMonth = '';

  if (currentWinner && currentWinner.book) {
    currentBook = currentWinner.book;
    bookSource = 'winner';
    memberName = currentWinner.member;
    dateOrMonth = currentWinner.drawnAt ? new Date(currentWinner.drawnAt).toLocaleDateString('pt-BR') : 'Rodada Atual';
  } else if (latestHistory && latestHistory.winner) {
    currentBook = latestHistory.winner;
    bookSource = 'history';
    memberName = latestHistory.winner.member;
    dateOrMonth = latestHistory.monthLabel || latestHistory.archivedAt || 'Leitura Vigente';
  }

  let html = `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-800">
      <div>
        <h4 class="text-sm font-bold text-stone-200 flex items-center gap-2">
          <i class="ph ph-book-open text-amber-400 text-base"></i>
          <span>Gerenciar Leitura Atual & Link de Download</span>
        </h4>
        <p class="text-xs text-stone-400 mt-0.5">Adicione o link do livro (PDF, ePub, Drive) para que todos possam baixar na tela inicial.</p>
      </div>
    </div>
  `;

  if (!currentBook) {
    html += `
      <div class="text-center py-12 text-stone-500 bg-stone-950/40 rounded-2xl border border-stone-800/80 space-y-2">
        <i class="ph ph-books text-4xl text-stone-600 block mx-auto"></i>
        <p class="text-sm font-bold text-stone-300">Nenhum livro sorteado no momento</p>
        <p class="text-xs text-stone-500 max-w-sm mx-auto">Assim que um livro for sorteado ou registrado, ele aparecerá aqui para você configurar o link de download.</p>
      </div>
    `;
  } else {
    const coverUrl = currentBook.cover || (typeof DEFAULT_BOOK_COVER !== 'undefined' ? DEFAULT_BOOK_COVER : '');
    const hasDownload = !!(currentBook.downloadUrl && currentBook.downloadUrl.trim());

    html += `
      <div class="space-y-6">
        <!-- CARD DO LIVRO ATUAL -->
        <div class="p-5 rounded-2xl bg-stone-950/60 border border-stone-800">
          <div class="flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between mb-5 pb-5 border-b border-stone-800/80">
            <div class="flex items-center gap-4 min-w-0">
              <img src="${escapeHtml(coverUrl)}" alt="Capa" class="w-16 sm:w-20 aspect-[2/3] object-cover rounded-xl bg-stone-900 border border-stone-700 shadow-md shrink-0 book-cover" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;">
              <div class="min-w-0 space-y-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    ${bookSource === 'winner' ? 'Sorteado (Em Andamento)' : 'Leitura Vigente'}
                  </span>
                  ${dateOrMonth ? `<span class="text-xs text-stone-400 font-medium">• ${escapeHtml(dateOrMonth)}</span>` : ''}
                </div>
                <h3 class="text-lg font-serif font-bold text-stone-100 truncate">${escapeHtml(currentBook.title || 'Sem título')}</h3>
                <p class="text-xs text-stone-400 truncate">${escapeHtml(currentBook.author || 'Autor não informado')}</p>
                <p class="text-[11px] text-stone-500">Indicado por: <span class="text-stone-300 font-semibold">${escapeHtml(memberName || 'Membro')}</span></p>
              </div>
            </div>

            <div class="shrink-0">
              ${hasDownload ? `
                <div class="px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                  <i class="ph ph-check-circle text-base"></i>
                  <span>Link de Download Ativo</span>
                </div>
              ` : `
                <div class="px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-400 text-xs font-bold flex items-center gap-1.5">
                  <i class="ph ph-warning-circle text-base"></i>
                  <span>Sem Link de Download</span>
                </div>
              `}
            </div>
          </div>

          <!-- FORMULÁRIO DO LINK DE DOWNLOAD -->
          <div class="space-y-3">
            <div>
              <label class="text-xs font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <i class="ph ph-link text-amber-400 text-sm"></i>
                <span>Link para Download do Livro</span>
              </label>
              <div class="relative">
                <input id="adminBookDownloadUrl" type="url" value="${escapeHtml(currentBook.downloadUrl || '')}" placeholder="https://drive.google.com/... ou link direto do arquivo (PDF, ePub)" class="w-full px-4 py-3 rounded-xl bg-stone-900 border border-stone-700 text-stone-100 text-xs font-mono focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition">
              </div>
              <p class="text-[11px] text-stone-400 mt-1.5 leading-relaxed">
                Insira o link onde o arquivo do livro está hospedado (Google Drive, Dropbox, Mega, OneDrive ou link direto de download). 
                Quando salvo, o botão <strong>"Baixar Livro"</strong> aparecerá automaticamente com destaque na página inicial (Home) para todos os integrantes.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2 pt-2">
              <button onclick="adminSaveCurrentBookDownloadUrl()" class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-2 transition shadow-md shadow-amber-500/20">
                <i class="ph ph-floppy-disk text-base"></i>
                <span>Salvar Link de Download</span>
              </button>

              ${hasDownload ? `
                <a href="${escapeHtml(currentBook.downloadUrl)}" target="_blank" rel="noopener noreferrer" class="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center gap-1.5 transition">
                  <i class="ph ph-arrow-square-out text-sm text-amber-400"></i>
                  <span>Testar Link</span>
                </a>
                <button onclick="adminRemoveCurrentBookDownloadUrl()" class="px-4 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 font-bold text-xs flex items-center gap-1.5 transition">
                  <i class="ph ph-trash text-sm"></i>
                  <span>Remover Link</span>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // HISTÓRICO DE LEITURAS ANTERIORES
  const history = state?.history || [];
  if (history.length > 0) {
    html += `
      <div class="pt-6 border-t border-stone-800 space-y-3">
        <div class="flex items-center justify-between">
          <h5 class="text-xs font-bold text-stone-300 uppercase tracking-wider flex items-center gap-2">
            <i class="ph ph-clock-counter-clockwise text-stone-400"></i>
            <span>Links de Leituras do Histórico (${history.length})</span>
          </h5>
          <span class="text-[11px] text-stone-500">Você também pode gerenciar o link de cada mês anterior</span>
        </div>

        <div class="space-y-2">
          ${history.map(item => {
            const hWinner = item.winner;
            const hHasLink = !!(hWinner?.downloadUrl && hWinner.downloadUrl.trim());
            return `
              <div class="p-3 rounded-xl bg-stone-950/40 border border-stone-800/80 flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <img src="${hWinner?.cover || DEFAULT_BOOK_COVER}" class="w-9 aspect-[2/3] object-cover rounded-lg bg-stone-900 border border-stone-800 shrink-0 book-cover" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;">
                  <div class="min-w-0">
                    <span class="text-[10px] font-bold text-amber-400 block truncate">${escapeHtml(item.monthLabel || item.archivedAt || '')}</span>
                    <h6 class="font-serif font-bold text-xs text-stone-200 truncate">${escapeHtml(hWinner?.title || 'Sem título')}</h6>
                    <p class="text-[11px] text-stone-500 truncate">${escapeHtml(hWinner?.author || '')} • Indicado por ${escapeHtml(hWinner?.member || '')}</p>
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  ${hHasLink ? `
                    <a href="${escapeHtml(hWinner.downloadUrl)}" target="_blank" rel="noopener noreferrer" class="p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 text-xs hover:bg-emerald-900/60 transition" title="Abrir link de download">
                      <i class="ph ph-download-simple text-sm"></i>
                    </a>
                  ` : ''}
                  <button onclick="adminEditHistoryItemDownload('${item.id}')" class="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1 transition">
                    <i class="ph ph-pencil-simple text-xs text-amber-400"></i>
                    <span>${hHasLink ? 'Editar Link' : 'Adicionar Link'}</span>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

async function adminSaveCurrentBookDownloadUrl() {
  const input = document.getElementById('adminBookDownloadUrl');
  if (!input) return;
  let url = input.value.trim();

  if (url && !/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
    input.value = url;
  }

  const state = window.clubState;
  if (!state) return;

  const currentWinner = state.winner;
  const latestHistory = state.history && state.history.length > 0 ? state.history[0] : null;

  if (currentWinner && currentWinner.book) {
    currentWinner.book.downloadUrl = url;
    await persistState('state.winner');
  } else if (latestHistory && latestHistory.winner) {
    latestHistory.winner.downloadUrl = url;
    await persistState('state.history');
  } else {
    showToast('Nenhum livro atual encontrado.', 'warning');
    return;
  }

  invalidateRenderCache();
  renderAdminCurrentTab();
  if (typeof window.renderUI === 'function') window.renderUI();

  if (url) {
    showToast('Link de download salvo! O botão "Baixar Livro" está ativo na Home.', 'success');
  } else {
    showToast('Link de download removido.', 'info');
  }
}

async function adminRemoveCurrentBookDownloadUrl() {
  if (!confirm('Deseja remover o link de download do livro atual?')) return;
  const input = document.getElementById('adminBookDownloadUrl');
  if (input) input.value = '';
  await adminSaveCurrentBookDownloadUrl();
}

function adminEditHistoryItemDownload(historyId) {
  const item = window.clubState?.history?.find(h => h.id === historyId);
  if (!item || !item.winner) return showToast('Registro não encontrado.', 'warning');
  openPromptModal(`Link de Download (${item.winner.title}):`, item.winner.downloadUrl || '', async (newUrl) => {
    let url = (newUrl || '').trim();
    if (url && !/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    item.winner.downloadUrl = url;
    invalidateRenderCache();
    await persistState('state.history');
    renderAdminCurrentTab();
    if (typeof window.renderUI === 'function') window.renderUI();
    showToast(url ? 'Link de download atualizado no histórico!' : 'Link de download removido.', 'success');
  });
}

// ==========================================
// TAB 1: GERENCIAMENTO DE MEMBROS
// ==========================================
function renderAdminMembersTab(container) {
  const members = window.clubState?.members || [];
  const votes = window.clubState?.votes || {};
  const currentLocked = typeof getLockedUserId === 'function' ? getLockedUserId() : null;

  let html = `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-800">
      <div>
        <h4 class="text-sm font-bold text-stone-200 flex items-center gap-2">
          <i class="ph ph-users text-amber-400 text-base"></i>
          <span>Gerenciamento de Membros (${members.length})</span>
        </h4>
        <p class="text-xs text-stone-400 mt-0.5">Adicione, renomeie, limpe dados ou assuma a identidade de qualquer integrante.</p>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="adminPromptAddMember()" class="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition shadow-xs">
          <i class="ph ph-user-plus text-sm"></i>
          <span>Novo Membro</span>
        </button>
        <button onclick="adminClearCurrentDeviceLock()" title="Limpa o vínculo deste navegador com qualquer usuário" class="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold text-xs flex items-center gap-1.5 transition">
          <i class="ph ph-device-mobile text-sm text-stone-400"></i>
          <span>Desvincular Este Aparelho</span>
        </button>
      </div>
    </div>
  `;

  if (members.length === 0) {
    html += `
      <div class="text-center py-12 text-stone-500 bg-stone-950/40 rounded-2xl border border-stone-800/80">
        <i class="ph ph-users-three text-4xl mb-2 text-stone-600"></i>
        <p class="text-sm">Nenhum membro cadastrado nesta sala ainda.</p>
      </div>
    `;
    container.innerHTML = html;
    return;
  }

  html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">`;

  members.forEach(m => {
    const isCurrentActive = window.localCurrentUser === m.id;
    const isLockedOnDevice = currentLocked === m.id;
    const booksCount = (m.book1 ? 1 : 0) + (m.book2 ? 1 : 0);
    const votesCast = Object.keys(votes[m.id] || {}).length;
    const othersCount = members.length > 1 ? members.length - 1 : 0;
    const votesDone = othersCount > 0 && votesCast >= othersCount;

    html += `
      <div class="p-4 rounded-2xl bg-stone-950/60 border ${isCurrentActive ? 'border-amber-500/60 ring-1 ring-amber-500/30' : 'border-stone-800'} flex flex-col justify-between gap-3 transition">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-stone-800 text-amber-400 border border-stone-700 font-bold text-sm flex items-center justify-center shrink-0">
              ${escapeHtml(m.name.substring(0, 2).toUpperCase())}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h5 class="font-bold text-sm text-stone-100 truncate">${escapeHtml(m.name)}</h5>
                ${isCurrentActive ? '<span class="text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">Você</span>' : ''}
                ${isLockedOnDevice && !isCurrentActive ? '<span class="text-[10px] bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded">Vínculo local</span>' : ''}
              </div>
              <span class="text-[11px] font-mono text-stone-500 block truncate">ID: ${escapeHtml(m.id)}</span>
            </div>
          </div>
          <button onclick="adminRenameMember('${m.id}')" title="Renomear integrante" class="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 transition">
            <i class="ph ph-pencil-simple text-sm"></i>
          </button>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="p-2 rounded-xl bg-stone-900 border border-stone-800/80">
            <span class="text-[10px] text-stone-500 block uppercase font-bold">Indicações</span>
            <div class="flex items-center gap-1.5 mt-0.5 font-semibold ${booksCount === 2 ? 'text-emerald-400' : (booksCount === 1 ? 'text-amber-400' : 'text-stone-500')}">
              <i class="ph ph-book text-sm"></i>
              <span>${booksCount}/2 livros</span>
            </div>
          </div>

          <div class="p-2 rounded-xl bg-stone-900 border border-stone-800/80">
            <span class="text-[10px] text-stone-500 block uppercase font-bold">Vetos / Votos</span>
            <div class="flex items-center gap-1.5 mt-0.5 font-semibold ${votesDone ? 'text-emerald-400' : 'text-stone-500'}">
              <i class="ph ph-check-square-offset text-sm"></i>
              <span>${votesCast}/${othersCount} votados</span>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-1.5 pt-2 border-t border-stone-800/80">
          <button onclick="adminImpersonateMember('${m.id}')" class="flex-1 py-1.5 px-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center justify-center gap-1 transition">
            <i class="ph ph-user-switch text-sm text-amber-400"></i>
            <span>Assumir</span>
          </button>

          <button onclick="adminClearMemberBooks('${m.id}')" title="Limpa as indicações deste membro" class="py-1.5 px-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs font-medium flex items-center gap-1 transition">
            <i class="ph ph-eraser text-sm"></i>
            <span>Zerar Livros</span>
          </button>

          <button onclick="adminClearMemberVotes('${m.id}')" title="Limpa os votos emitidos por este membro" class="py-1.5 px-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs font-medium flex items-center gap-1 transition">
            <i class="ph ph-arrow-counter-clockwise text-sm"></i>
            <span>Zerar Votos</span>
          </button>

          <button onclick="adminRemoveMember('${m.id}')" title="Excluir este membro do clube" class="py-1.5 px-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-300 text-xs font-semibold flex items-center gap-1 transition">
            <i class="ph ph-trash text-sm"></i>
            <span>Remover</span>
          </button>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

// Ações do Gerenciamento de Membros
function adminPromptAddMember() {
  openPromptModal('Nome do novo integrante:', '', async (newName) => {
    if (!newName || !newName.trim()) return;
    const trimmed = newName.trim();
    const newId = 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    const newMember = { id: newId, name: trimmed, book1: null, book2: null };

    if (!window.clubState.members) window.clubState.members = [];
    window.clubState.members.push(newMember);

    if (!window.clubState.votes) window.clubState.votes = {};
    if (!window.clubState.votes[newId]) window.clubState.votes[newId] = {};

    invalidateRenderCache();
    await persistState('state.members');
    renderAdminCurrentTab();
    showToast(`Membro "${trimmed}" adicionado!`, 'success');
  });
}

function adminRenameMember(memberId) {
  const member = window.clubState?.members?.find(m => m.id === memberId);
  if (!member) return;

  openPromptModal(`Novo nome para "${member.name}":`, member.name, async (newName) => {
    if (!newName || !newName.trim()) return;
    member.name = newName.trim();

    // Se o vencedor atual era deste membro, atualiza o nome
    if (window.clubState.winner && window.clubState.winner.member) {
      const oldMemName = window.clubState.winner.member;
      if (oldMemName === member.name) {
        window.clubState.winner.member = member.name;
      }
    }

    invalidateRenderCache();
    await persistState('state.members');
    renderAdminCurrentTab();
    if (typeof window.renderUI === 'function') window.renderUI();
    showToast(`Membro renomeado para "${member.name}".`, 'success');
  });
}

function adminImpersonateMember(memberId) {
  const member = window.clubState?.members?.find(m => m.id === memberId);
  if (!member) return;

  selectActiveMember(memberId, true);
  renderAdminCurrentTab();
  showToast(`Você agora está operando como "${member.name}"!`, 'info');
}

function adminClearCurrentDeviceLock() {
  clearLockedUserId();
  window.localCurrentUser = null;
  invalidateRenderCache();
  if (typeof window.renderUI === 'function') window.renderUI();
  renderAdminCurrentTab();
  showToast('Vínculo de aparelho removido com sucesso!', 'info');
}

async function adminClearMemberBooks(memberId) {
  const member = window.clubState?.members?.find(m => m.id === memberId);
  if (!member) return;

  if (!confirm(`Deseja realmente apagar as indicações de "${member.name}"?`)) return;

  member.book1 = null;
  member.book2 = null;
  invalidateRenderCache();
  await persistState('state.members');
  renderAdminCurrentTab();
  if (typeof window.renderUI === 'function') window.renderUI();
  showToast(`Indicações de "${member.name}" foram zeradas.`, 'info');
}

async function adminClearMemberVotes(memberId) {
  const member = window.clubState?.members?.find(m => m.id === memberId);
  if (!member) return;

  if (!confirm(`Deseja zerar os votos emitidos por "${member.name}"?`)) return;

  if (window.clubState.votes && window.clubState.votes[memberId]) {
    delete window.clubState.votes[memberId];
  }

  invalidateRenderCache();
  await persistState('state.votes');
  renderAdminCurrentTab();
  if (typeof window.renderUI === 'function') window.renderUI();
  showToast(`Votos de "${member.name}" foram zerados.`, 'info');
}

async function adminRemoveMember(memberId) {
  const member = window.clubState?.members?.find(m => m.id === memberId);
  if (!member) return;

  if (!confirm(`Remover "${member.name}" do clube? Todas as suas indicações e votos associados serão excluídos.`)) return;

  window.clubState.members = window.clubState.members.filter(m => m.id !== memberId);

  // Limpa votos feitos por ele
  if (window.clubState.votes) {
    delete window.clubState.votes[memberId];
    // Limpa votos dados a ele
    Object.keys(window.clubState.votes).forEach(vId => {
      if (window.clubState.votes[vId]) {
        delete window.clubState.votes[vId][memberId];
      }
    });
  }

  if (window.localCurrentUser === memberId) {
    window.localCurrentUser = null;
    clearLockedUserId();
  }

  invalidateRenderCache();
  await persistState();
  renderAdminCurrentTab();
  if (typeof window.renderUI === 'function') window.renderUI();
  showToast(`"${member.name}" foi removido(a) da sala.`, 'info');
}

// ==========================================
// TAB 2: CONTROLE DE INDICAÇÕES
// ==========================================
function renderAdminNominationsTab(container) {
  const members = window.clubState?.members || [];
  let totalBooks = 0;
  members.forEach(m => {
    if (m.book1) totalBooks++;
    if (m.book2) totalBooks++;
  });

  let html = `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-800">
      <div>
        <h4 class="text-sm font-bold text-stone-200 flex items-center gap-2">
          <i class="ph ph-books text-amber-400 text-base"></i>
          <span>Indicações Registradas (${totalBooks} livros)</span>
        </h4>
        <p class="text-xs text-stone-400 mt-0.5">Visualize e controle os livros indicados pelos membros nesta rodada.</p>
      </div>
      <div>
        <button onclick="adminClearAllNominations()" class="px-3 py-2 rounded-xl bg-stone-800 hover:bg-rose-950/40 text-stone-300 hover:text-rose-400 font-bold text-xs flex items-center gap-1.5 transition border border-stone-700">
          <i class="ph ph-eraser text-sm"></i>
          <span>Limpar TODAS as Indicações</span>
        </button>
      </div>
    </div>
  `;

  if (members.length === 0) {
    html += `
      <div class="text-center py-12 text-stone-500 bg-stone-950/40 rounded-2xl border border-stone-800/80">
        <p class="text-sm">Nenhum membro cadastrado.</p>
      </div>
    `;
    container.innerHTML = html;
    return;
  }

  html += `<div class="space-y-4">`;

  members.forEach(m => {
    html += `
      <div class="p-4 rounded-2xl bg-stone-950/60 border border-stone-800 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm text-stone-200">${escapeHtml(m.name)}</span>
            <span class="text-xs text-stone-500 font-mono">(${(m.book1 ? 1 : 0) + (m.book2 ? 1 : 0)}/2)</span>
          </div>
          <button onclick="adminClearMemberBooks('${m.id}')" class="text-xs text-stone-500 hover:text-rose-400 transition flex items-center gap-1">
            <i class="ph ph-trash-simple text-xs"></i>
            <span>Limpar Livros</span>
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- Livro 1 -->
          ${renderAdminBookCard(m, 1, m.book1)}
          <!-- Livro 2 -->
          ${renderAdminBookCard(m, 2, m.book2)}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function renderAdminBookCard(member, slot, book) {
  const bookKey = slot === 1 ? 'book1' : 'book2';
  if (!book) {
    return `
      <div class="p-3 rounded-xl bg-stone-900 border border-dashed border-stone-800 text-stone-600 flex items-center gap-3">
        <div class="w-10 aspect-[2/3] rounded-lg bg-stone-950 border border-stone-800 flex items-center justify-center text-stone-700 text-xs font-mono shrink-0">
          #${slot}
        </div>
        <div class="min-w-0">
          <span class="text-[11px] font-bold text-stone-500 block">Opção ${slot}</span>
          <span class="text-xs text-stone-600 italic">Pendente / não indicado</span>
        </div>
      </div>
    `;
  }

  const coverUrl = book.cover || (typeof DEFAULT_BOOK_COVER !== 'undefined' ? DEFAULT_BOOK_COVER : '');

  return `
    <div class="p-3 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <img src="${escapeHtml(coverUrl)}" alt="Capa" class="w-10 aspect-[2/3] object-cover rounded-lg bg-stone-950 border border-stone-800 shrink-0 book-cover" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 60%22><rect width=%2240%22 height=%2260%22 fill=%22%23262626%22/></svg>';">
        <div class="min-w-0">
          <span class="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 block">Opção ${slot}</span>
          <h6 class="font-bold text-xs text-stone-100 truncate">${escapeHtml(book.title || 'Sem título')}</h6>
          <p class="text-[11px] text-stone-400 truncate">${escapeHtml(book.author || 'Autor desconhecido')}</p>
        </div>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button onclick="adminEditBook('${member.id}', '${bookKey}')" title="Editar dados do livro" class="p-1.5 rounded-lg bg-stone-800 hover:bg-amber-900/40 text-stone-400 hover:text-amber-400 transition">
          <i class="ph ph-pencil-simple text-xs"></i>
        </button>
        <button onclick="adminClearSingleBook('${member.id}', ${slot})" title="Remover apenas este livro" class="p-1.5 rounded-lg bg-stone-800 hover:bg-rose-950/60 text-stone-400 hover:text-rose-400 transition">
          <i class="ph ph-x text-xs"></i>
        </button>
      </div>
    </div>
  `;
}

async function adminClearSingleBook(memberId, slot) {
  const member = window.clubState?.members?.find(m => m.id === memberId);
  if (!member) return;

  if (slot === 1) member.book1 = null;
  if (slot === 2) member.book2 = null;

  invalidateRenderCache();
  await persistState('state.members');
  renderAdminCurrentTab();
  if (typeof window.renderUI === 'function') window.renderUI();
  showToast(`Opção ${slot} de "${member.name}" removida.`, 'info');
}

async function adminClearAllNominations() {
  const members = window.clubState?.members || [];
  if (members.length === 0) return;

  if (!confirm('ATENÇÃO: Deseja apagar as indicações de TODOS os membros desta rodada?')) return;

  members.forEach(m => {
    m.book1 = null;
    m.book2 = null;
  });

  invalidateRenderCache();
  await persistState('state.members');
  renderAdminCurrentTab();
  if (typeof window.renderUI === 'function') window.renderUI();
  showToast('Todas as indicações da rodada foram apagadas.', 'info');
}

// ==========================================
// TAB 3: CONTROLE DE VOTOS (MATRIZ DE VETOS)
// ==========================================
function renderAdminVotesTab(container) {
  const members = window.clubState?.members || [];
  const votes = window.clubState?.votes || {};
  const othersCount = members.length > 1 ? members.length - 1 : 0;

  let votersFinished = 0;
  members.forEach(m => {
    const count = Object.keys(votes[m.id] || {}).length;
    if (othersCount > 0 && count >= othersCount) votersFinished++;
  });

  let html = `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-800">
      <div>
        <h4 class="text-sm font-bold text-stone-200 flex items-center gap-2">
          <i class="ph ph-check-square-offset text-amber-400 text-base"></i>
          <span>Matriz de Votos & Vetos (${votersFinished}/${members.length} concluídos)</span>
        </h4>
        <p class="text-xs text-stone-400 mt-0.5">Visualize em detalhes quem vetou qual livro de cada integrante.</p>
      </div>
      <div>
        <button onclick="adminClearAllVotes()" class="px-3 py-2 rounded-xl bg-stone-800 hover:bg-rose-950/40 text-stone-300 hover:text-rose-400 font-bold text-xs flex items-center gap-1.5 transition border border-stone-700">
          <i class="ph ph-arrow-counter-clockwise text-sm"></i>
          <span>Limpar TODOS os Votos</span>
        </button>
      </div>
    </div>
  `;

  if (members.length === 0) {
    html += `
      <div class="text-center py-12 text-stone-500 bg-stone-950/40 rounded-2xl border border-stone-800/80">
        <p class="text-sm">Nenhum membro cadastrado.</p>
      </div>
    `;
    container.innerHTML = html;
    return;
  }

  html += `<div class="space-y-4">`;

  members.forEach(voter => {
    const voterVetoes = votes[voter.id] || {};
    const vetoKeys = Object.keys(voterVetoes);
    const isComplete = othersCount > 0 && vetoKeys.length >= othersCount;

    html += `
      <div class="p-4 rounded-2xl bg-stone-950/60 border border-stone-800 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-lg bg-stone-800 text-amber-400 font-bold text-xs flex items-center justify-center">
              ${escapeHtml(voter.name.substring(0, 2).toUpperCase())}
            </div>
            <div>
              <span class="font-bold text-xs text-stone-200">${escapeHtml(voter.name)}</span>
              <span class="text-[10px] ml-1.5 px-2 py-0.5 rounded-full font-semibold ${isComplete ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-stone-800 text-stone-400'}">
                ${isComplete ? 'Votação Concluída' : `${vetoKeys.length}/${othersCount} vetos`}
              </span>
            </div>
          </div>
          ${vetoKeys.length > 0 ? `
            <button onclick="adminClearMemberVotes('${voter.id}')" class="text-xs text-stone-500 hover:text-rose-400 transition flex items-center gap-1">
              <i class="ph ph-trash-simple text-xs"></i>
              <span>Zerar Votos</span>
            </button>
          ` : '<span class="text-[11px] text-stone-600 italic">Nenhum voto</span>'}
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
    `;

    // Renderiza o veto para cada outro membro
    const otherMembers = members.filter(m => m.id !== voter.id);
    if (otherMembers.length === 0) {
      html += `<div class="col-span-full text-xs text-stone-600 py-1">Aguardando mais membros para poder votar.</div>`;
    } else {
      otherMembers.forEach(target => {
        const vetoedSlot = voterVetoes[target.id]; // 1 ou 2
        const targetBook = vetoedSlot === 1 ? target.book1 : (vetoedSlot === 2 ? target.book2 : null);

        html += `
          <div class="p-2.5 rounded-xl bg-stone-900 border border-stone-800/90 flex items-center justify-between text-xs">
            <div class="min-w-0 pr-2">
              <span class="text-[10px] text-stone-500 block truncate">Veto para: <strong>${escapeHtml(target.name)}</strong></span>
              ${vetoedSlot ? `
                <span class="font-bold text-rose-400 flex items-center gap-1 truncate mt-0.5">
                  <i class="ph ph-prohibit text-xs"></i>
                  <span>Opção ${vetoedSlot}: ${escapeHtml(targetBook?.title || 'Sem título')}</span>
                </span>
              ` : `
                <span class="text-stone-500 italic text-[11px] mt-0.5 block">Não votou ainda</span>
              `}
            </div>
          </div>
        `;
      });
    }

    html += `
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

async function adminClearAllVotes() {
  if (!confirm('ATENÇÃO: Deseja apagar TODOS os votos desta rodada?')) return;

  window.clubState.votes = {};
  invalidateRenderCache();
  await persistState('state.votes');
  renderAdminCurrentTab();
  if (typeof window.renderUI === 'function') window.renderUI();
  showToast('Todos os votos foram apagados.', 'info');
}

// ==========================================
// TAB 4: BACKUP & RESTAURAÇÃO
// ==========================================
function renderAdminBackupTab(container) {
  const membersCount = window.clubState?.members?.length || 0;
  const historyCount = window.clubState?.history?.length || 0;
  const updatedAt = window.clubState?.updatedAt ? new Date(window.clubState.updatedAt).toLocaleString('pt-BR') : 'Nunca';

  container.innerHTML = `
    <div class="space-y-6">
      <div class="pb-4 border-b border-stone-800">
        <h4 class="text-sm font-bold text-stone-200 flex items-center gap-2">
          <i class="ph ph-floppy-disk text-amber-400 text-base"></i>
          <span>Backup e Restauração de Dados</span>
        </h4>
        <p class="text-xs text-stone-400 mt-0.5">Exporte o estado integral da sala para arquivo local ou restaure a partir de um JSON anterior.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Exportar -->
        <div class="p-5 rounded-2xl bg-stone-950/60 border border-stone-800 flex flex-col justify-between space-y-4">
          <div>
            <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center text-xl mb-3">
              <i class="ph ph-download-simple"></i>
            </div>
            <h5 class="font-bold text-sm text-stone-100">Exportar Backup (.json)</h5>
            <p class="text-xs text-stone-400 mt-1 leading-relaxed">
              Gera um arquivo JSON completo contendo todos os integrantes, indicações, votos, histórico de sorteios e vencedores desta sala.
            </p>
            <div class="mt-3 text-[11px] font-mono text-stone-500 space-y-1">
              <div>Membros: <span class="text-stone-300 font-bold">${membersCount}</span></div>
              <div>Histórico: <span class="text-stone-300 font-bold">${historyCount} livros</span></div>
              <div>Última alteração: <span class="text-stone-300">${updatedAt}</span></div>
            </div>
          </div>
          <button onclick="adminExportJSON()" class="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs">
            <i class="ph ph-file-arrow-down text-base"></i>
            <span>Baixar Arquivo JSON</span>
          </button>
        </div>

        <!-- Importar -->
        <div class="p-5 rounded-2xl bg-stone-950/60 border border-stone-800 flex flex-col justify-between space-y-4">
          <div>
            <div class="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center text-xl mb-3">
              <i class="ph ph-upload-simple"></i>
            </div>
            <h5 class="font-bold text-sm text-stone-100">Restaurar Backup</h5>
            <p class="text-xs text-stone-400 mt-1 leading-relaxed">
              Carrega os dados de um arquivo JSON anteriormente salvo. 
              <span class="text-amber-400 font-medium">Os dados atuais da sala serão substituídos após confirmação.</span>
            </p>
          </div>
          <div class="space-y-2">
            <input type="file" id="adminImportFileInput" accept=".json" class="hidden" onchange="adminHandleFileImport(event)">
            <button onclick="document.getElementById('adminImportFileInput').click()" class="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center justify-center gap-2 transition border border-stone-700">
              <i class="ph ph-file-arrow-up text-base text-sky-400"></i>
              <span>Selecionar Arquivo de Backup</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function adminExportJSON() {
  const exportPayload = {
    roomId: window.currentRoomId,
    exportedAt: new Date().toISOString(),
    version: 'v5.3-stable',
    state: window.clubState
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
  const dateSuffix = new Date().toISOString().slice(0, 10);
  const fileName = `clube-do-livro-${window.currentRoomId || 'sala'}-${dateSuffix}.json`;

  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', fileName);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  showToast('Backup exportado com sucesso!', 'success');
}

function adminHandleFileImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target.result;
      const parsed = JSON.parse(content);
      const incomingState = parsed.state || parsed;

      if (!incomingState || !Array.isArray(incomingState.members)) {
        alert('Formato de backup inválido: não foi possível encontrar a lista de membros no JSON.');
        return;
      }

      const count = incomingState.members.length;
      if (!confirm(`Confirmar restauração de backup com ${count} membros? Isso irá sobrescrever o estado atual da sala no Firestore.`)) {
        return;
      }

      window.clubState = {
        ...window.clubState,
        ...incomingState,
        updatedAt: Date.now()
      };
      delete window.clubState.stage; // Stage permanece local

      invalidateRenderCache();
      await persistState();
      renderAdminCurrentTab();
      if (typeof window.renderUI === 'function') window.renderUI();
      showToast('Dados restaurados com sucesso do backup!', 'success');
    } catch (err) {
      console.error('[Admin] Erro na importação:', err);
      alert('Erro ao processar o arquivo JSON. Certifique-se de que é um arquivo válido.');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

// ==========================================
// TAB 5: PRESENÇA & DIAGNÓSTICO
// ==========================================
function renderAdminPresenceTab(container) {
  const members = window.clubState?.members || [];
  const presence = window.clubState?.presence || {};
  const drawLogs = window.clubState?.drawLogs || [];
  const now = Date.now();

  let html = `
    <div class="space-y-6">
      <div class="pb-4 border-b border-stone-800">
        <h4 class="text-sm font-bold text-stone-200 flex items-center gap-2">
          <i class="ph ph-activity text-amber-400 text-base"></i>
          <span>Presença em Tempo Real & Diagnóstico</span>
        </h4>
        <p class="text-xs text-stone-400 mt-0.5">Status de conexão dos integrantes e dados técnicos da sala.</p>
      </div>

      <!-- Tabela de Presença -->
      <div class="p-4 rounded-2xl bg-stone-950/60 border border-stone-800 space-y-3">
        <h5 class="text-xs font-bold uppercase tracking-wider text-stone-400">Presença dos Membros</h5>
        <div class="divide-y divide-stone-800/80">
  `;

  if (members.length === 0) {
    html += `<div class="py-3 text-xs text-stone-500">Nenhum membro na sala.</div>`;
  } else {
    members.forEach(m => {
      const lastSeen = presence[m.id];
      let statusText = 'Nunca visto';
      let statusColor = 'bg-stone-600';
      let statusTextColor = 'text-stone-500';

      if (lastSeen) {
        const diffSec = Math.floor((now - lastSeen) / 1000);
        if (diffSec < 20) {
          statusText = 'Online agora';
          statusColor = 'bg-emerald-500 animate-pulse';
          statusTextColor = 'text-emerald-400';
        } else if (diffSec < 120) {
          statusText = `Visto há ${diffSec}s`;
          statusColor = 'bg-emerald-400';
          statusTextColor = 'text-stone-300';
        } else if (diffSec < 3600) {
          const mins = Math.floor(diffSec / 60);
          statusText = `Visto há ${mins} min`;
          statusColor = 'bg-amber-500';
          statusTextColor = 'text-stone-400';
        } else {
          const hours = Math.floor(diffSec / 3600);
          statusText = `Visto há ${hours}h`;
          statusColor = 'bg-stone-600';
          statusTextColor = 'text-stone-500';
        }
      }

      html += `
        <div class="py-2.5 flex items-center justify-between text-xs">
          <div class="flex items-center gap-2.5">
            <span class="w-2.5 h-2.5 rounded-full ${statusColor}"></span>
            <span class="font-semibold text-stone-200">${escapeHtml(m.name)}</span>
            <span class="text-[11px] font-mono text-stone-500">(${escapeHtml(m.id)})</span>
          </div>
          <span class="${statusTextColor} text-[11px] font-medium">${statusText}</span>
        </div>
      `;
    });
  }

  html += `
        </div>
      </div>

      <!-- Info Técnica da Sala -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div class="p-3.5 rounded-xl bg-stone-950/60 border border-stone-800">
          <span class="text-[10px] text-stone-500 uppercase font-bold block">Código da Sala</span>
          <span class="font-mono font-bold text-amber-400 text-sm mt-0.5 block">${escapeHtml(window.currentRoomId || '-')}</span>
        </div>

        <div class="p-3.5 rounded-xl bg-stone-950/60 border border-stone-800">
          <span class="text-[10px] text-stone-500 uppercase font-bold block">Última Sincronização</span>
          <span class="font-semibold text-stone-200 text-xs mt-0.5 block">
            ${window.clubState?.updatedAt ? new Date(window.clubState.updatedAt).toLocaleTimeString('pt-BR') : '-'}
          </span>
        </div>

        <div class="p-3.5 rounded-xl bg-stone-950/60 border border-stone-800">
          <span class="text-[10px] text-stone-500 uppercase font-bold block">Livros no Histórico</span>
          <span class="font-bold text-stone-200 text-sm mt-0.5 block">${window.clubState?.history?.length || 0} arquivados</span>
        </div>

        <div class="p-3.5 rounded-xl bg-stone-950/60 border border-stone-800">
          <span class="text-[10px] text-stone-500 uppercase font-bold block">Vencedor Atual</span>
          <span class="font-bold text-stone-200 text-xs truncate mt-0.5 block">
            ${window.clubState?.winner?.book?.title ? escapeHtml(window.clubState.winner.book.title) : 'Nenhum'}
          </span>
        </div>
      </div>

      <!-- Logs de Sorteio -->
      <div class="p-4 rounded-2xl bg-stone-950/60 border border-stone-800 space-y-3">
        <div class="flex items-center justify-between">
          <h5 class="text-xs font-bold uppercase tracking-wider text-stone-400">Logs de Sorteio Registrados (${drawLogs.length})</h5>
          ${drawLogs.length > 0 ? `
            <button onclick="adminClearDrawLogs()" class="text-xs text-stone-500 hover:text-rose-400 transition">
              Limpar Logs
            </button>
          ` : ''}
        </div>
        <div class="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar-dark font-mono text-[11px] text-stone-400 bg-stone-900/60 p-3 rounded-xl border border-stone-800/80">
          ${drawLogs.length === 0 ? '<div class="text-stone-600">Nenhum log registrado.</div>' : 
            drawLogs.map(l => `<div class="truncate border-b border-stone-800/40 pb-1 mb-1 last:border-0">${escapeHtml(typeof l === 'string' ? l : JSON.stringify(l))}</div>`).join('')
          }
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

async function adminClearDrawLogs() {
  if (!confirm('Deseja limpar todos os logs de sorteio?')) return;
  window.clubState.drawLogs = [];
  invalidateRenderCache();
  await persistState('state.drawLogs');
  renderAdminCurrentTab();
  showToast('Logs de sorteio limpos.', 'info');
}

// ==========================================
// TAB 6: DANGER ZONE
// ==========================================
function renderAdminDangerTab(container) {
  const cycle = window.clubState.closedCycle || { enabled: false, winners: [] };
  const members = window.clubState.members || [];
  const champNames = (cycle.winners || []).map(id => {
    const m = members.find(mem => mem.id === id);
    return m ? m.name : id;
  });

  container.innerHTML = `
    <div class="space-y-6">
      <div class="pb-4 border-b border-rose-900/40">
        <h4 class="text-sm font-bold text-rose-300 flex items-center gap-2">
          <i class="ph ph-warning-octagon text-rose-400 text-base"></i>
          <span>Zona de Perigo (Danger Zone)</span>
        </h4>
        <p class="text-xs text-stone-400 mt-0.5">Ações com impacto destrutivo ou reset amplo de dados. Execute com cautela.</p>
      </div>

      <div class="space-y-4">
        <!-- Ciclo Fechado -->
        <div class="p-4 rounded-2xl bg-stone-950/80 border border-amber-800/40 space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h5 class="font-bold text-xs text-amber-300 flex items-center gap-1.5"><i class="ph ph-circle-notch"></i> Ciclo Fechado (Campeão Vira Jurado)</h5>
              <p class="text-[11px] text-stone-400 mt-0.5 max-w-lg">
                Quando ativado, quem já venceu o sorteio sai da roleta nos meses seguintes, até que todos tenham vencido uma vez.
              </p>
            </div>
            <button onclick="adminToggleClosedCycle()" class="px-4 py-2 rounded-xl ${cycle.enabled ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40' : 'bg-stone-800 text-stone-400 border border-stone-700'} font-bold text-xs transition shrink-0">
              ${cycle.enabled ? '✓ Ativado' : '○ Desativado'}
            </button>
          </div>
          ${cycle.enabled ? `
            <div class="pt-2 border-t border-stone-800">
              <p class="text-[11px] text-stone-400 mb-2">Campeões do ciclo atual (${champNames.length}/${members.length}):</p>
              <div class="flex flex-wrap gap-1.5 mb-3">
                ${champNames.length > 0 ? champNames.map(n => `<span class="text-[10px] font-bold bg-gold/20 text-gold px-2 py-0.5 rounded-full">🏆 ${escapeHtml(n)}</span>`).join('') : '<span class="text-[10px] text-stone-600 italic">Nenhum campeão ainda</span>'}
              </div>
              <div class="flex flex-wrap gap-2">
                <button onclick="adminResetClosedCycle()" class="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition">
                  <i class="ph ph-arrow-counter-clockwise text-xs"></i> Reiniciar Ciclo
                </button>
                <button onclick="adminInitCycleFromHistory()" class="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition">
                  <i class="ph ph-clock-counter-clockwise text-xs"></i> Importar do Histórico
                </button>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Resetar Rodada -->
        <div class="p-4 rounded-2xl bg-stone-950/80 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h5 class="font-bold text-xs text-stone-200">Resetar Rodada Atual</h5>
            <p class="text-[11px] text-stone-400 mt-0.5 max-w-lg">
              Limpa todas as indicações, votos, vencedor sorteado e logs da rodada em andamento. <strong class="text-stone-300">Mantém a lista de integrantes e o histórico intactos.</strong>
            </p>
          </div>
          <button onclick="adminResetCurrentRound()" class="px-4 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 font-bold text-xs transition shrink-0">
            Resetar Rodada
          </button>
        </div>

        <!-- Limpar Histórico -->
        <div class="p-4 rounded-2xl bg-stone-950/80 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h5 class="font-bold text-xs text-stone-200">Limpar Histórico de Leituras</h5>
            <p class="text-[11px] text-stone-400 mt-0.5 max-w-lg">
              Apaga permanentemente todos os registros de livros lidos e sorteios passados arquivados nesta sala.
            </p>
          </div>
          <button onclick="adminClearHistory()" class="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-bold text-xs transition shrink-0">
            Apagar Histórico
          </button>
        </div>

        <!-- Alterar Senha Admin -->
        <div class="p-4 rounded-2xl bg-stone-950/80 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h5 class="font-bold text-xs text-stone-200">Alterar Senha do Administrador</h5>
            <p class="text-[11px] text-stone-400 mt-0.5 max-w-lg">
              Redefina a senha necessária para acessar este painel de administração da sala.
            </p>
          </div>
          <button onclick="promptChangeAdminPassword()" class="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs transition shrink-0">
            Trocar Senha
          </button>
        </div>

        <!-- Deletar Sala Inteira -->
        <div class="p-4 rounded-2xl bg-rose-950/30 border border-rose-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h5 class="font-bold text-xs text-rose-300">Excluir Sala do Firestore</h5>
            <p class="text-[11px] text-rose-400/80 mt-0.5 max-w-lg">
              Remove permanentemente o documento da sala <strong class="text-rose-200 font-mono">${escapeHtml(window.currentRoomId || '')}</strong> do Firebase. Todos os membros perderão o acesso imediatamente.
            </p>
          </div>
          <button onclick="adminDeleteEntireRoom()" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shrink-0 shadow-sm shadow-rose-900/40">
            Excluir Sala Inteira
          </button>
        </div>
      </div>
    </div>
  `;
}

async function adminResetCurrentRound() {
  if (!confirm('Deseja resetar a rodada atual? As indicações, votos e vencedor serão apagados (membros e histórico serão preservados).')) {
    return;
  }

  const members = window.clubState?.members || [];
  members.forEach(m => {
    m.book1 = null;
    m.book2 = null;
  });

  window.clubState.votes = {};
  window.clubState.winner = null;
  window.clubState.drawEvent = null;
  window.clubState.drawLogs = [];
  window.localStage = 'nominations';
  localStorage.setItem('clubeDoLivro_localStage', 'nominations');

  invalidateRenderCache();
  await persistState();
  renderAdminCurrentTab();
  if (typeof window.renderUI === 'function') window.renderUI();
  showToast('Rodada resetada com sucesso.', 'info');
}

async function adminClearHistory() {
  if (!confirm('ATENÇÃO: Deseja apagar TODOS os registros do histórico de leituras desta sala? Esta ação não pode ser desfeita.')) {
    return;
  }

  window.clubState.history = [];
  invalidateRenderCache();
  await persistState('state.history');
  renderAdminCurrentTab();
  if (typeof window.renderUI === 'function') window.renderUI();
  showToast('Histórico de leituras apagado.', 'info');
}

async function adminDeleteEntireRoom() {
  const roomId = window.currentRoomId;
  if (!roomId) return;

  const confirmation = prompt(`DIGITE "${roomId}" PARA CONFIRMAR A EXCLUSÃO PERMANENTE DA SALA:`);
  if (!confirmation || confirmation.trim().toUpperCase() !== roomId.toUpperCase()) {
    showToast('Exclusão cancelada (código não correspondeu).', 'info');
    return;
  }

  try {
    await db.collection('clubes').doc(roomId).delete();
    clearLockedUserId();
    window.currentRoomId = null;
    window.location.href = window.location.pathname;
  } catch (err) {
    console.error('[Admin] Erro ao deletar sala:', err);
    showToast('Erro ao excluir sala no Firebase.', 'danger');
  }
}

// ==========================================
// ADMIN: EDIÇÃO DE LIVRO
// ==========================================
function adminEditBook(memberId, bookKey) {
  const member = window.clubState?.members?.find(m => m.id === memberId);
  if (!member || !member[bookKey]) return showToast('Livro não encontrado.', 'warning');

  const book = member[bookKey];
  // Fecha o painel admin temporariamente e abre o editor de livro
  closeAdminModal();
  openBookEditPreview(book, memberId, bookKey);
}

// ==========================================
// ADMIN: CICLO FECHADO
// ==========================================
async function adminToggleClosedCycle() {
  if (!window.clubState.closedCycle) {
    window.clubState.closedCycle = { enabled: true, winners: [] };
  }
  window.clubState.closedCycle.enabled = !window.clubState.closedCycle.enabled;
  
  invalidateRenderCache();
  await persistState('state.closedCycle');
  renderAdminCurrentTab();
  if (typeof window.renderUI === 'function') window.renderUI();
  showToast(`Ciclo Fechado ${window.clubState.closedCycle.enabled ? 'ativado' : 'desativado'}.`, 'success');
}

async function adminResetClosedCycle() {
  if (!confirm('Deseja reiniciar o Ciclo Fechado? Todos voltarão a participar da roleta.')) return;
  if (!window.clubState.closedCycle) window.clubState.closedCycle = { enabled: true, winners: [] };
  window.clubState.closedCycle.winners = [];
  
  invalidateRenderCache();
  await persistState('state.closedCycle');
  renderAdminCurrentTab();
  if (typeof window.renderUI === 'function') window.renderUI();
  showToast('Ciclo reiniciado! Todos voltaram para a roleta.', 'success');
}

async function adminInitCycleFromHistory() {
  // Inicializar ciclo fechado a partir do histórico existente
  const history = window.clubState.history || [];
  const members = window.clubState.members || [];
  
  if (!window.clubState.closedCycle) window.clubState.closedCycle = { enabled: true, winners: [] };
  window.clubState.closedCycle.winners = [];

  // Pega os vencedores mais recentes do histórico até completar um ciclo
  for (const h of history) {
    if (window.clubState.closedCycle.winners.length >= members.length) break;
    const winnerMember = members.find(m => m.name === h.winner?.member);
    if (winnerMember && !window.clubState.closedCycle.winners.includes(winnerMember.id)) {
      window.clubState.closedCycle.winners.push(winnerMember.id);
    }
  }

  invalidateRenderCache();
  await persistState('state.closedCycle');
  renderAdminCurrentTab();
  if (typeof window.renderUI === 'function') window.renderUI();
  showToast(`Ciclo inicializado com ${window.clubState.closedCycle.winners.length} campeão(ões) do histórico.`, 'success');
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  initAdminBadgeTrigger();
});

