// --- NORMA DE ATRACAÇÃO E DESATRACAÇÃO DO PORTO DO ITAQUI (EMAP, REVISÃO 2023) ---
// Somente dados transcritos da norma. Suposições do simulador ficam em ItaquiPortSimulator.jsx.

// Cap. 3, item 3.1: características de projeto dos berços que operam granéis sólidos.
// caladoAereo null = "Ilimitado". Berços 106 e 108 são exclusivos de granel líquido (GL) e ficam de fora.
export const BERCOS = [
  { id: '99', nome: 'Berço 99', comprimento: 264, profundidade: 15.0, calado: 14.5, loaMax: 225, boca: 40, caladoAereo: null, dwtMax: 76500, tipos: ['GS', 'CG'] },
  { id: '100', nome: 'Berço 100', comprimento: 320, profundidade: 15.0, calado: 14.5, loaMax: 240, boca: 40, caladoAereo: 28, dwtMax: 100000, tipos: ['GSM', 'GS', 'CG'] },
  { id: '101', nome: 'Berço 101', comprimento: 223, profundidade: 12.0, calado: 11.5, loaMax: 200, boca: 40, caladoAereo: 25, dwtMax: 80000, tipos: ['GSM', 'GS', 'CG'] },
  { id: '102', nome: 'Berço 102', comprimento: 223, profundidade: 12.0, calado: 11.5, loaMax: 200, boca: 40, caladoAereo: null, dwtMax: 80000, tipos: ['GS', 'GL', 'GLP', 'CNTR', 'CG'] },
  { id: '103', nome: 'Berço 103', comprimento: 270, profundidade: 15.0, calado: 14.5, loaMax: 229, boca: 40, caladoAereo: 28, dwtMax: 100000, tipos: ['GSM', 'GS', 'CG', 'GL'] },
  { id: '104', nome: 'Berço 104', comprimento: 200, profundidade: 13.0, calado: 12.5, loaMax: 183, boca: 40, caladoAereo: null, dwtMax: 80000, tipos: ['GL', 'GS', 'CG', 'GLP'] },
  { id: '105', nome: 'Berço 105', comprimento: 280, profundidade: 18.0, calado: 17.5, loaMax: 229, boca: 45, caladoAereo: 18, dwtMax: 150000, tipos: ['GS', 'GSM', 'GL'] }
];

// Cap. 9, item 9.1: pranchas mínimas de granéis sólidos, em t/h.
// mecanizado: prancha por berço (tabela "Sistema Mecanizado"; a coluna "Berço 100/103" vale para os dois).
// naoMecanizado: { t2, t1 } das tabelas "Não Mecanizado - Descarga" (2 Ternos / 1 Terno)
//   ou "Não Mecanizado - Carregamento" (2 / 3 Ternos / 1 Terno).
// sentido: 'embarque' (terra -> navio) ou 'descarga' (navio -> terra), conforme a tabela não mecanizada
//   em que o produto aparece; para os só mecanizados, conforme a operação usual no Itaqui.
export const PRODUTOS = [
  { id: 'soja', nome: 'Soja', sentido: 'embarque', mecanizado: { '100': 1042, '103': 1042, '105': 1042 }, naoMecanizado: null, cor: '#fbbf24' },
  { id: 'milho', nome: 'Milho', sentido: 'embarque', mecanizado: { '100': 1042, '103': 1042, '105': 1042 }, naoMecanizado: null, cor: '#facc15' },
  { id: 'farelo', nome: 'Farelo de Soja', sentido: 'embarque', mecanizado: { '100': 667, '103': 667, '105': 667 }, naoMecanizado: null, cor: '#d6a76c' },
  { id: 'ferro_gusa', nome: 'Ferro Gusa', sentido: 'embarque', mecanizado: { '105': 1042 }, naoMecanizado: { t2: 542, t1: 400 }, cor: '#94a3b8' },
  { id: 'manganes', nome: 'Manganês', sentido: 'embarque', mecanizado: { '105': 667 }, naoMecanizado: { t2: 450, t1: 280 }, cor: '#a8a29e' },
  { id: 'cobre', nome: 'Concentrado de Cobre', sentido: 'embarque', mecanizado: { '105': 708 }, naoMecanizado: null, cor: '#f97316' },
  { id: 'fertilizantes', nome: 'Fertilizantes', sentido: 'descarga', mecanizado: { '101': 377 }, naoMecanizado: { t2: 300, t1: 200 }, cor: '#e2e8f0' },
  { id: 'carvao', nome: 'Carvão Mineral / Antracita', sentido: 'descarga', mecanizado: { '101': 458 }, naoMecanizado: { t2: 375, t1: 262 }, cor: '#71717a' },
  { id: 'ureia', nome: 'Ureia / Bentonita / Escória', sentido: 'descarga', mecanizado: {}, naoMecanizado: { t2: 250, t1: 150 }, cor: '#f8fafc' },
  { id: 'clinquer', nome: 'Clínquer / Calcário', sentido: 'descarga', mecanizado: {}, naoMecanizado: { t2: 292, t1: 204 }, cor: '#d6d3d1' },
  { id: 'trigo_arroz', nome: 'Trigo e Arroz', sentido: 'descarga', mecanizado: {}, naoMecanizado: { t2: 280, t1: 200 }, cor: '#fde68a' },
  { id: 'demais', nome: 'Demais Granéis Sólidos Não Mecanizados', sentido: 'descarga', mecanizado: {}, naoMecanizado: { t2: 300, t1: 200 }, cor: '#cbd5e1' }
];

