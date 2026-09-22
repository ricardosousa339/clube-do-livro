// ==========================================
// EXPORTAÇÃO DE IMAGENS — Canvas API
// Mosaico Anual + Card do Mês
// ==========================================

// Helper: carrega imagem com CORS e fallback
function loadImageForCanvas(url, fallbackColor = '#4a3b32') {
  return new Promise((resolve) => {
    if (!url || url.startsWith('data:image/svg')) {
      // Gera um placeholder colorido
      const c = document.createElement('canvas');
      c.width = 120; c.height = 180;
      const ctx = c.getContext('2d');
      ctx.fillStyle = fallbackColor;
      ctx.fillRect(0, 0, 120, 180);
      ctx.fillStyle = '#d4af37';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Sem Capa', 60, 100);
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = c.toDataURL();
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Fallback: tenta via proxy ou gera placeholder
      const c = document.createElement('canvas');
      c.width = 120; c.height = 180;
      const ctx = c.getContext('2d');
      ctx.fillStyle = fallbackColor;
      ctx.fillRect(0, 0, 120, 180);
      ctx.fillStyle = '#fbf9f4';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Sem Capa', 60, 100);
      const fallbackImg = new Image();
      fallbackImg.onload = () => resolve(fallbackImg);
      fallbackImg.src = c.toDataURL();
    };
    // Force HTTPS
    let safeUrl = url;
    if (safeUrl.startsWith('http://')) safeUrl = safeUrl.replace('http://', 'https://');
    img.src = safeUrl;
  });
}

