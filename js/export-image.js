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

  const coverW = 160;
  const coverH = 230;
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
  ctx.fillText('✦  RETROSPECTIVA  ✦', canvasW / 2, 45);

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
    ctx.drawImage(coverImages[i], x, y, coverW, coverH);
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
  ctx.fillText('📚 Gerado pelo Clube do Livro', canvasW / 2, canvasH - 20);

  // Download
  downloadCanvasAsImage(canvas, `mosaico-${clubName.replace(/\s+/g, '-').toLowerCase()}-${currentYear}.png`);
  showToast('Mosaico gerado! Verifique seus downloads.', 'success');
}

// ==========================================
// CARD DO MÊS ATUAL
// ==========================================
async function generateCurrentMonthCard() {
  const winner = window.clubState.winner;
  if (!winner || !winner.book) {
    showToast('Nenhum livro vencedor definido ainda.', 'warning');
    return;
  }

  showToast('Gerando card do mês...', 'info');

  const canvasW = 1080;
  const canvasH = 1350; // Formato story 4:5

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');

  // Fundo gradiente elegante
  const grad = ctx.createLinearGradient(0, 0, canvasW, canvasH);
  grad.addColorStop(0, '#1A1412');
  grad.addColorStop(0.5, '#2D211C');
  grad.addColorStop(1, '#1A1412');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Decorações douradas
  ctx.fillStyle = 'rgba(212, 163, 89, 0.05)';
  ctx.beginPath();
  ctx.arc(900, 200, 350, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(180, 1100, 300, 0, Math.PI * 2);
  ctx.fill();

  // Header — badge
  ctx.fillStyle = '#D4A359';
  ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '4px';
  ctx.fillText('✦  LIVRO DO MÊS  ✦', canvasW / 2, 100);

  // Mês e ano
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date());
  ctx.fillStyle = 'rgba(212, 163, 89, 0.7)';
  ctx.font = '18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(monthLabel.toUpperCase(), canvasW / 2, 140);

  // Nome do clube
  const clubName = window.clubState.clubName || 'Clube do Livro';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(clubName, canvasW / 2, 175);

  // Capa do livro (grande, centralizada)
  const coverImg = await loadImageForCanvas(winner.book.cover);
  const bookW = 340;
  const bookH = 500;
  const bookX = (canvasW - bookW) / 2;
  const bookY = 230;

  // Sombra do livro
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 15;
  roundRect(ctx, bookX, bookY, bookW, bookH, 16);
  ctx.fillStyle = '#332A24';
  ctx.fill();
  ctx.restore();

  // Capa com clip arredondado
  ctx.save();
  roundRect(ctx, bookX, bookY, bookW, bookH, 16);
  ctx.clip();
  ctx.drawImage(coverImg, bookX, bookY, bookW, bookH);
  ctx.restore();

  // Borda dourada
  roundRect(ctx, bookX, bookY, bookW, bookH, 16);
  ctx.strokeStyle = 'rgba(212, 163, 89, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Coroa emoji acima da capa
  ctx.font = '60px serif';
  ctx.textAlign = 'center';
  ctx.fillText('👑', canvasW / 2, 220);

  // Título do livro
  const titleY = bookY + bookH + 70;
  ctx.fillStyle = '#FBFAF8';
  ctx.font = 'bold 42px "Merriweather", Georgia, serif';
  ctx.textAlign = 'center';
  const titleLines = wrapText(ctx, winner.book.title, canvasW - 160);
  titleLines.forEach((line, i) => {
    ctx.fillText(line, canvasW / 2, titleY + i * 52);
  });

  // Autor
  const authorY = titleY + titleLines.length * 52 + 20;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '26px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(winner.book.author || 'Autor não informado', canvasW / 2, authorY);

  // Divider dourado
  const divY = authorY + 50;
  ctx.strokeStyle = 'rgba(212, 163, 89, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(canvasW / 2 - 100, divY);
  ctx.lineTo(canvasW / 2 + 100, divY);
  ctx.stroke();

  // Indicado por
  ctx.fillStyle = '#D4A359';
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`Indicado por ${winner.member}`, canvasW / 2, divY + 40);

  // Footer
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = '14px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('📚 Gerado pelo Clube do Livro', canvasW / 2, canvasH - 40);

  // Download
  const monthSlug = monthLabel.replace(/\s+/g, '-').toLowerCase();
  downloadCanvasAsImage(canvas, `livro-do-mes-${monthSlug}.png`);
  showToast('Card do mês gerado! Verifique seus downloads.', 'success');
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
    // Fallback: tenta sem CORS (abre em nova janela)
    try {
      const dataUrl = canvas.toDataURL('image/png');
      window.open(dataUrl, '_blank');
    } catch (e2) {
      showToast('Erro ao gerar a imagem. Algumas capas podem ter bloqueio de CORS.', 'danger');
    }
  }
}
