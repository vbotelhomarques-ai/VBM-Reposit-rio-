import React, { useState, useEffect, useRef } from 'react';
import {
  Ship, Anchor, AlertTriangle, CheckCircle, Play, Pause, RotateCcw,
  Award, Zap, Layers, BarChart2, Factory, Truck, HardHat
} from 'lucide-react';

// --- DADOS DO PORTO DO ITAQUI (REFERÊNCIA: NORMA EMAP 2023) ---
// Valores pedagógicos: conferir com a norma vigente antes de uso oficial.
const DATAS_ITAQUI = {
  bercos: [
    { id: '100', nome: 'Berço 100', loaMax: 240, calado: 14.5, dwtMax: 100000, tipo: 'GSM / GS / CG' },
    { id: '103', nome: 'Berço 103', loaMax: 229, calado: 14.5, dwtMax: 100000, tipo: 'GSM / GS / CG' },
    { id: '105', nome: 'Berço 105', loaMax: 229, calado: 17.5, dwtMax: 150000, tipo: 'GSM / GS / GL' },
    { id: '101', nome: 'Berço 101', loaMax: 200, calado: 11.5, dwtMax: 80000, tipo: 'GS / CG (Menor Calado)' }
  ],
  // sentido: 'embarque' (exportação: terra -> navio) ou 'descarga' (importação: navio -> terra)
  produtos: [
    { id: 'soja', nome: 'Soja em Grão', sentido: 'embarque', mecanizadoItaqui: 1042, naoMecanizado1T: 200, naoMecanizado2T: 300 },
    { id: 'milho', nome: 'Milho em Grão', sentido: 'embarque', mecanizadoItaqui: 1042, naoMecanizado1T: 200, naoMecanizado2T: 300 },
    { id: 'farelo', nome: 'Farelo de Soja', sentido: 'embarque', mecanizadoItaqui: 667, naoMecanizado1T: 150, naoMecanizado2T: 250 },
    { id: 'fertilizante', nome: 'Fertilizante (Descarga)', sentido: 'descarga', mecanizadoItaqui: 377, naoMecanizado1T: 200, naoMecanizado2T: 300 }
  ],
  equipamentosCais: [
    { id: 'grab1', nome: 'Guindaste + Grab (1 Terno)', nomeEmbarque: 'Guindaste + Caçamba (1 Terno)', vazaoBase: 200, tipo: 'Não Mecanizado', capex: 1.5, opex: 18, esg: 35 },
    { id: 'grab2', nome: 'Guindaste + Grab (2 Ternos)', nomeEmbarque: 'Guindaste + Caçamba (2 Ternos)', vazaoBase: 300, tipo: 'Não Mecanizado', capex: 3.0, opex: 15, esg: 45 },
    { id: 'csu', nome: 'Descarregador Contínuo / CSU Itaqui', nomeEmbarque: 'Carregador de Navios (Shiploader) TEGRAM', vazaoBase: 1042, tipo: 'Mecanizado', capex: 22.0, opex: 4.5, esg: 92 }
  ],
  transporteInterno: [
    { id: 'caminhao', nome: 'Frota de Caminhões Caçamba', vazaoMax: 320, capex: 2.0, opex: 12, esg: 40 },
    { id: 'correia', nome: 'Correia Transportadora Fechada (Itaqui)', vazaoMax: 1800, capex: 14.0, opex: 2.5, esg: 95 }
  ],
  armazenagem: [
    { id: 'patio', nome: 'Pátio Aberto / Armazém Plano', vazaoMax: 350, capex: 5.0, opex: 8, esg: 30 },
    { id: 'silo', nome: 'Bateria de Silos Verticalizados (TEGRAM)', vazaoMax: 2000, capex: 28.0, opex: 2.0, esg: 96 }
  ],
  expedicao: [
    { id: 'bica_rod', nome: 'Bica Rodoviária Simples', nomeEmbarque: 'Tombador Rodoviário Simples', vazaoMax: 300, capex: 1.0, opex: 6, esg: 50 },
    { id: 'pera_ferro', nome: 'Pêra Ferroviária / VLI Automatizada', nomeEmbarque: 'Pêra Ferroviária / Descarga de Vagões VLI', vazaoMax: 1600, capex: 18.0, opex: 1.8, esg: 94 }
  ]
};