// Helper: quebra texto longo em linhas
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// Helper: arredonda retângulo
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Helper: desenha imagem preservando proporção real da capa sem distorcer ou achatar
function drawImageProp(ctx, img, x, y, w, h) {
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  if (!nw || !nh) {
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  const imgRatio = nw / nh;
  const targetRatio = w / h;
  let sx, sy, sw, sh;
  if (imgRatio > targetRatio) {
    sh = nh;
    sw = nh * targetRatio;
    sx = (nw - sw) / 2;
    sy = 0;
  } else {
    sw = nw;
    sh = nw / targetRatio;
    sx = 0;
    sy = (nh - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// ==========================================
// MOSAICO ANUAL
// ==========================================
async function generateYearMosaic() {
  const history = window.clubState.history || [];
  const currentYear = new Date().getFullYear();

  // Filtra livros do ano corrente (ou usa todo histórico se nenhum corresponder ao ano atual)
  const yearBooks = history.filter(item => {
    const label = `${item.monthLabel || ''} ${item.archivedAt || ''}`;
    return label.includes(String(currentYear));
  });
  const booksToRender = yearBooks.length > 0 ? yearBooks : history;

  if (booksToRender.length === 0) {
    showToast('Nenhum livro arquivado no histórico para gerar o mosaico.', 'warning');
    return;
  }

  showToast('Gerando mosaico... Aguarde alguns segundos.', 'info');

  const displayYear = yearBooks.length > 0 ? String(currentYear) : 'do Clube';
  const cols = Math.min(booksToRender.length, 5);
  const rows = Math.ceil(booksToRender.length / cols);

  // Proporção Padrão de Capa de Livro 2:3 (160 x 240 px)
  const coverW = 160;
  const coverH = 240;
  const gap = 20;
  const padding = 60;
  const headerH = 140;
  const footerH = 60;

  const canvasW = padding * 2 + cols * coverW + (cols - 1) * gap;
  const canvasH = headerH + padding + rows * coverH + (rows - 1) * gap + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');

  // Fundo gradiente
  const grad = ctx.createLinearGradient(0, 0, canvasW, canvasH);
  grad.addColorStop(0, '#1A1412');
  grad.addColorStop(1, '#2D211C');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Decoração dourada sutil
  ctx.fillStyle = 'rgba(212, 163, 89, 0.06)';
  ctx.beginPath();
  ctx.arc(canvasW - 80, 80, 200, 0, Math.PI * 2);
  ctx.fill();

  // Header — nome do clube + ano
  const clubName = window.clubState.clubName || 'Clube do Livro';
  ctx.fillStyle = '#D4A359';
  ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('—  RETROSPECTIVA  —', canvasW / 2, 45);

  ctx.fillStyle = '#FBFAF8';
  ctx.font = 'bold 36px "Merriweather", Georgia, serif';
  ctx.fillText(clubName, canvasW / 2, 90);

  ctx.fillStyle = '#D4A359';
  ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`${booksToRender.length} ${booksToRender.length === 1 ? 'livro' : 'livros'} • ${displayYear}`, canvasW / 2, 120);

  // Carrega capas
  const coverPromises = booksToRender.map(item => loadImageForCanvas(item.winner?.cover));
  const coverImages = await Promise.all(coverPromises);

  // Renderiza grid de capas
  for (let i = 0; i < booksToRender.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = padding + col * (coverW + gap);
    const y = headerH + padding / 2 + row * (coverH + gap);

    // Sombra
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 4;

    // Fundo do card
    roundRect(ctx, x, y, coverW, coverH, 12);
    ctx.fillStyle = '#332A24';
    ctx.fill();
    ctx.restore();

    // Capa com clip arredondado
    ctx.save();
    roundRect(ctx, x, y, coverW, coverH, 12);
    ctx.clip();
    drawImageProp(ctx, coverImages[i], x, y, coverW, coverH);
    ctx.restore();

    // Borda sutil
    roundRect(ctx, x, y, coverW, coverH, 12);
    ctx.strokeStyle = 'rgba(212, 163, 89, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Footer
  ctx.fillStyle = 'rgba(212, 163, 89, 0.5)';
  ctx.font = '12px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Gerado pelo Clube do Livro', canvasW / 2, canvasH - 20);

  // Download
  downloadCanvasAsImage(canvas, `mosaico-${clubName.replace(/\s+/g, '-').toLowerCase()}-${currentYear}.png`);
  showToast('Mosaico gerado! Verifique seus downloads.', 'success');
}

// ==========================================
// EXTRATOR DE CORES DA CAPA (PALETA DINÂMICA)
// ==========================================
function extractPaletteFromImage(img) {
  const fallback = {
    bgDark: '#1A1412',
    bgMid: '#2D211C',
    bgBottom: '#120E0D',
    accent: '#D4A359',
    accentLight: '#F3E5AB',
    border: 'rgba(212, 163, 89, 0.55)',
    glow: 'rgba(212, 163, 89, 0.38)',
    cardBg: 'rgba(212, 163, 89, 0.10)',
    isFallback: true
  };

  if (!img) return fallback;

  try {
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 48;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, 48, 48);
    const data = ctx.getImageData(0, 0, 48, 48).data;

    let vibrantColors = [];
    let rSum = 0, gSum = 0, bSum = 0, total = 0;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      rSum += r;
      gSum += g;
      bSum += b;
      total++;

      // Converte RGB para HSL
      const max = Math.max(r, g, b) / 255;
      const min = Math.min(r, g, b) / 255;
      const d = max - min;
      const l = (max + min) / 2;
      let s = 0;
      if (d !== 0) {
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      }

      // Filtra brancos puros, pretos profundos e tons cinzas desbotados
      if (s > 0.20 && l > 0.18 && l < 0.88) {
        vibrantColors.push({ r, g, b, s, l });
      }
    }

    if (total === 0) return fallback;

    const avgR = Math.round(rSum / total);
    const avgG = Math.round(gSum / total);
    const avgB = Math.round(bSum / total);

    // Ordena as cores vibrantes pela saturação
    vibrantColors.sort((a, b) => b.s - a.s);

    let chosen = vibrantColors[0];
    let accentR = chosen ? chosen.r : 212;
    let accentG = chosen ? chosen.g : 163;
    let accentB = chosen ? chosen.b : 89;

    // Se o acento for escuro, eleva o brilho para destacar sobre o fundo
    const maxVal = Math.max(accentR, accentG, accentB);
    if (maxVal < 160) {
      const scale = 190 / Math.max(1, maxVal);
      accentR = Math.min(255, Math.round(accentR * scale));
      accentG = Math.min(255, Math.round(accentG * scale));
      accentB = Math.min(255, Math.round(accentB * scale));
    }

    // Fundo profundo e atmosférico baseado no matiz da capa
    const bgDark = `rgb(${Math.round(avgR * 0.18 + 14)}, ${Math.round(avgG * 0.18 + 12)}, ${Math.round(avgB * 0.18 + 12)})`;
    const bgMid = `rgb(${Math.round(avgR * 0.35 + 24)}, ${Math.round(avgG * 0.35 + 20)}, ${Math.round(avgB * 0.35 + 20)})`;
    const bgBottom = `rgb(${Math.round(avgR * 0.10 + 8)}, ${Math.round(avgG * 0.10 + 7)}, ${Math.round(avgB * 0.10 + 7)})`;

    return {
      bgDark,
      bgMid,
      bgBottom,
      accent: `rgb(${accentR}, ${accentG}, ${accentB})`,
      accentLight: `rgba(${accentR}, ${accentG}, ${accentB}, 0.85)`,
      border: `rgba(${accentR}, ${accentG}, ${accentB}, 0.50)`,
      glow: `rgba(${accentR}, ${accentG}, ${accentB}, 0.38)`,
      cardBg: `rgba(${accentR}, ${accentG}, ${accentB}, 0.10)`,
      isFallback: false
    };
  } catch (err) {
    console.warn('Erro ao extrair cores da capa (usando paleta padrão):', err);
    return fallback;
  }
}

// ==========================================
// CARD DO MÊS ATUAL (CANVAS BUILDER)
// ==========================================
async function renderCurrentMonthCardCanvas() {
  const winner = window.clubState.winner || (window.clubState.history && window.clubState.history.length > 0 && window.clubState.history[0]?.winner ? { book: window.clubState.history[0].winner, member: window.clubState.history[0].winner.member } : null);
  if (!winner || !winner.book) {
    showToast('Nenhum livro vencedor definido ainda.', 'warning');
    return null;
  }

  const book = winner.book;
  const memberName = winner.member || (winner.book && winner.book.member) || 'Integrante';
  const canvasW = 1080;
  const canvasH = 1350; // Formato story / post 4:5

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');

  // Carrega imagem da capa
  const coverImg = await loadImageForCanvas(book.cover);

  // Extrai paleta de cores dinâmica diretamente da capa
  const palette = extractPaletteFromImage(coverImg);

  // Fundo gradiente cinematográfico baseado nas cores da capa
  const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
  grad.addColorStop(0, palette.bgDark);
  grad.addColorStop(0.28, palette.bgMid);
  grad.addColorStop(0.60, palette.bgMid);
  grad.addColorStop(1, palette.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Efeito de Backlight / Halo luminoso atrás do livro (3D ambient glow)
  const glowGrad = ctx.createRadialGradient(canvasW / 2, 480, 80, canvasW / 2, 480, 520);
  glowGrad.addColorStop(0, palette.glow);
  glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Ambient glow suave na base do card para calor visual
  const bottomGlow = ctx.createRadialGradient(canvasW / 2, 1180, 40, canvasW / 2, 1180, 450);
  bottomGlow.addColorStop(0, palette.glow.replace(/[\d\.]+\)$/, '0.22)'));
  bottomGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Header Editorial Limpo e Equilibrado
  const clubName = window.clubState.clubName || 'Clube do Livro';
  const monthLabel = (window.clubState.history && window.clubState.history[0]?.monthLabel) || new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date());

  // Badge superior com a cor de destaque da capa
  const badgeText = clubName.toUpperCase();
  ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
  const textMetrics = ctx.measureText(badgeText);
  const badgeW = Math.max(280, textMetrics.width + 64);
  const badgeH = 44;
  const badgeX = (canvasW - badgeW) / 2;
  const badgeY = 48;

  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 22);
  ctx.fillStyle = palette.cardBg;
  ctx.fill();
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 22);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = palette.accent;
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, canvasW / 2, badgeY + 28);

  // Subtítulo do Mês — mais espaço antes da capa
  ctx.fillStyle = '#FBFAF8';
  ctx.font = 'bold 36px "Merriweather", Georgia, serif';
  ctx.fillText(`Livro Escolhido  ·  ${monthLabel}`, canvasW / 2, 138);

  // Capa do livro — empurrada para baixo com mais respiro
  const bookW = 400;
  const bookH = 600;
  const bookX = (canvasW - bookW) / 2;
  const bookY = 180;

  // Sombra profunda multicamada
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 55;
  ctx.shadowOffsetY = 24;
  roundRect(ctx, bookX, bookY, bookW, bookH, 20);
  ctx.fillStyle = '#1e1814';
  ctx.fill();
  ctx.restore();

  // Capa recortada com clip arredondado
  ctx.save();
  roundRect(ctx, bookX, bookY, bookW, bookH, 20);
  ctx.clip();
  drawImageProp(ctx, coverImg, bookX, bookY, bookW, bookH);
  ctx.restore();

  // Moldura refinada com a cor de acento extraída da capa
  roundRect(ctx, bookX, bookY, bookW, bookH, 20);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // --- SEÇÃO INFERIOR DO CARD ---
  // Posiciona tudo sequencialmente abaixo da capa para eliminar espaços vazios
  const hasDesc = book.description && book.description.trim().length > 3;
  let cursorY = bookY + bookH + 80;

  // Título da Obra
  ctx.fillStyle = '#FBFAF8';
  ctx.font = 'bold 54px "Merriweather", Georgia, serif';
  ctx.textAlign = 'center';
  const titleLines = wrapText(ctx, book.title || 'Sem Título', canvasW - 140).slice(0, 2);
  titleLines.forEach((line, i) => {
    ctx.fillText(line, canvasW / 2, cursorY + i * 66);
  });
  cursorY += titleLines.length * 66 + 12;

  // Autor
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '600 34px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(book.author || 'Autor não informado', canvasW / 2, cursorY);
  cursorY += 20;

  // Sinopse (apenas se existir)
  if (hasDesc) {
    cursorY += 28;
    const descText = `"${book.description.replace(/^"|"$/g, '').trim()}"`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = 'italic 24px "Merriweather", Georgia, serif';
    const descLines = wrapText(ctx, descText, canvasW - 180).slice(0, 2);
    descLines.forEach((line, i) => {
      ctx.fillText(line, canvasW / 2, cursorY + i * 36);
    });
    cursorY += (descLines.length - 1) * 36 + 20;
  }

  // Divisor fino e discreto
  cursorY += 30;
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(canvasW / 2 - 120, cursorY);
  ctx.lineTo(canvasW / 2 + 120, cursorY);
  ctx.stroke();
  cursorY += 36;

  // Cards de metadados — apenas 2, mais largos e com fundo sólido para legibilidade
  const metaItems = [
    { label: 'INDICADO POR', value: memberName },
    { label: 'DATA DO SORTEIO', value: (window.clubState.history && window.clubState.history[0]?.archivedAt) || new Date().toLocaleDateString('pt-BR') }
  ];

  const cardW = 420;
  const cardH = 110;
  const gap = 24;
  const totalMetaW = metaItems.length * cardW + (metaItems.length - 1) * gap;
  const startX = (canvasW - totalMetaW) / 2;

  metaItems.forEach((item, idx) => {
    const x = startX + idx * (cardW + gap);

    // Fundo claro e sólido — garante contraste em qualquer paleta de capa
    roundRect(ctx, x, cursorY, cardW, cardH, 18);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.fill();

    roundRect(ctx, x, cursorY, cardW, cardH, 18);
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Rótulo — texto escuro sobre fundo claro, sempre legível
    ctx.fillStyle = '#6B5C52';
    ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(item.label, x + cardW / 2, cursorY + 40);

    // Valor — preto denso, grande e bold
    ctx.fillStyle = '#1A1412';
    ctx.font = 'bold 30px "Plus Jakarta Sans", sans-serif';
    let valText = item.value;
    if (ctx.measureText(valText).width > cardW - 40) {
      while (ctx.measureText(valText + '...').width > cardW - 40 && valText.length > 3) {
        valText = valText.slice(0, -1);
      }
      valText += '...';
    }
    ctx.fillText(valText, x + cardW / 2, cursorY + 80);
  });

  // Rodapé — colado na base do card
  ctx.fillStyle = 'rgba(255, 255, 255, 0.40)';
  ctx.font = '500 16px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${clubName}  ·  Leitura Oficial  ·  ${monthLabel}`, canvasW / 2, canvasH - 36);

  return canvas;
}

