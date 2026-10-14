// --- CENA DO TEGRAM (PORTO DO ITAQUI) EM CANVAS ---
// Vista aérea estilizada: 4 armazéns em arco, esteiras elevadas com torres de transferência,
// silos na raiz do píer, píer com navios, rodovia e ferrovia lado a lado.
// Coordenadas lógicas de 800 x 380; o componente escala pelo devicePixelRatio.

export const CENA_W = 800;
export const CENA_H = 380;

const COR = {
  terreno: '#17211c',
  vegetacao: '#1f3a28',
  agua: '#0b2540',
  onda: '#38bdf855',
  asfalto: '#323843',
  faixa: '#9ca3af',
  trilho: '#8b8178',
  dormente: '#4b4038',
  concreto: '#6b7280',
  concretoTopo: '#9ca3af',
  telhadoClaro: '#d98a6c',
  telhado: '#c0674a',
  telhadoEscuro: '#8f4630',
  oitao: '#857a70',
  parede: '#9b8f84',
  portao: '#3f3a36',
  piso: '#2a2f2a',
  esteira: '#a0533b',
  esteiraTrelica: '#5c2f22',
  torre: '#1d4ed8',
  casco: '#b91c1c',
  convés: '#3f4a59',
  porao: '#1e2733',
  ponte: '#e5e7eb',
  shiploader: '#0284c7',
  lanca: '#38bdf8',
  guindaste: '#f59e0b',
  caminhao: '#f59e0b',
  vagao: '#57534e',
  locomotiva: '#0284c7',
  texto: '#e2e8f0',
  textoSuave: '#94a3b8',
  gargalo: '#ef4444'
};

// Geometria fixa da cena
const RODOVIA = [{ x: 330, y: 392 }, { x: 560, y: 150 }];
const FERROVIA = [{ x: 425, y: 392 }, { x: 610, y: 165 }];
const AGUA = [[470, 0], [800, 0], [800, 205], [745, 178], [665, 124], [592, 84], [520, 40]];
const PIER_RAIZ = { x: 588, y: 86 };
const PIER = { x1: 600, x2: 792, y: 58, esp: 10 };
const ARMAZENS = [0, 1, 2, 3].map(i => ({ x: 25 + i * 30, y: 300 - i * 46, L: 235, D: 38 }));
const CABECA_ESTEIRA = { x: 370, y: 181 }; // fim do coletor junto ao armazém mais alto
const COLETOR = [{ x: 280, y: 319 }, CABECA_ESTEIRA];
// Esteira principal: do TEGRAM direto ao píer, com torre de transferência no meio do vão
const TORRE_MEIO = { x: 480, y: 133 };
const ESTEIRA_PRINCIPAL = [CABECA_ESTEIRA, TORRE_MEIO, PIER_RAIZ, { x: 640, y: PIER.y }];

const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const angulo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

function linha(ctx, pts, cor, largura, tracejado) {
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.lineWidth = largura;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (tracejado) ctx.setLineDash(tracejado);
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.restore();
}

function retanguloOrientado(ctx, c, comp, larg, ang, cor) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(ang);
  ctx.fillStyle = cor;
  ctx.fillRect(-comp / 2, -larg / 2, comp, larg);
  ctx.restore();
}

function rotulo(ctx, texto, x, y, cor = COR.textoSuave, alinhamento = 'left') {
  ctx.save();
  ctx.font = '600 9px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = cor;
  ctx.textAlign = alinhamento;
  ctx.fillText(texto.toUpperCase(), x, y);
  ctx.restore();
}

