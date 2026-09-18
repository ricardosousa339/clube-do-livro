// ==========================================
// INDICAÇÕES — Grid, Book Slots, Busca de Livros
// ==========================================

function renderNominationsGrid() {
  const grid = document.getElementById('membersGrid');
  if (!grid) return;
  let completedCount = 0;
  window.clubState.members.forEach(m => { if (m.book1 && m.book2) completedCount++; });
  const me = window.clubState.members.find(m => m.id === window.localCurrentUser);
  const others = window.clubState.members.filter(m => m.id !== window.localCurrentUser);

  const signature = JSON.stringify({
    meId: me?.id,
    meName: me?.name,
    meB1: me?.book1 ? `${me.book1.title}|${me.book1.cover}` : null,
    meB2: me?.book2 ? `${me.book2.title}|${me.book2.cover}` : null,
    isEditing: window.isEditingBooks,
    completedCount,
    total: window.clubState.members.length,
    others: others.map(o => `${o.id}:${o.name}:${Boolean(o.book1 && o.book2)}`)
  });

  const counterBadge = document.getElementById('nominationCounterBadge');
  if (counterBadge) counterBadge.innerText = `${completedCount} de ${window.clubState.members.length} membros concluídos`;

  if (_lastNominationsSignature === signature && grid.children.length > 0) {
    return; // Conteúdo idêntico: não destrói o DOM nem recria as capas
  }
  _lastNominationsSignature = signature;

  let html = '';

  if (me) {
    if (me.book1 && me.book2 && !window.isEditingBooks) {
       html += `
        <div class="bg-gradient-to-br from-emerald-50 to-[#F2F9F5] rounded-[2rem] p-6 sm:p-8 border border-emerald-200 shadow-lg text-center relative overflow-hidden mb-6">
          <div class="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div class="w-16 h-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto mb-4 shadow-md shadow-emerald-500/30"><i class="ph ph-check-circle text-3xl"></i></div>
          <h3 class="font-serif font-bold text-emerald-900 text-2xl mb-1">Tudo certo, ${escapeHtml(me.name)}!</h3>
          <p class="text-sm text-emerald-700 mb-8 max-w-md mx-auto">Suas opções foram salvas. Aguarde os outros colegas finalizarem.</p>
          <div class="flex flex-wrap items-center justify-center gap-6 mb-8">
            <div class="flex flex-col items-center"><span class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">1ª Opção</span><img src="${me.book1.cover || DEFAULT_BOOK_COVER}" class="w-20 h-28 object-cover rounded-xl shadow-sm border border-emerald-100 bg-white p-1" loading="lazy" decoding="async" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;"></div>
            <div class="flex flex-col items-center"><span class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">2ª Opção</span><img src="${me.book2.cover || DEFAULT_BOOK_COVER}" class="w-20 h-28 object-cover rounded-xl shadow-sm border border-emerald-100 bg-white p-1" loading="lazy" decoding="async" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;"></div>
          </div>
          <div class="bg-white/70 rounded-xl p-4 inline-block backdrop-blur-sm border border-emerald-100/50">
            <p class="text-xs font-bold text-stone-500 mb-3 uppercase tracking-wider">Status do Clube</p>
            <div class="flex items-center gap-3 text-sm">
              <div class="w-48 bg-stone-200 rounded-full h-2.5 overflow-hidden"><div class="bg-emerald-500 h-2.5 rounded-full transition-all duration-500" style="width: ${(completedCount / Math.max(1, window.clubState.members.length)) * 100}%"></div></div>
              <span class="font-bold text-stone-800">${completedCount}/${window.clubState.members.length} prontos</span>
            </div>
            ${(completedCount === window.clubState.members.length && window.clubState.members.length > 1) ? `<button onclick="proceedToVotingIfReady()" class="mt-5 px-6 py-2.5 rounded-xl bg-burgundy hover:bg-burgundyLight text-white font-bold text-xs shadow-md transition w-full flex items-center justify-center gap-2"><i class="ph ph-arrow-right text-base"></i> Avançar para Votação</button>` : `<p class="text-[11px] text-stone-500 mt-4 flex items-center justify-center gap-1.5"><i class="ph ph-spinner animate-spin text-emerald-600 text-sm"></i> Sincronizando e aguardando...</p>`}
          </div>
          <div class="mt-8"><button onclick="window.isEditingBooks = true; window.renderUI();" class="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline decoration-emerald-300 underline-offset-4 transition">Quero alterar minhas opções</button></div>
        </div>`;
    } else {
      html += `
        <div class="bg-white rounded-[2rem] p-6 sm:p-8 border-2 border-burgundy/20 ring-4 ring-burgundy/5 shadow-xl relative overflow-hidden mb-6">
          <div class="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-burgundy/5 to-transparent rounded-bl-full pointer-events-none"></div>
          <div class="flex flex-wrap items-center justify-between gap-4 mb-8 relative z-10">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-2xl bg-burgundy text-gold flex items-center justify-center font-bold text-2xl shadow-inner">${escapeHtml(me.name.substring(0, 2).toUpperCase())}</div>
              <div><h3 class="font-serif font-bold text-stone-900 text-2xl flex items-center gap-2">${escapeHtml(me.name)}<span class="text-[10px] bg-burgundy/10 text-burgundy font-extrabold px-2 py-1 rounded-full uppercase tracking-wider">Seu Painel</span></h3><p class="text-sm text-stone-500 mt-1">Busque e defina as obras que você quer levar.</p></div>
            </div>
            <div class="flex items-center gap-2">
              ${me.book1 && me.book2 ? `<button onclick="window.isEditingBooks = false; window.renderUI();" class="text-xs font-bold px-4 py-2 rounded-xl bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition">Concluir Revisão</button>` : ''}
              <button onclick="openEditMemberNameModal('${me.id}', '${escapeHtml(me.name)}')" class="text-sm text-stone-500 hover:text-burgundy flex items-center gap-1.5 px-4 py-2 rounded-xl hover:bg-stone-50 border border-transparent hover:border-stone-200 transition bg-white"><i class="ph ph-pencil-simple"></i> Editar Meu Nome</button>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
            ${renderBigBookSlot(me, 'book1', '1ª Opção (Prioridade)')}
            ${renderBigBookSlot(me, 'book2', '2ª Opção (Alternativa)')}
          </div>
        </div>
      `;
    }
  }

  if (others.length > 0) {
    html += `
      <div>
        <h4 class="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4 px-2 flex items-center gap-2"><i class="ph ph-users-three text-lg"></i> Status dos Colegas</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          ${others.map(m => {
            const isDone = m.book1 && m.book2;
            return `
              <div class="bg-white/70 rounded-2xl p-4 border border-stone-200/60 flex items-center justify-between group hover:bg-white hover:border-stone-300 transition shadow-sm hover:shadow">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-10 h-10 rounded-full ${isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-400'} flex items-center justify-center shrink-0 transition-colors"><i class="ph ${isDone ? 'ph-check-bold' : 'ph-hourglass-high'} text-lg"></i></div>
                  <div class="min-w-0"><h5 class="font-bold text-sm text-stone-800 truncate">${escapeHtml(m.name)}</h5><p class="text-[10px] uppercase font-bold ${isDone ? 'text-emerald-600' : 'text-stone-400'}">${isDone ? 'Indicações Feitas' : 'Aguardando...'}</p></div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }
  grid.innerHTML = html;
}

function renderBigBookSlot(member, bookKey, label) {
  const book = member[bookKey];
  const isPriority = bookKey === 'book1';
  if (!book) {
    return `
      <div onclick="openBookSearchModal('${member.id}', '${bookKey}', '${label}')" class="group cursor-pointer rounded-[1.5rem] border-2 border-dashed border-stone-200 hover:border-burgundy/50 p-6 flex flex-col items-center justify-center text-center transition-all bg-stone-50/50 hover:bg-burgundy/5 min-h-[220px]">
        <div class="w-16 h-16 rounded-full bg-white group-hover:bg-burgundy group-hover:text-white text-stone-300 flex items-center justify-center mb-4 shadow-sm transition-all transform group-hover:scale-110"><i class="ph ph-plus text-2xl font-bold"></i></div>
        <span class="text-sm font-bold text-stone-700">${label}</span><span class="text-xs text-stone-400 mt-1">Toque para buscar e adicionar a sua obra</span>
      </div>`;
  }
  return `
    <div class="relative group rounded-[1.5rem] border border-stone-200 bg-[#FDFBF7] p-5 flex flex-col sm:flex-row gap-5 min-h-[220px] shadow-sm hover:shadow-md transition">
      <div class="w-28 h-40 sm:w-32 sm:h-48 shrink-0 rounded-xl overflow-hidden bg-stone-200 shadow-md relative mx-auto sm:mx-0">
        <img src="${book.cover || DEFAULT_BOOK_COVER}" class="w-full h-full object-cover" loading="lazy" decoding="async" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;">
        <div class="absolute top-2 left-2 px-2 py-1 rounded text-[10px] font-black ${isPriority ? 'bg-gold text-stone-900 shadow-sm' : 'bg-stone-800 text-white shadow-sm'}">${isPriority ? 'OPÇÃO 1' : 'OPÇÃO 2'}</div>
      </div>
      <div class="flex flex-col justify-between min-w-0 flex-1 text-center sm:text-left py-1">
        <div>
          <span class="text-[11px] font-extrabold uppercase tracking-widest ${isPriority ? 'text-amber-700' : 'text-stone-500'} block mb-1.5">${label}</span>
          <h4 class="font-serif font-bold text-lg sm:text-xl text-stone-900 line-clamp-2 leading-tight">${escapeHtml(book.title)}</h4>
          <p class="text-sm text-stone-500 mt-1 line-clamp-1">${escapeHtml(book.author || 'Autor não informado')}</p>
        </div>
        <div class="flex items-center justify-center sm:justify-start gap-2 mt-5">
          <button onclick="openBookSearchModal('${member.id}', '${bookKey}', '${label}')" class="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition"><i class="ph ph-swap"></i> Trocar Livro</button>
          <button onclick="removeBook('${member.id}', '${bookKey}')" title="Remover indicação" class="flex items-center justify-center p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition"><i class="ph ph-trash text-lg"></i></button>
        </div>
      </div>
    </div>`;
}

// ==========================================
// BUSCA DE LIVROS (Google Books + Open Library)
// ==========================================

var activeSearchContext = { memberId: null, bookKey: null };
var searchDebounceTimeout = null;
window.currentSearchResults = [];

function openBookSearchModal(memberId, bookKey, label) {
  activeSearchContext = { memberId, bookKey };
  document.getElementById('modalMemberTitle').innerText = `${getMemberName(memberId)} - ${label}`;
  document.getElementById('modalOptionBadge').innerText = bookKey === 'book1' ? 'Opção Principal' : 'Opção Reserva';
  document.getElementById('bookSearchInput').value = '';
  document.getElementById('searchResultsList').innerHTML = `<div class="text-center py-8 text-stone-400 text-xs">Busque sua obra pelo título ou autor...</div>`;
  document.getElementById('bookSearchModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('bookSearchInput').focus(), 50);
}
function closeBookSearchModal() { document.getElementById('bookSearchModal').classList.add('hidden'); }

function handleBookSearchInput(query) {
  clearTimeout(searchDebounceTimeout);
  const spinner = document.getElementById('searchSpinner');
  const list = document.getElementById('searchResultsList');

  if (!query || query.trim().length < 2) { 
    if (spinner) spinner.classList.add('hidden'); 
    if (list) list.innerHTML = `<div class="text-center py-8 text-stone-400 text-xs">Busque sua obra pelo título ou autor...</div>`;
    return; 
  }
  
  if (spinner) spinner.classList.remove('hidden');
  if (list) {
     list.innerHTML = `
       <div class="flex flex-col items-center justify-center py-10 opacity-70">
         <i class="ph ph-books text-4xl text-burgundy animate-bounce mb-2"></i>
         <p class="text-sm font-bold text-stone-500 animate-pulse">Buscando no acervo mundial...</p>
       </div>
     `;
  }

  searchDebounceTimeout = setTimeout(async () => { 
    await executeBookSearch(query.trim()); 
    if (spinner) spinner.classList.add('hidden'); 
  }, 800);
}

async function executeBookSearch(query) {
  const list = document.getElementById('searchResultsList');
  if (!list) return;
  try {
    let results = [];
    try {
      const gbResponse = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8`);
      if (gbResponse.ok) {
        const gbData = await gbResponse.json();
        if (gbData.items && gbData.items.length > 0) {
          results = gbData.items.map(item => {
            const info = item.volumeInfo || {};
            let cover = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '';
            if (cover.startsWith('http://')) cover = cover.replace('http://', 'https://');
            return { title: info.title || 'Título desconhecido', author: info.authors ? info.authors.join(', ') : 'Autor não informado', cover: cover, description: info.description ? info.description.substring(0, 160) + '...' : '' };
          });
        }
      }
    } catch(e) {}

    if (results.length === 0) {
      try {
        const olResponse = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8`);
        if (olResponse.ok) {
          const olData = await olResponse.json();
          if (olData.docs && olData.docs.length > 0) {
            results = olData.docs.map(doc => { return { title: doc.title || 'Título desconhecido', author: doc.author_name ? doc.author_name.join(', ') : 'Autor não informado', cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '', description: '' }; });
          }
        }
      } catch(e) {}
    }

    if (results.length === 0) { list.innerHTML = `<div class="text-center py-6 text-xs text-stone-400">Nenhum livro encontrado para "${escapeHtml(query)}". Tente outro termo ou preencha manualmente abaixo.</div>`; return; }
    window.currentSearchResults = results;
    list.innerHTML = window.currentSearchResults.map((book, index) => {
      return `
        <div onclick='selectBookFromSearchIndex(${index})' class="cursor-pointer p-2.5 rounded-xl border border-stone-200 hover:border-burgundy hover:bg-stone-50 flex items-center gap-3 transition">
          <img src="${book.cover || DEFAULT_BOOK_COVER}" class="w-11 h-16 object-cover rounded bg-stone-100 shrink-0" loading="lazy" decoding="async" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;">
          <div class="min-w-0 flex-1 text-left"><h5 class="text-xs font-bold text-stone-900 line-clamp-1">${escapeHtml(book.title)}</h5><p class="text-[11px] text-stone-500 truncate">${escapeHtml(book.author)}</p><span class="text-[10px] text-burgundy font-medium mt-1 inline-block">Selecionar esta obra →</span></div>
        </div>`;
    }).join('');
  } catch (err) { list.innerHTML = `<div class="text-center py-6 text-xs text-rose-500">Erro ao consultar os catálogos. Use o formulário manual abaixo.</div>`; }
}