// Cap. 9: a tabela de descarga não mecanizada vale para os berços 99/100/101/102/103.
// Nota da tabela: no berço 104 há desconto de 20% na prancha mínima (restrição de circulação de veículos).
export const BERCOS_NAO_MEC_DESCARGA = ['99', '100', '101', '102', '103', '104'];
export const DESCONTO_BERCO_104 = 0.2;

// A tabela de carregamento não mecanizado não indica berços nem traz a nota do berço 104.
// Suposição do simulador: vale para qualquer berço que receba granel sólido (GS), sem desconto.
const bercoAceitaGS = (berco) => berco.tipos.includes('GS');

export const SISTEMAS_CAIS = ['mec', 't2', 't1'];

// Prancha mínima da norma (t/h) para produto + berço + sistema, ou o motivo de não haver.
export function pranchaNorma(produto, berco, sistema) {
  if (sistema === 'mec') {
    const valor = produto.mecanizado[berco.id];
    if (valor) return { valor, fonte: 'Cap. 9 — Sistema Mecanizado' };
    const bercosMec = Object.keys(produto.mecanizado);
    return {
      valor: null,
      motivo: bercosMec.length
        ? `Mecanizado só no${bercosMec.length > 1 ? 's' : ''} berço${bercosMec.length > 1 ? 's' : ''} ${bercosMec.join(', ')}`
        : 'Sem prancha mecanizada na norma'
    };
  }

  const nm = produto.naoMecanizado;
  if (!nm) return { valor: null, motivo: 'Sem prancha não mecanizada na norma (Cap. 9, §1º)' };
  const base = sistema === 't2' ? nm.t2 : nm.t1;

  if (produto.sentido === 'descarga') {
    if (!BERCOS_NAO_MEC_DESCARGA.includes(berco.id)) {
      return { valor: null, motivo: 'Descarga não mecanizada só nos berços 99 a 104' };
    }
    if (berco.id === '104') {
      // Arredondado a 0,1 t/h para evitar resíduo de ponto flutuante (ex.: 292 × 0,8 = 233,6)
      return { valor: Math.round(base * (1 - DESCONTO_BERCO_104) * 10) / 10, fonte: 'Cap. 9 — Não Mecanizado, Descarga (−20% no berço 104)', descontado: true };
    }
    return { valor: base, fonte: 'Cap. 9 — Não Mecanizado, Descarga' };
  }

  if (!bercoAceitaGS(berco)) return { valor: null, motivo: 'Berço não recebe granel sólido (GS)' };
  return { valor: base, fonte: 'Cap. 9 — Não Mecanizado, Carregamento' };
}

// Berços onde o produto tem ao menos uma prancha prevista.
export const bercoCompativel = (produto, berco) =>
  SISTEMAS_CAIS.some(s => pranchaNorma(produto, berco, s).valor);

// Cap. 10, item 10.7, §2º: quem aprova horas excedentes.
export const aprovadorHorasExcedentes = (horas) =>
  horas <= 12 ? 'Gerente de Operações ou Logística (até 12 h)' : 'Diretor de Operações (acima de 12 h)';