// ==========================================
// PREVIEW DO CARD (MODAL)
// ==========================================
async function openCardPreviewModal() {
  const modal = document.getElementById('cardPreviewModal');
  const loading = document.getElementById('cardPreviewLoading');
  const img = document.getElementById('cardPreviewImage');
  if (!modal) return;

  // Mostra modal com loading
  modal.classList.remove('hidden');
  loading.classList.remove('hidden');
  img.classList.add('hidden');
  img.src = '';

  try {
    const canvas = await renderCurrentMonthCardCanvas();
    if (!canvas) {
      modal.classList.add('hidden');
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    img.src = dataUrl;
    img.onload = () => {
      loading.classList.add('hidden');
      img.classList.remove('hidden');
    };
  } catch (err) {
    console.error('[Preview] Erro ao gerar card:', err);
    showToast('Erro ao gerar o card.', 'danger');
    modal.classList.add('hidden');
  }
}

function closeCardPreviewModal() {
  const modal = document.getElementById('cardPreviewModal');
  if (modal) modal.classList.add('hidden');
}

// ==========================================
// BAIXAR CARD
// ==========================================
async function downloadCurrentMonthCard() {
  showToast('Gerando card para download...', 'info');
  const canvas = await renderCurrentMonthCardCanvas();
  if (!canvas) return;

  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date());
  const monthSlug = monthLabel.replace(/\s+/g, '-').toLowerCase();
  downloadCanvasAsImage(canvas, `livro-do-mes-${monthSlug}.png`);
  showToast('Card baixado com sucesso!', 'success');
}