window.selectBookFromSearchIndex = function(index) {
  const book = window.currentSearchResults[index];
  if (book) selectBookFromSearch(book);
}

function selectBookFromSearch(book) {
  const { memberId, bookKey } = activeSearchContext;
  const mem = window.clubState.members.find(m => m.id === memberId);
  if (mem) {
    mem[bookKey] = { title: book.title, author: book.author, cover: book.cover, description: book.description || '' };
    if (mem.book1 && mem.book2 && memberId === window.localCurrentUser) window.isEditingBooks = false;
    invalidateRenderCache();
    playSound('advance');
    closeBookSearchModal();
    // FIX: Update granular — só salva os dados deste membro
    persistState(`state.members`);
    showToast(`Livro adicionado para ${mem.name}!`, 'success');
  }
}

function applyManualBook() {
  const title = document.getElementById('manualTitle').value.trim();
  const author = document.getElementById('manualAuthor').value.trim();
  const cover = document.getElementById('manualCover').value.trim();
  if (!title) return showToast('Por favor, informe pelo menos o título do livro.', 'warning');
  selectBookFromSearch({ title, author: author || 'Autor não informado', cover: cover || DEFAULT_BOOK_COVER });
  document.getElementById('manualTitle').value = '';
  document.getElementById('manualAuthor').value = '';
  document.getElementById('manualCover').value = '';
}

function removeBook(memberId, bookKey) {
  const mem = window.clubState.members.find(m => m.id === memberId);
  if (mem) { 
    mem[bookKey] = null; 
    invalidateRenderCache();
    persistState('state.members'); 
    showToast('Livro removido.', 'info'); 
  }
}

function proceedToVotingIfReady() {
  if(window.clubState.members.length < 2) return showToast('É preciso de pelo menos 2 membros para votar.', 'warning');
  const missing = window.clubState.members.filter(m => !m.book1 || !m.book2);
  if (missing.length > 0) return showToast(`Faltam indicações de: ${missing.map(m => m.name).join(', ')}.`, 'warning');
  playSound('advance');
  changeStage('voting');
  showToast('Fase de exclusão iniciada! Exclua 1 livro de cada colega.', 'success');
}