// Caminho (polilinha) percorrido pela carga com parametrização por comprimento
function medirCaminho(pts) {
  const acum = [0];
  for (let i = 1; i < pts.length; i++) {
    acum.push(acum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return { pts, acum, total: acum[acum.length - 1] };
}

function pontoNoCaminho(c, d) {
  let i = 1;
  while (i < c.acum.length - 1 && c.acum[i] < d) i++;
  const seg = c.acum[i] - c.acum[i - 1] || 1;
  return lerp(c.pts[i - 1], c.pts[i], (d - c.acum[i - 1]) / seg);
}

// Rota da carga no sentido descarga (navio -> terra); o embarque percorre ao contrário
function rotaCarga(s) {
  const navio = { x: 700, y: 40 };
  const cais = { x: 668, y: PIER.y };
  const viaInterna = s.transporte === 'correia'
    ? [TORRE_MEIO, CABECA_ESTEIRA, lerp(COLETOR[0], COLETOR[1], 0.5)]
    : [lerp(RODOVIA[0], RODOVIA[1], 0.86), lerp(RODOVIA[0], RODOVIA[1], 0.42), { x: 292, y: 274 }];
  const armazem = { x: 170, y: 250 };
  const saida = s.expedicao === 'pera_ferro'
    ? [lerp(FERROVIA[0], FERROVIA[1], 0.3), lerp(FERROVIA[0], FERROVIA[1], 0.02)]
    : [lerp(RODOVIA[0], RODOVIA[1], 0.3), lerp(RODOVIA[0], RODOVIA[1], 0.02)];
  return medirCaminho([navio, cais, PIER_RAIZ, ...viaInterna, armazem, { x: 300, y: 300 }, ...saida]);
}

function desenharAgua(ctx, t) {
  ctx.save();
  ctx.beginPath();
  AGUA.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = COR.agua;
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = COR.onda;
  ctx.lineWidth = 1;
  for (let y = 8; y < 210; y += 14) {
    const desloc = ((t * 0.012) + y * 3) % 60;
    for (let x = 470 - 60 + desloc; x < 800; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 18, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function desenharRodovia(ctx) {
  linha(ctx, RODOVIA, COR.asfalto, 18);
  linha(ctx, RODOVIA, COR.faixa, 1, [6, 8]);
}

function desenharFerrovia(ctx) {
  const ang = angulo(FERROVIA[0], FERROVIA[1]);
  const nx = Math.sin(ang), ny = -Math.cos(ang);
  [-6, 6].forEach(off => {
    const via = FERROVIA.map(p => ({ x: p.x + nx * off, y: p.y + ny * off }));
    const comp = Math.hypot(via[1].x - via[0].x, via[1].y - via[0].y);
    for (let d = 0; d < comp; d += 7) {
      retanguloOrientado(ctx, lerp(via[0], via[1], d / comp), 2, 8, ang, COR.dormente);
    }
    linha(ctx, via.map(p => ({ x: p.x + nx * 2, y: p.y + ny * 2 })), COR.trilho, 1);
    linha(ctx, via.map(p => ({ x: p.x - nx * 2, y: p.y - ny * 2 })), COR.trilho, 1);
  });
}

function desenharVegetacao(ctx) {
  // Faixa verde entre a rodovia e a ferrovia, como no terreno real
  ctx.fillStyle = COR.vegetacao;
  ctx.beginPath();
  ctx.moveTo(355, 392);
  ctx.lineTo(560 + 14, 160);
  ctx.lineTo(598, 168);
  ctx.lineTo(408, 392);
  ctx.closePath();
  ctx.fill();
}

function desenharArmazem(ctx, a) {
  const hTelhado = a.D * 0.66; // cobertura em arco; abaixo dela, a parede frontal
  const yParede = a.y + hTelhado;
  // Sombra
  ctx.fillStyle = '#0006';
  ctx.fillRect(a.x + 5, a.y + 7, a.L, a.D);
  // Parede frontal com portões
  ctx.fillStyle = COR.parede;
  ctx.fillRect(a.x, yParede, a.L, a.D - hTelhado);
  ctx.fillStyle = COR.portao;
  for (let x = a.x + 8; x < a.x + a.L - 10; x += 16) {
    ctx.fillRect(x, yParede + 3, 8, a.D - hTelhado - 4);
  }
  // Cobertura em arco: claro na cumeeira, escuro nos beirais
  const g = ctx.createLinearGradient(0, a.y, 0, yParede);
  g.addColorStop(0, COR.telhadoEscuro);
  g.addColorStop(0.3, COR.telhadoClaro);
  g.addColorStop(0.65, COR.telhado);
  g.addColorStop(1, COR.telhadoEscuro);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(a.x, a.y, a.L, hTelhado, [6, 0, 0, 2]);
  ctx.fill();
  // Nervuras da cobertura
  ctx.strokeStyle = '#00000026';
  ctx.lineWidth = 1;
  for (let x = a.x + 10; x < a.x + a.L - 4; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, a.y + 2);
    ctx.lineTo(x, yParede - 1);
    ctx.stroke();
  }
  // Oitão em arco na ponta leste, sobre a parede de fundo
  ctx.fillStyle = COR.oitao;
  ctx.fillRect(a.x + a.L, yParede, 7, a.D - hTelhado);
  ctx.beginPath();
  ctx.moveTo(a.x + a.L, yParede);
  ctx.quadraticCurveTo(a.x + a.L + 9, a.y + hTelhado * 0.15, a.x + a.L, a.y);
  ctx.closePath();
  ctx.fill();
  // Torre de transferência azul ligando o armazém ao coletor
  ctx.fillStyle = COR.torre;
  ctx.fillRect(a.x + a.L + 6, a.y + a.D / 2 - 7, 8, 14);
}

function desenharPatio(ctx, a, cor) {
  // Pátio aberto: pilhas de granel a céu aberto no mesmo terreno dos armazéns
  ctx.fillStyle = COR.piso;
  ctx.fillRect(a.x, a.y, a.L, a.D);
  for (let k = 0; k < 2; k++) {
    const cx = a.x + a.L * (k ? 0.72 : 0.28);
    const cy = a.y + a.D / 2;
    ctx.fillStyle = '#0005';
    ctx.beginPath();
    ctx.ellipse(cx + 4, cy + 5, a.L * 0.2, a.D / 2 - 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.ellipse(cx, cy, a.L * 0.2, a.D / 2 - 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Sombreamento da pilha: crista clara, base escura
    const g = ctx.createLinearGradient(0, cy - a.D / 2, 0, cy + a.D / 2);
    g.addColorStop(0, '#ffffff30');
    g.addColorStop(0.45, '#00000000');
    g.addColorStop(1, '#00000070');
    ctx.fillStyle = g;
    ctx.fill();
  }
}

function desenharEsteira(ctx, pts, ativa) {
  ctx.save();
  if (!ativa) ctx.globalAlpha = 0.4;
  linha(ctx, pts, '#0005', 9);
  linha(ctx, pts, COR.esteiraTrelica, 7);
  linha(ctx, pts, COR.esteira, 4);
  // Pilares/torres nas mudanças de direção
  pts.slice(1, -1).forEach(p => {
    ctx.fillStyle = COR.torre;
    ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
  });
  ctx.restore();
}

function desenharNavio(ctx, x1, x2, y, h, ativo) {
  ctx.save();
  ctx.globalAlpha = ativo ? 1 : 0.75;
  ctx.fillStyle = COR.convés;
  ctx.strokeStyle = COR.casco;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2 - h, y);
  ctx.quadraticCurveTo(x2, y + h / 2, x2 - h, y + h);
  ctx.lineTo(x1, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Porões
  const nPoroes = 5;
  const largPorao = (x2 - x1 - h - 30) / nPoroes;
  ctx.fillStyle = COR.porao;
  for (let k = 0; k < nPoroes; k++) {
    ctx.fillRect(x1 + 24 + k * largPorao + 2, y + 4, largPorao - 5, h - 8);
  }
  // Superestrutura na popa
  ctx.fillStyle = COR.ponte;
  ctx.fillRect(x1 + 4, y + 3, 14, h - 6);
  ctx.restore();
}

function desenharPier(ctx) {
  linha(ctx, [PIER_RAIZ, { x: 625, y: PIER.y }], COR.concreto, 9);
  ctx.fillStyle = COR.concreto;
  ctx.fillRect(PIER.x1, PIER.y - PIER.esp / 2, PIER.x2 - PIER.x1, PIER.esp);
  ctx.fillStyle = COR.concretoTopo;
  ctx.fillRect(PIER.x1, PIER.y - PIER.esp / 2, PIER.x2 - PIER.x1, 2);
}

function desenharEquipamentoCais(ctx, sistema) {
  if (sistema === 'mec') {
    // Carregador/descarregador sobre trilhos do píer, com lança sobre o porão
    ctx.fillStyle = COR.shiploader;
    ctx.fillRect(660, PIER.y - 7, 16, 14);
    linha(ctx, [{ x: 668, y: PIER.y }, { x: 668, y: 30 }], COR.lanca, 4);
    linha(ctx, [{ x: 668, y: PIER.y }, { x: 668, y: 72 }], COR.lanca, 3);
    return;
  }
  const guindastes = sistema === 't2' ? [655, 725] : [668];
  guindastes.forEach(x => {
    ctx.fillStyle = COR.guindaste;
    ctx.beginPath();
    ctx.arc(x, PIER.y + 2, 6, 0, Math.PI * 2);
    ctx.fill();
    linha(ctx, [{ x, y: PIER.y + 2 }, { x: x - 12, y: 32 }], COR.guindaste, 3);
  });
}

function desenharMoega(ctx) {
  const ang = angulo(FERROVIA[0], FERROVIA[1]);
  const c = lerp(FERROVIA[0], FERROVIA[1], 0.3);
  ctx.fillStyle = '#0006';
  retanguloOrientado(ctx, { x: c.x + 4, y: c.y + 5 }, 40, 30, ang, '#0006');
  retanguloOrientado(ctx, c, 40, 30, ang, COR.parede);
  retanguloOrientado(ctx, c, 40, 12, ang, COR.telhado);
}

function desenharTrem(ctx, t, emExecucao) {
  const ang = angulo(FERROVIA[0], FERROVIA[1]);
  const nx = Math.sin(ang), ny = -Math.cos(ang);
  const via = FERROVIA.map(p => ({ x: p.x + nx * 6, y: p.y + ny * 6 }));
  const desloc = emExecucao ? ((t * 0.00004) % 0.08) : 0;
  for (let k = 0; k < 9; k++) {
    const pos = lerp(via[0], via[1], 0.04 + desloc + k * 0.035);
    retanguloOrientado(ctx, pos, 10, 7, ang, k === 8 ? COR.locomotiva : COR.vagao);
  }
}

function desenharCaminhoes(ctx, t, t0, t1, n, emExecucao) {
  const ang = angulo(RODOVIA[0], RODOVIA[1]);
  for (let k = 0; k < n; k++) {
    const fase = emExecucao ? ((t * 0.00006 + k / n) % 1) : k / n;
    const pos = lerp(RODOVIA[0], RODOVIA[1], t0 + (t1 - t0) * fase);
    const lado = k % 2 ? 4 : -4;
    retanguloOrientado(ctx, { x: pos.x + Math.sin(ang) * lado, y: pos.y - Math.cos(ang) * lado }, 11, 5, ang, COR.caminhao);
  }
}

function destacar(ctx, desenho) {
  ctx.save();
  ctx.strokeStyle = COR.gargalo;
  ctx.fillStyle = '#ef444418';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  desenho();
  ctx.restore();
}

// Desenha um quadro completo. s = estado da simulação, t = relógio (ms), particulas = [{progress,size,jitter}]
export function desenharCena(ctx, s, t, particulas) {
  ctx.fillStyle = COR.terreno;
  ctx.fillRect(0, 0, CENA_W, CENA_H);

  desenharAgua(ctx, t);
  desenharVegetacao(ctx);
  desenharRodovia(ctx);
  desenharFerrovia(ctx);

  // Terminal vizinho (decorativo), como o armazém isolado à direita da foto
  desenharArmazem(ctx, { x: 630, y: 250, L: 140, D: 42 });

  // Armazenagem: os 4 armazéns do TEGRAM ou pátio aberto, de trás para a frente
  [...ARMAZENS].reverse().forEach(a =>
    s.armazenagem === 'silo' ? desenharArmazem(ctx, a) : desenharPatio(ctx, a, s.produto.cor));

  // Expedição / recepção
  desenharMoega(ctx);
  if (s.expedicao === 'pera_ferro') desenharTrem(ctx, t, s.emExecucao);
  else desenharCaminhoes(ctx, t, 0.0, 0.3, 4, s.emExecucao);

  // Transporte interno: esteiras elevadas ou caminhões entre armazéns e píer
  const correia = s.transporte === 'correia';
  desenharEsteira(ctx, COLETOR, correia);
  desenharEsteira(ctx, ESTEIRA_PRINCIPAL, correia);
  {
    ctx.save();
    if (!correia) ctx.globalAlpha = 0.4;
    ARMAZENS.forEach(a => linha(ctx, [{ x: a.x + a.L + 13, y: a.y + a.D / 2 }, lerp(COLETOR[0], COLETOR[1], (319 - (a.y + a.D / 2)) / 138)], COR.esteira, 3));
    ctx.restore();
  }
  if (!correia) desenharCaminhoes(ctx, t, 0.42, 0.86, 5, s.emExecucao);

  desenharPier(ctx);
  desenharNavio(ctx, 612, 772, 26, 24, true);
  desenharNavio(ctx, 500, 590, 8, 16, false); // aguardando na fila
  desenharEquipamentoCais(ctx, s.sistemaCais);

  // Destaque do(s) gargalo(s)
  const g = s.gargaloRefs;
  if (g.includes('cais')) destacar(ctx, () => { ctx.fillRect(600, 18, 192, 62); ctx.strokeRect(600, 18, 192, 62); });
  if (g.includes('transp')) {
    destacar(ctx, () => {
      const pts = correia ? [...COLETOR, ...ESTEIRA_PRINCIPAL.slice(1)] : [lerp(RODOVIA[0], RODOVIA[1], 0.42), lerp(RODOVIA[0], RODOVIA[1], 0.86)];
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#ef444455';
      ctx.setLineDash([]);
      ctx.lineCap = 'round';
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    });
  }
  if (g.includes('armaz')) destacar(ctx, () => { ctx.fillRect(18, 154, 352, 192); ctx.strokeRect(18, 154, 352, 192); });
  if (g.includes('exp')) {
    destacar(ctx, () => {
      const via = s.expedicao === 'pera_ferro' ? FERROVIA : RODOVIA;
      const a = lerp(via[0], via[1], 0.0), b = lerp(via[0], via[1], 0.34);
      ctx.lineWidth = 26;
      ctx.strokeStyle = '#ef444440';
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
  }

  // Carga em movimento, na cor do produto. Pausado: partículas congeladas.
  const rota = rotaCarga(s);
  ctx.fillStyle = s.produto.cor;
  particulas.forEach(p => {
    const prog = s.embarque ? 1 - p.progress : p.progress;
    const pos = pontoNoCaminho(rota, prog * rota.total);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y + p.jitter, p.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // Rótulos
  rotulo(ctx, s.armazenagem === 'silo' ? 'TEGRAM · 4 armazéns' : 'TEGRAM', 30, 148, COR.texto);
  rotulo(ctx, correia ? 'Esteiras elevadas' : 'Esteiras paradas · caminhões', 420, 200);
  rotulo(ctx, `Píer · ${s.berco.nome}`, 700, 80, COR.texto, 'center');
  rotulo(ctx, 'Fila', 545, 36, COR.textoSuave, 'center');
  rotulo(ctx, 'Moega Ferroviária', 520, 330);
  rotulo(ctx, 'Rodovia', 300, 360, COR.textoSuave, 'right');

  ctx.save();
  ctx.font = '700 12px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = COR.gargalo;
  ctx.fillText(`GARGALO: ${s.gargaloTexto.toUpperCase()}`, 20, 26);
  ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = COR.textoSuave;
  ctx.fillText(`${s.produto.nome} · ${s.embarque ? 'Embarque (terra → navio)' : 'Descarga (navio → terra)'} · ${s.vazaoTexto} t/h`, 20, 44);
  ctx.restore();
}

// Velocidade das partículas (fração do caminho por quadro), proporcional à vazão efetiva
export const velocidadeParticula = (vazaoTh) => 0.0006 + (vazaoTh / 1042) * 0.0024;