const TAMANHO_NAVIO_MIN = 30000;
const TAMANHO_NAVIO_MAX = 120000;
const TAMANHO_NAVIO_STEP = 5000;

// Pontos do percurso no Porto do Itaqui (sentido descarga: navio -> terra)
const WAYPOINTS = [
  { x: 120, y: 190 }, // Porão do Navio
  { x: 230, y: 150 }, // Equipamento no Cais
  { x: 420, y: 150 }, // Galeria / Correia / Caminho
  { x: 580, y: 110 }, // Silos / Armazém
  { x: 730, y: 170 }  // Ferrovia / Rodovia
];

export default function ItaquiPortSimulator() {
  // --- ESTADOS DA SIMULAÇÃO ---
  const [bercoSelecionado, setBercoSelecionado] = useState(DATAS_ITAQUI.bercos[0]);
  const [produtoSelecionado, setProdutoSelecionado] = useState(DATAS_ITAQUI.produtos[0]);
  const [tamanhoNavio, setTamanhoNavio] = useState(60000); // Toneladas DWT
  const [custoDemurrageDia, setCustoDemurrageDia] = useState(25000); // US$/dia

  // Escolhas de Equipamento
  const [eqCais, setEqCais] = useState(DATAS_ITAQUI.equipamentosCais[0]);
  const [eqTransp, setEqTransp] = useState(DATAS_ITAQUI.transporteInterno[0]);
  const [eqArmaz, setEqArmaz] = useState(DATAS_ITAQUI.armazenagem[0]);
  const [eqExp, setEqExp] = useState(DATAS_ITAQUI.expedicao[0]);

  // Controle de Execução
  const [emExecucao, setEmExecucao] = useState(true);
  const canvasRef = useRef(null);

  const embarque = produtoSelecionado.sentido === 'embarque';
  const nomeEq = (eq) => (embarque && eq.nomeEmbarque ? eq.nomeEmbarque : eq.nome);

  // Limite de lote imposto pelo berço (DWT máximo)
  const loteMax = Math.min(TAMANHO_NAVIO_MAX, bercoSelecionado.dwtMax);

  const selecionarBerco = (id) => {
    const berco = DATAS_ITAQUI.bercos.find(b => b.id === id);
    setBercoSelecionado(berco);
    setTamanhoNavio(t => Math.min(t, berco.dwtMax));
  };

  // --- CÁLCULOS OPERACIONAIS E KPIS ---
  // A vazão no cais varia de acordo com o produto e a norma EMAP
  const vazaoCais = (eq) => eq.id === 'csu'
    ? produtoSelecionado.mecanizadoItaqui
    : (eq.id === 'grab1' ? produtoSelecionado.naoMecanizado1T : produtoSelecionado.naoMecanizado2T);
  const vazaoCaisEfetiva = vazaoCais(eqCais);

  const capacidades = [
    { etapa: embarque ? 'Cais (Carregamento)' : 'Cais (Descarregamento)', vazao: vazaoCaisEfetiva, ref: 'cais' },
    { etapa: 'Transporte Interno', vazao: eqTransp.vazaoMax, ref: 'transp' },
    { etapa: 'Armazenagem', vazao: eqArmaz.vazaoMax, ref: 'armaz' },
    { etapa: embarque ? 'Recepção Terrestre' : 'Expedição', vazao: eqExp.vazaoMax, ref: 'exp' }
  ];

  // O gargalo é determinado pelo elo mais fraco da cadeia (Teoria das Restrições)
  const gargalo = capacidades.reduce((min, item) => item.vazao < min.vazao ? item : min, capacidades[0]);
  const pranchaPraticadaTh = gargalo.vazao;
  const pranchaPraticadaTdia = pranchaPraticadaTh * 24;

  // Meta Oficial Itaqui (para o produto selecionado em sistema mecanizado)
  const pranchaOficialEMAPTh = produtoSelecionado.mecanizadoItaqui;
  const pranchaOficialEMAPTdia = pranchaOficialEMAPTh * 24;

  // Métricas de Tempo e Custos
  const horasOperacionais = Math.ceil(tamanhoNavio / pranchaPraticadaTh);
  const diasEstadia = (horasOperacionais / 24).toFixed(1);

  // Atraso com valores exatos (sem o arredondamento das horas) para não gerar multa fantasma a 100% da meta
  const diasAtraso = Math.max(0, (tamanhoNavio / pranchaPraticadaTdia) - (tamanhoNavio / pranchaOficialEMAPTdia));
  const custoDemurrageTotal = Math.round(diasAtraso * custoDemurrageDia);

  // Regra EMAP Cap. 10.7: Se praticar menos de 60% da meta oficial, risco grave de desatracação
  const percentualMetas = (pranchaPraticadaTh / pranchaOficialEMAPTh) * 100;
  const emConformidadeEMAP = percentualMetas >= 60;

  // Finanças e ESG
  // Cada tonelada passa por todas as etapas: o OPEX por tonelada é a soma, não a média.
  const capexTotal = (eqCais.capex + eqTransp.capex + eqArmaz.capex + eqExp.capex).toFixed(1);
  const opexPorTonelada = (eqCais.opex + eqTransp.opex + eqArmaz.opex + eqExp.opex).toFixed(2);
  const indiceESG = Math.round((eqCais.esg + eqTransp.esg + eqArmaz.esg + eqExp.esg) / 4);

  // Estado lido pelo loop de animação; atualizado a cada render sem reiniciar o loop.
  const animRef = useRef(null);
  animRef.current = {
    eqCais, eqTransp, eqArmaz, eqExp, gargalo, emExecucao, bercoSelecionado, embarque, pranchaPraticadaTh
  };

  // --- ANIMAÇÃO EM CANVAS HTML5 (FLUXO VIVO) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Partículas de grãos / fertilizante
    const particles = Array.from({ length: 60 }, () => ({
      progress: Math.random(),
      size: Math.random() * 3 + 2,
      jitter: Math.random() * 4 - 2
    }));

    const render = () => {
      const s = animRef.current;
      const speed = (s.pranchaPraticadaTh / 1000) * 0.008 + 0.002;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Desenhar Mar e Cais do Itaqui
      ctx.fillStyle = '#0f172a'; // Fundo industrial escuro
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Água do Mar
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 210, canvas.width, canvas.height - 210);

      // Linha de Água Animada
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 20) {
        ctx.lineTo(x, 215 + Math.sin((x + Date.now() * 0.05) * 0.05) * 2);
      }
      ctx.stroke();

      // Estrutura de Concreto do Cais
      ctx.fillStyle = '#334155';
      ctx.fillRect(180, 170, 600, 40);
      ctx.fillStyle = '#475569';
      ctx.fillRect(180, 170, 600, 6);

      // 2. Desenhar Navio Panamax no Cais
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(30, 210);
      ctx.lineTo(60, 240);
      ctx.lineTo(210, 240);
      ctx.lineTo(220, 210);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#dc2626'; // Casco vermelho
      ctx.fillRect(60, 230, 150, 10);

      // Porões do Navio
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(80, 212, 35, 12);
      ctx.fillRect(125, 212, 35, 12);
      ctx.fillRect(170, 212, 35, 12);

      // Etiqueta do Berço
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`${s.bercoSelecionado.nome} (Itaqui) — ${s.embarque ? 'Embarque' : 'Descarga'}`, 40, 200);

      // 3. Equipamento do Cais (Grab ou CSU / Shiploader)
      if (s.gargalo.ref === 'cais') {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(210, 100, 50, 75);
      }

      if (s.eqCais.id === 'csu') {
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(225, 110, 20, 60);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(210, 110, 50, 8); // Lança
      } else {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(230, 170);
        ctx.lineTo(240, 120);
        ctx.lineTo(210, 140);
        ctx.stroke();
      }

      // 4. Transporte Interno (Galeria de Correia ou Caminhões)
      if (s.gargalo.ref === 'transp') {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(260, 135, 280, 30);
      }

      ctx.strokeStyle = s.eqTransp.id === 'correia' ? '#10b981' : '#64748b';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(WAYPOINTS[1].x, WAYPOINTS[1].y);
      ctx.lineTo(WAYPOINTS[2].x, WAYPOINTS[2].y);
      ctx.lineTo(WAYPOINTS[3].x, WAYPOINTS[3].y);
      ctx.stroke();

      // 5. Armazenagem (Silos ou Pátio)
      if (s.gargalo.ref === 'armaz') {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(550, 70, 70, 90);
      }

      if (s.eqArmaz.id === 'silo') {
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(560, 80, 22, 70);
        ctx.fillRect(585, 80, 22, 70);
        ctx.fillStyle = '#64748b';
        ctx.beginPath(); ctx.arc(571, 80, 11, Math.PI, 0); ctx.fill();
        ctx.beginPath(); ctx.arc(596, 80, 11, Math.PI, 0); ctx.fill();
      } else {
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.moveTo(550, 150);
        ctx.lineTo(585, 100);
        ctx.lineTo(620, 150);
        ctx.fill();
      }

      // 6. Expedição / Recepção (Comboio / Caminhão)
      if (s.gargalo.ref === 'exp') {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(700, 130, 70, 50);
      }

      if (s.eqExp.id === 'pera_ferro') {
        ctx.fillStyle = '#475569';
        ctx.fillRect(700, 160, 30, 14);
        ctx.fillRect(735, 160, 30, 14);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(680, 155, 18, 19); // Locomotiva
      } else {
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(710, 155, 25, 15);
      }

      // 7. Partículas Animadas (Fluxo). Pausado: congeladas na posição atual.
      const totalSegments = WAYPOINTS.length - 1;
      particles.forEach(p => {
        if (s.emExecucao) {
          p.progress += speed;
          if (p.progress >= 1) p.progress -= 1;
        }

        // Embarque percorre o caminho no sentido inverso (terra -> navio)
        const t = s.embarque ? 1 - p.progress : p.progress;
        const segIndex = Math.min(Math.floor(t * totalSegments), totalSegments - 1);
        const segProgress = (t * totalSegments) - segIndex;

        const p1 = WAYPOINTS[segIndex];
        const p2 = WAYPOINTS[segIndex + 1];

        const x = p1.x + (p2.x - p1.x) * segProgress;
        const y = p1.y + (p2.y - p1.y) * segProgress;

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(x, y + p.jitter, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Legenda de Gargalo
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`GARGALO ATUAL: ${s.gargalo.etapa.toUpperCase()} (${s.gargalo.vazao} t/h)`, 380, 35);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 font-sans">
      {/* CABEÇALHO DA APLICAÇÃO */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 mb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded text-xs uppercase tracking-wider">
              EMAP / Porto do Itaqui
            </span>
            <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
              <Anchor className="text-sky-400" /> Simulador de Mecanização Portuária
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Análise de Desempenho Operacional, Pranchas da Norma EMAP 2023 e Teoria das Restrições.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setEmExecucao(!emExecucao)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              emExecucao ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-600 text-white'
            }`}
          >
            {emExecucao ? <Pause size={16} /> : <Play size={16} />}
            {emExecucao ? 'Pausar Fluxo' : 'Iniciar Fluxo'}
          </button>

          <button
            onClick={() => {
              setEqCais(DATAS_ITAQUI.equipamentosCais[0]);
              setEqTransp(DATAS_ITAQUI.transporteInterno[0]);
              setEqArmaz(DATAS_ITAQUI.armazenagem[0]);
              setEqExp(DATAS_ITAQUI.expedicao[0]);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm border border-slate-700"
          >
            <RotateCcw size={15} /> Repor Sistema
          </button>
        </div>
      </header>

      {/* PAINEL VISUAL DA SIMULAÇÃO (CANVAS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 relative overflow-hidden shadow-2xl">
          <div className="flex justify-between items-center mb-3 gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap size={14} className="text-amber-400" /> Vista Operacional do Berço (Tempo Real)
            </span>
            <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700">
              Vazão Efetiva: <strong className="text-sky-400 font-mono">{pranchaPraticadaTh} t/h</strong>
            </span>
          </div>

          <canvas
            ref={canvasRef}
            width={800}
            height={250}
            className="w-full h-auto rounded-lg bg-slate-950 border border-slate-800/80"
          />

          {/* PAINEL DE ALERTA NORMA EMAP */}
          <div className={`mt-3 p-3 rounded-lg flex items-center justify-between gap-2 text-xs border ${
            emConformidadeEMAP
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
          }`}>
            <div className="flex items-center gap-2">
              {emConformidadeEMAP ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
              <div>
                <strong className="block text-sm font-bold">
                  {emConformidadeEMAP ? 'Conforme com a Norma EMAP' : 'Risco de Desatracação Forçada (Cap. 10.7)'}
                </strong>
                <span>
                  Prancha praticada atinge <strong>{percentualMetas.toFixed(0)}%</strong> da meta da norma para {produtoSelecionado.nome}.
                </span>
              </div>
            </div>
            {!emConformidadeEMAP && (
              <span className="bg-rose-500 text-white px-2 py-1 rounded font-bold uppercase text-[10px] shrink-0">
                Perda de Prioridade FCFS
              </span>
            )}
          </div>
        </div>

        {/* PAINEL DE MÉTRICAS E KPIS */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <BarChart2 size={16} className="text-sky-400" /> KPIs de Operação Portuária
            </h2>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block">Prancha Praticada</span>
                <span className="text-lg font-mono font-bold text-sky-400">
                  {(pranchaPraticadaTdia / 1000).toFixed(1)}k <span className="text-xs font-normal">t/dia</span>
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block">Meta Itaqui (Mecanizada)</span>
                <span className="text-lg font-mono font-bold text-slate-200">
                  {(pranchaOficialEMAPTdia / 1000).toFixed(1)}k <span className="text-xs font-normal">t/dia</span>
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block">Tempo no Berço</span>
                <span className="text-lg font-mono font-bold text-amber-400">
                  {diasEstadia} <span className="text-xs font-normal">dias</span>
                </span>
                <span className="text-[10px] text-slate-500 block">({horasOperacionais} horas)</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block">Multa de Demurrage</span>
                <span className={`text-lg font-mono font-bold ${custoDemurrageTotal > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  US$ {custoDemurrageTotal.toLocaleString('pt-BR')}
                </span>
              </div>
            </div>

            {/* BARRA DE SUSTENTABILIDADE ESG */}
            <div className="space-y-1 mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1">
                  <HardHat size={12} /> Índice ESG / NR-29 (Segurança e Pó)
                </span>
                <span className="font-bold text-emerald-400">{indiceESG}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-500 ${
                    indiceESG > 80 ? 'bg-emerald-500' : indiceESG > 50 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${indiceESG}%` }}
                />
              </div>
            </div>
          </div>

          {/* RESUMO FINANCEIRO */}
          <div className="pt-3 border-t border-slate-800/80 flex justify-between items-center text-xs text-slate-400">
            <div>
              <span>CAPEX Estimado: </span>
              <strong className="text-white font-mono">US$ {capexTotal}M</strong>
            </div>
            <div>
              <span>OPEX/ton: </span>
              <strong className="text-white font-mono">US$ {opexPorTonelada}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* PAINEL DE CONFIGURAÇÃO E ESCOLHA DE EQUIPAMENTOS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* COLUNA 1: DADOS DO NAVIO E PORTO */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <Ship size={15} /> 1. Parâmetros de Entrada
          </h3>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Berço de Atracação (Itaqui)</label>
            <select
              value={bercoSelecionado.id}
              onChange={(e) => selecionarBerco(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              {DATAS_ITAQUI.bercos.map(b => (
                <option key={b.id} value={b.id}>
                  {b.nome} — Calado {b.calado}m (Max {b.dwtMax / 1000}k t)
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-500 block mt-1">
              LOA máx. {bercoSelecionado.loaMax} m · {bercoSelecionado.tipo}
            </span>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Tipo de Carga Granel</label>
            <select
              value={produtoSelecionado.id}
              onChange={(e) => setProdutoSelecionado(DATAS_ITAQUI.produtos.find(p => p.id === e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              {DATAS_ITAQUI.produtos.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
            <span className="text-[10px] text-slate-500 block mt-1">
              Operação: {embarque ? 'Embarque (exportação)' : 'Descarga (importação)'}
            </span>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Lote da Carga (Navio)</span>
              <span className="font-mono text-white">{tamanhoNavio.toLocaleString('pt-BR')} t</span>
            </div>
            <input
              type="range"
              min={TAMANHO_NAVIO_MIN}
              max={loteMax}
              step={TAMANHO_NAVIO_STEP}
              value={tamanhoNavio}
              onChange={(e) => setTamanhoNavio(Number(e.target.value))}
              className="w-full accent-sky-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 block mt-1">
              Limite do {bercoSelecionado.nome}: {loteMax.toLocaleString('pt-BR')} t
            </span>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Demurrage (US$/dia)</label>
            <input
              type="number"
              min={0}
              step={1000}
              value={custoDemurrageDia}
              onChange={(e) => setCustoDemurrageDia(Math.max(0, Number(e.target.value) || 0))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* COLUNA 2: EQUIPAMENTO DO CAIS */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <Factory size={15} /> 2. Operação no Cais
          </h3>

          <div className="space-y-2">
            {DATAS_ITAQUI.equipamentosCais.map(eq => (
              <button
                key={eq.id}
                onClick={() => setEqCais(eq)}
                className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                  eqCais.id === eq.id
                    ? 'bg-sky-950/60 border-sky-500 text-sky-200'
                    : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-center gap-2 text-xs font-semibold">
                  <span>{nomeEq(eq)}</span>
                  <span className="font-mono text-sky-400 shrink-0">{vazaoCais(eq)} t/h</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
                  <span>Tipo: {eq.tipo}</span>
                  <span>ESG: {eq.esg}%</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* COLUNA 3: TRANSPORTE INTERNO E ARMAZÉM */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <Layers size={15} /> 3. Transporte e Armazém
          </h3>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Transporte Interno</label>
            <div className="space-y-1.5">
              {DATAS_ITAQUI.transporteInterno.map(eq => (
                <button
                  key={eq.id}
                  onClick={() => setEqTransp(eq)}
                  className={`w-full text-left p-2 rounded border text-xs ${
                    eqTransp.id === eq.id ? 'bg-sky-950/60 border-sky-500 text-sky-200' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex justify-between gap-2">
                    <span>{eq.nome}</span>
                    <span className="font-mono shrink-0">{eq.vazaoMax} t/h</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Armazenagem</label>
            <div className="space-y-1.5">
              {DATAS_ITAQUI.armazenagem.map(eq => (
                <button
                  key={eq.id}
                  onClick={() => setEqArmaz(eq)}
                  className={`w-full text-left p-2 rounded border text-xs ${
                    eqArmaz.id === eq.id ? 'bg-sky-950/60 border-sky-500 text-sky-200' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex justify-between gap-2">
                    <span>{eq.nome}</span>
                    <span className="font-mono shrink-0">{eq.vazaoMax} t/h</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* COLUNA 4: EXPEDIÇÃO / RECEPÇÃO INTERMODAL */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <Truck size={15} /> 4. {embarque ? 'Recepção Intermodal' : 'Expedição Intermodal'}
          </h3>

          <div className="space-y-2">
            {DATAS_ITAQUI.expedicao.map(eq => (
              <button
                key={eq.id}
                onClick={() => setEqExp(eq)}
                className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                  eqExp.id === eq.id
                    ? 'bg-sky-950/60 border-sky-500 text-sky-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex justify-between items-center gap-2 text-xs font-semibold">
                  <span>{nomeEq(eq)}</span>
                  <span className="font-mono text-sky-400 shrink-0">{eq.vazaoMax} t/h</span>
                </div>
              </button>
            ))}
          </div>

          {/* DESAFIO PEDAGÓGICO */}
          <div className="pt-2">
            <button
              onClick={() => {
                setEqCais(DATAS_ITAQUI.equipamentosCais[2]); // CSU / Shiploader
                setEqTransp(DATAS_ITAQUI.transporteInterno[1]); // Correia
                setEqArmaz(DATAS_ITAQUI.armazenagem[1]); // Silos
                setEqExp(DATAS_ITAQUI.expedicao[1]); // Pêra
              }}
              className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10 transition-all"
            >
              <Award size={15} /> Aplicar Mecanização Ideal Itaqui
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