// ==========================================
// ENVIAR PARA WHATSAPP
// ==========================================
async function shareMonthCardWhatsApp() {
  showToast('Preparando envio para o WhatsApp...', 'info');
  const winner = window.clubState.winner || (window.clubState.history && window.clubState.history.length > 0 && window.clubState.history[0]?.winner ? { book: window.clubState.history[0].winner, member: window.clubState.history[0].winner.member } : null);
  if (!winner || !winner.book) return showToast('Nenhum livro definido ainda.', 'warning');

  const title = winner.book.title;
  const author = winner.book.author || 'Autor não informado';
  const member = winner.member || 'Integrante';
  const dateStr = (window.clubState.history && window.clubState.history[0]?.archivedAt) || new Date().toLocaleDateString('pt-BR');
  
  // Texto enxuto para WhatsApp
  const message = `*Clube do Livro* 📚\nNosso próximo livro é *${title}*, de ${author}!\nIndicado por: ${member}\nSorteado em: ${dateStr}`;

  const canvas = await renderCurrentMonthCardCanvas();
  if (!canvas) return;

  // Se o dispositivo suportar compartilhamento nativo de arquivo (Android / iOS)
  if (navigator.share && navigator.canShare) {
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'livro-do-mes.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Livro do Mês: ${title}`,
          text: message
        });
        showToast('Compartilhado com sucesso!', 'success');
        return;
      }
    } catch (err) {
      if (err.name === 'AbortError') return; // Cancelado pelo usuário
      console.warn('[Share] Fallback para link WhatsApp:', err);
    }
  }

  // Fallback para desktop / navegadores sem suporte a compartilhamento de arquivo:
  // Baixa o card e abre o WhatsApp com a mensagem enxuta
  downloadCanvasAsImage(canvas, 'livro-do-mes.png');
  const encodedMsg = encodeURIComponent(message);
  window.open(`https://api.whatsapp.com/send?text=${encodedMsg}`, '_blank');
  showToast('Card baixado! Anexe-o na mensagem do WhatsApp.', 'success');
}

// Retrocompatibilidade
async function generateCurrentMonthCard() {
  await downloadCurrentMonthCard();
}

// ==========================================
// DOWNLOAD HELPER
// ==========================================
function downloadCanvasAsImage(canvas, filename) {
  try {
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (e) {
    console.error('[Export] Erro ao gerar imagem:', e);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      window.open(dataUrl, '_blank');
    } catch (e2) {
      showToast('Erro ao gerar a imagem. Algumas capas podem ter bloqueio de CORS.', 'danger');
    }
  }
}
