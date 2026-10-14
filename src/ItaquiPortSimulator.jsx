import React, { useState, useEffect, useRef } from 'react';
import {
  Ship, Anchor, AlertTriangle, CheckCircle, Play, Pause, RotateCcw,
  Award, Zap, Layers, BarChart2, Factory, Truck, HardHat, BookOpen
} from 'lucide-react';
import {
  BERCOS, PRODUTOS, SISTEMAS_CAIS, pranchaNorma, bercoCompativel, aprovadorHorasExcedentes
} from './normaEmap.js';
import { CENA_W, CENA_H, desenharCena, velocidadeParticula } from './cenaTegram.js';

// --- SUPOSIÇÕES DO SIMULADOR (NÃO VÊM DA NORMA) ---
// O equipamento de cais opera exatamente na prancha mínima do Cap. 9; as demais etapas
// da cadeia têm capacidades ilustrativas. CAPEX (US$ milhões), OPEX (US$/t) e ESG são pedagógicos.
const SISTEMAS = {
  mec: {
    nome: 'Descarregador de Navios', nomeEmbarque: 'Carregador de Navios (Shiploader)',
    tipo: 'Mecanizado — aparelhamento especial de cais', capex: 22.0, opex: 4.5, esg: 92
  },
  t2: {
    nome: 'Guindaste + Grab (2 Ternos)', nomeEmbarque: 'Guindaste + Caçamba (2/3 Ternos)',
    tipo: 'Não mecanizado', capex: 3.0, opex: 15, esg: 45
  },
  t1: {
    nome: 'Guindaste + Grab (1 Terno)', nomeEmbarque: 'Guindaste + Caçamba (1 Terno)',
    tipo: 'Não mecanizado', capex: 1.5, opex: 18, esg: 35
  }
};

const EQUIPAMENTOS = {
  transporteInterno: [
    { id: 'caminhao', nome: 'Frota de Caminhões Caçamba', vazaoMax: 320, capex: 2.0, opex: 12, esg: 40 },
    { id: 'correia', nome: 'Correia Transportadora Fechada', vazaoMax: 1800, capex: 14.0, opex: 2.5, esg: 95 }
  ],
  armazenagem: [
    { id: 'patio', nome: 'Pátio Aberto / Armazém Plano', vazaoMax: 350, capex: 5.0, opex: 8, esg: 30 },
    { id: 'silo', nome: 'Armazéns Graneleiros (TEGRAM) e Silos', vazaoMax: 2000, capex: 28.0, opex: 2.0, esg: 96 }
  ],
  expedicao: [
    { id: 'bica_rod', nome: 'Bica Rodoviária Simples', nomeEmbarque: 'Tombador Rodoviário Simples', vazaoMax: 300, capex: 1.0, opex: 6, esg: 50 },
    { id: 'pera_ferro', nome: 'Pêra Ferroviária Automatizada', nomeEmbarque: 'Pêra Ferroviária / Descarga de Vagões', vazaoMax: 1600, capex: 18.0, opex: 1.8, esg: 94 }
  ]
};

// Cap. 8: berços com preferência para aparelhamento especial de cais (itens 8.3, 8.5, 8.7, 8.8)
// e para exportação que cumpra a produtividade mínima (itens 8.3, 8.4, 8.5, 8.7, 8.8, 8.9).
const BERCOS_PREF_APARELHAMENTO = ['100', '101', '103', '105'];
const BERCOS_PREF_EXPORTACAO = ['99', '100', '101', '103', '104', '105'];

const LOTE_MIN = 30000;
const LOTE_STEP = 500;
const DEMURRAGE_MAX = 10000000; // US$/dia; evita estouro numérico (US$ ∞)

// Números no padrão brasileiro (vírgula decimal, ponto de milhar)
const fmt = (n, casas) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const fmtTh = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

const produtoPorId = (id) => PRODUTOS.find(p => p.id === id);
const bercoPorId = (id) => BERCOS.find(b => b.id === id);

// Mantém o sistema de cais escolhido se a norma o prevê; senão, usa o primeiro disponível na ordem dada.
const sistemaValido = (produto, berco, preferido, ordem = SISTEMAS_CAIS) =>
  pranchaNorma(produto, berco, preferido).valor
    ? preferido
    : ordem.find(s => pranchaNorma(produto, berco, s).valor);

export default function ItaquiPortSimulator() {
  // --- ESTADOS DA SIMULAÇÃO ---
  const [produtoId, setProdutoId] = useState('soja');
  const [bercoId, setBercoId] = useState('100');
  const [sistemaCais, setSistemaCais] = useState('mec');
  const [tamanhoNavio, setTamanhoNavio] = useState(60000); // toneladas
  // O texto do campo fica em estado próprio para permitir apagar e digitar livremente
  const [demurrageTexto, setDemurrageTexto] = useState('25000');
  const custoDemurrageDia = Math.min(DEMURRAGE_MAX, Math.max(0, Number(demurrageTexto) || 0)); // US$/dia

  const [eqTransp, setEqTransp] = useState(EQUIPAMENTOS.transporteInterno[0]);
  const [eqArmaz, setEqArmaz] = useState(EQUIPAMENTOS.armazenagem[0]);
  const [eqExp, setEqExp] = useState(EQUIPAMENTOS.expedicao[0]);

  const [emExecucao, setEmExecucao] = useState(true);
  const canvasRef = useRef(null);

  const produto = produtoPorId(produtoId);
  const berco = bercoPorId(bercoId);
  const embarque = produto.sentido === 'embarque';
  const nomeEq = (eq) => (embarque && eq.nomeEmbarque ? eq.nomeEmbarque : eq.nome);

  // Lote limitado ao DWT máximo do berço (Cap. 3), alinhado ao passo do controle
  const loteMax = LOTE_MIN + Math.floor((berco.dwtMax - LOTE_MIN) / LOTE_STEP) * LOTE_STEP;

  const aplicarBerco = (novoBerco, novoProduto, sistemaPreferido) => {
    setBercoId(novoBerco.id);
    setSistemaCais(sistemaValido(novoProduto, novoBerco, sistemaPreferido));
    setTamanhoNavio(t => Math.min(t, novoBerco.dwtMax));
  };

  const selecionarProduto = (id) => {
    const novo = produtoPorId(id);
    setProdutoId(id);
    // Se a norma não prevê o produto neste berço, vai para o primeiro berço compatível
    const destino = bercoCompativel(novo, berco) ? berco : BERCOS.find(b => bercoCompativel(novo, b));
    aplicarBerco(destino, novo, sistemaCais);
  };

  const selecionarBerco = (id) => aplicarBerco(bercoPorId(id), produto, sistemaCais);

  // --- PRANCHA DA NORMA (CAP. 9) ---
  const norma = pranchaNorma(produto, berco, sistemaCais);
  const eqCais = SISTEMAS[sistemaCais];
  const pranchaMinimaTh = norma.valor;
  const pranchaMinimaTdia = pranchaMinimaTh * 24;

  // --- CADEIA E GARGALO ---
  const capacidades = [
    { etapa: embarque ? 'Cais (Carregamento)' : 'Cais (Descarregamento)', vazao: pranchaMinimaTh, ref: 'cais' },
    { etapa: 'Transporte Interno', vazao: eqTransp.vazaoMax, ref: 'transp' },
    { etapa: 'Armazenagem', vazao: eqArmaz.vazaoMax, ref: 'armaz' },
    { etapa: embarque ? 'Recepção Terrestre' : 'Expedição', vazao: eqExp.vazaoMax, ref: 'exp' }
  ];

  // O gargalo é o elo mais fraco da cadeia (Teoria das Restrições).
  // Em caso de empate há mais de um gargalo: melhorar só um deles não aumenta a vazão.
  const pranchaPraticadaTh = Math.min(...capacidades.map(c => c.vazao));
  const gargalos = capacidades.filter(c => c.vazao === pranchaPraticadaTh);
  const gargaloRefs = gargalos.map(g => g.ref);
  const gargaloTexto = gargalos.map(g => g.etapa).join(' + ');
  const pranchaPraticadaTdia = pranchaPraticadaTh * 24;

  // --- TEMPOS (CAP. 10) ---
  // Horas pela prancha da norma: referência para o prazo fixado na Ata pré-operacional (10.1, 10.7).
  const horasNorma = tamanhoNavio / pranchaMinimaTh;
  const horasNecessarias = tamanhoNavio / pranchaPraticadaTh;
  const horasExcedentes = Math.max(0, horasNecessarias - horasNorma);
  const diasEstadia = fmt(horasNecessarias / 24, 1);

  // Demurrage: estimativa contratual (fora da norma), com laytime pela prancha mínima
  const custoDemurrageTotal = Math.round((horasExcedentes / 24) * custoDemurrageDia);

  // Item 10.7: quem não cumpre as pranchas da norma fica sujeito a desatracar
  const cumprePrancha = pranchaPraticadaTh >= pranchaMinimaTh;
  const percentualPrancha = Math.floor((pranchaPraticadaTh / pranchaMinimaTh) * 100);

  // Cap. 8: preferências de atracação que dependem de cumprir a prancha
  const preferencias = [];
  if (sistemaCais === 'mec' && BERCOS_PREF_APARELHAMENTO.includes(berco.id)) {
    preferencias.push({ nome: 'Preferência por aparelhamento especial de cais', ref: 'Cap. 8; 7.1 §2º' });
  }
  if (embarque && BERCOS_PREF_EXPORTACAO.includes(berco.id)) {
    preferencias.push({ nome: 'Preferência de exportação', ref: 'Cap. 8; exige 70% da carga na retroárea ou armazenada até 15 km do porto' });
  }

  // --- FINANÇAS E ESG ---
  // Cada tonelada passa por todas as etapas: o OPEX por tonelada é a soma, não a média.
  const capexTotal = fmt(eqCais.capex + eqTransp.capex + eqArmaz.capex + eqExp.capex, 1);
  const opexPorTonelada = fmt(eqCais.opex + eqTransp.opex + eqArmaz.opex + eqExp.opex, 2);
  const indiceESG = Math.round((eqCais.esg + eqTransp.esg + eqArmaz.esg + eqExp.esg) / 4);

  // Estado lido pelo loop de animação; atualizado a cada render sem reiniciar o loop.
  const animRef = useRef(null);
  animRef.current = {
    sistemaCais, transporte: eqTransp.id, armazenagem: eqArmaz.id, expedicao: eqExp.id,
    gargaloRefs, gargaloTexto, emExecucao, berco, produto, embarque, pranchaPraticadaTh,
    vazaoTexto: fmtTh(pranchaPraticadaTh)
  };

  // --- ANIMAÇÃO EM CANVAS HTML5: CENA DO TEGRAM ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    // Resolução nítida em telas de alta densidade
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CENA_W * dpr;
    canvas.height = CENA_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let animationFrameId;
    let relogio = 0;
    let anterior = performance.now();

    const particulas = Array.from({ length: 70 }, () => ({
      progress: Math.random(),
      size: Math.random() * 1.8 + 1.6,
      jitter: Math.random() * 4 - 2
    }));

    const render = (agora = performance.now()) => {
      const s = animRef.current;
      // O relógio só avança com o fluxo ligado: pausar congela trem, caminhões e carga
      if (s.emExecucao) {
        relogio += agora - anterior;
        const v = velocidadeParticula(s.pranchaPraticadaTh);
        particulas.forEach(p => {
          p.progress += v;
          if (p.progress >= 1) p.progress -= 1;
        });
      }
      anterior = agora;
      desenharCena(ctx, s, relogio, particulas);
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const rotuloSistema = (s) => (s === 'mec' ? 'Mecanizado' : s === 't2' ? (embarque ? '2/3 Ternos' : '2 Ternos') : '1 Terno');

  return (
    <div className="app-shell w-full min-h-screen bg-slate-950 text-slate-100 py-4 md:py-6 font-sans">
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
            Pranchas do Cap. 9 da Norma de Atracação EMAP 2023, regras do Cap. 10 e Teoria das Restrições.
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
              // Volta ao sistema menos mecanizado que a norma prevê e às etapas básicas
              setSistemaCais(sistemaValido(produto, berco, 't1', ['t1', 't2', 'mec']));
              setEqTransp(EQUIPAMENTOS.transporteInterno[0]);
              setEqArmaz(EQUIPAMENTOS.armazenagem[0]);
              setEqExp(EQUIPAMENTOS.expedicao[0]);
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
              <Zap size={14} className="text-amber-400" /> Vista Aérea do TEGRAM (Tempo Real)
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Gargalo também em HTML: no canvas reduzido (celular) o texto fica ilegível */}
              <span className="text-xs bg-rose-950/50 text-rose-300 px-2.5 py-1 rounded-full border border-rose-500/40">
                {gargalos.length > 1 ? 'Gargalos (empate)' : 'Gargalo'}: <strong>{gargaloTexto}</strong>
              </span>
              <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700">
                Vazão Efetiva: <strong className="text-sky-400 font-mono">{fmtTh(pranchaPraticadaTh)} t/h</strong>
              </span>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            width={CENA_W}
            height={CENA_H}
            role="img"
            aria-label={`Vista aérea do TEGRAM: ${gargalos.length > 1 ? 'gargalos' : 'gargalo'} em ${gargaloTexto}`}
            style={{ aspectRatio: `${CENA_W} / ${CENA_H}` }}
            className="w-full h-auto rounded-lg bg-slate-950 border border-slate-800/80"
          />

          {/* SITUAÇÃO PERANTE A NORMA */}
          <div className={`mt-3 p-3 rounded-lg text-xs border space-y-2 ${
            cumprePrancha
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
          }`}>
            <div className="flex items-start gap-2">
              <span className="shrink-0 mt-0.5">{cumprePrancha ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}</span>
              <div className="min-w-0">
                <strong className="block text-sm font-bold">
                  {cumprePrancha ? 'Cumpre a prancha mínima do Cap. 9' : 'Abaixo da prancha mínima: sujeito a desatracar (item 10.7)'}
                </strong>
                <span>
                  Prancha praticada de <strong>{fmtTh(pranchaPraticadaTh)} t/h</strong> = <strong>{percentualPrancha}%</strong> da
                  prancha mínima de <strong>{fmtTh(pranchaMinimaTh)} t/h</strong> para {produto.nome} no {berco.nome} ({norma.fonte}).
                </span>
                {!cumprePrancha && (
                  <span className="block mt-1">
                    Precisa de {fmt(horasNecessarias, 1)} h, contra {fmt(horasNorma, 1)} h pela prancha da norma:
                    {' '}{fmt(horasExcedentes, 1)} h excedentes. O cliente deve pedir as horas antes de encerrar as concedidas;
                    aprova o {aprovadorHorasExcedentes(horasExcedentes)} (10.7 §1º e §2º). Se desatracar, o navio volta à fila
                    com nova data de prontidão.
                  </span>
                )}
              </div>
            </div>
            {preferencias.length > 0 && (
              <div className="flex flex-wrap gap-2 pl-0 sm:pl-6">
                {preferencias.map(p => (
                  <span
                    key={p.nome}
                    className={`px-2 py-1 rounded text-[10px] font-semibold border ${
                      cumprePrancha
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                        : 'bg-rose-500 border-rose-500 text-white'
                    }`}
                  >
                    {cumprePrancha ? p.nome : `${p.nome}: em risco`} · {p.ref}
                  </span>
                ))}
              </div>
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
                  {fmt(pranchaPraticadaTdia / 1000, 1)}k <span className="text-xs font-normal">t/dia</span>
                </span>
                <span className="text-[10px] text-slate-500 block">({fmtTh(pranchaPraticadaTh)} t/h)</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block">Prancha Mínima (Cap. 9)</span>
                <span className="text-lg font-mono font-bold text-slate-200">
                  {fmt(pranchaMinimaTdia / 1000, 1)}k <span className="text-xs font-normal">t/dia</span>
                </span>
                <span className="text-[10px] text-slate-500 block">
                  ({fmtTh(pranchaMinimaTh)} t/h · {rotuloSistema(sistemaCais)}{norma.descontado ? ' · −20%' : ''})
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block">Tempo no Berço</span>
                <span className="text-lg font-mono font-bold text-amber-400">
                  {diasEstadia} <span className="text-xs font-normal">dias</span>
                </span>
                <span className="text-[10px] text-slate-500 block">({fmt(horasNecessarias, 1)} h operacionais)</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block">Horas pela Norma</span>
                <span className={`text-lg font-mono font-bold ${horasExcedentes > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {fmt(horasNorma, 1)} <span className="text-xs font-normal">h</span>
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {horasExcedentes > 0 ? `+${fmt(horasExcedentes, 1)} h excedentes` : 'sem horas excedentes'}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 col-span-2">
                <span className="text-[11px] text-slate-400 block">Demurrage estimada (contratual, fora da norma)</span>
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
          <div className="pt-3 border-t border-slate-800/80 flex justify-between items-center gap-2 flex-wrap text-xs text-slate-400">
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

      {/* TABELA DE PRANCHAS DO CAP. 9 PARA O PRODUTO */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <div className="flex justify-between items-baseline gap-2 flex-wrap mb-3">
          <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen size={15} /> Pranchas da Norma (Cap. 9) — {produto.nome}
          </h3>
          <span className="text-[11px] text-slate-500">t/h · toque numa célula para escolher berço e sistema</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-xs border-collapse min-w-[560px]">
            <thead>
              <tr className="text-slate-400">
                <th className="text-left font-semibold py-2 pr-3 w-28">Sistema</th>
                {BERCOS.map(b => (
                  <th key={b.id} className={`font-semibold py-2 px-1 text-center ${b.id === berco.id ? 'text-sky-300' : ''}`}>
                    {b.id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SISTEMAS_CAIS.map(s => (
                <tr key={s} className="border-t border-slate-800">
                  <th scope="row" className="text-left font-normal text-slate-300 py-1.5 pr-3 whitespace-nowrap">{rotuloSistema(s)}</th>
                  {BERCOS.map(b => {
                    const p = pranchaNorma(produto, b, s);
                    const ativo = b.id === berco.id && s === sistemaCais;
                    return (
                      <td key={b.id} className="py-1 px-1 text-center">
                        {p.valor ? (
                          <button
                            onClick={() => aplicarBerco(b, produto, s)}
                            title={p.fonte}
                            className={`w-full font-mono rounded px-1 py-1 border transition-all ${
                              ativo
                                ? 'bg-sky-500 border-sky-400 text-slate-950 font-bold'
                                : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-sky-500'
                            }`}
                          >
                            {fmtTh(p.valor)}{p.descontado ? '*' : ''}
                          </button>
                        ) : (
                          <span className="text-slate-600" title={p.motivo}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-slate-400 list-disc pl-4">
          {!embarque && <li>* Berço 104: desconto de 20% na prancha mínima não mecanizada, por restrição de circulação de veículos (nota do Cap. 9).</li>}
          <li>1 terno só é autorizado com risco de segurança operacional ou com toda a carga num único porão (Cap. 9, §2º).</li>
          <li>Operação com 3 ternos depende de validação de Operações, Segurança do Trabalho e Meio Ambiente da EMAP (Cap. 9, §3º).</li>
          <li>Granéis não previstos dependem da performance do navio, da infraestrutura e da validação da Autoridade Portuária (Cap. 9, §1º).</li>
          <li>Abaixo da prancha, o navio fica sujeito a desatracar na próxima janela de manobras e volta à fila (item 10.7).</li>
          <li>Duas operações seguidas abaixo da performance mínima podem tirar a atracação preferencial do embarcador (item 7.1, §2º).</li>
          {embarque && <li>Embarque exige prontidão de pelo menos 70% da carga armazenada dentro ou perto do porto (item 6.5).</li>}
          {embarque && <li>Carregamento não mecanizado: a tabela não indica berços; o simulador aceita qualquer berço de granel sólido (GS).</li>}
        </ul>
      </section>

      {/* PAINEL DE CONFIGURAÇÃO E ESCOLHA DE EQUIPAMENTOS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* COLUNA 1: DADOS DO NAVIO E PORTO */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <Ship size={15} /> 1. Parâmetros de Entrada
          </h3>

          <div>
            <label htmlFor="produto" className="text-xs text-slate-400 block mb-1">Granel Sólido</label>
            <select
              id="produto"
              value={produto.id}
              onChange={(e) => selecionarProduto(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <optgroup label="Embarque (exportação)">
                {PRODUTOS.filter(p => p.sentido === 'embarque').map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </optgroup>
              <optgroup label="Descarga (importação)">
                {PRODUTOS.filter(p => p.sentido === 'descarga').map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </optgroup>
            </select>
            <span className="text-[10px] text-slate-500 block mt-1">
              Operação: {embarque ? 'Embarque (exportação)' : 'Descarga (importação)'}
            </span>
          </div>

          <div>
            <label htmlFor="berco" className="text-xs text-slate-400 block mb-1">Berço de Atracação</label>
            <select
              id="berco"
              value={berco.id}
              onChange={(e) => selecionarBerco(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              {BERCOS.map(b => (
                <option key={b.id} value={b.id} disabled={!bercoCompativel(produto, b)}>
                  {b.nome} — Calado {fmt(b.calado, 1)} m · {fmt(b.dwtMax / 1000, 1)}k DWT
                  {bercoCompativel(produto, b) ? '' : ' (sem prancha)'}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-500 block mt-1">
              LOA máx. {berco.loaMax} m · Boca {berco.boca} m · Calado aéreo {berco.caladoAereo ? `${berco.caladoAereo} m` : 'ilimitado'} · {berco.tipos.join(', ')} (Cap. 3)
            </span>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <label htmlFor="lote">Lote da Carga (Navio)</label>
              <span className="font-mono text-white">{tamanhoNavio.toLocaleString('pt-BR')} t</span>
            </div>
            <input
              id="lote"
              type="range"
              min={LOTE_MIN}
              max={loteMax}
              step={LOTE_STEP}
              value={tamanhoNavio}
              onChange={(e) => setTamanhoNavio(Number(e.target.value))}
              className="w-full accent-sky-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 block mt-1">
              DWT máximo do {berco.nome}: {berco.dwtMax.toLocaleString('pt-BR')} t
            </span>
          </div>

          <div>
            <label htmlFor="demurrage-dia" className="text-xs text-slate-400 block mb-1">Demurrage (US$/dia)</label>
            <input
              id="demurrage-dia"
              type="number"
              min={0}
              max={DEMURRAGE_MAX}
              step={1000}
              value={demurrageTexto}
              onChange={(e) => setDemurrageTexto(e.target.value)}
              onBlur={() => setDemurrageTexto(String(custoDemurrageDia))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* COLUNA 2: SISTEMA DO CAIS */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <Factory size={15} /> 2. Operação no Cais
          </h3>

          <div className="space-y-2">
            {SISTEMAS_CAIS.map(s => {
              const eq = SISTEMAS[s];
              const p = pranchaNorma(produto, berco, s);
              return (
                <button
                  key={s}
                  onClick={() => setSistemaCais(s)}
                  disabled={!p.valor}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                    sistemaCais === s
                      ? 'bg-sky-950/60 border-sky-500 text-sky-200'
                      : p.valor
                        ? 'bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700'
                        : 'bg-slate-950/40 border-slate-800/50 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <div className="flex justify-between items-center gap-2 text-xs font-semibold">
                    <span>{nomeEq(eq)}</span>
                    <span className={`font-mono shrink-0 ${p.valor ? 'text-sky-400' : 'text-slate-600'}`}>
                      {p.valor ? `${fmtTh(p.valor)} t/h` : '—'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 flex justify-between gap-2">
                    <span>{p.valor ? `${eq.tipo}${p.descontado ? ' · −20% no berço 104' : ''}` : p.motivo}</span>
                    <span className="shrink-0">ESG: {eq.esg}%</span>
                  </div>
                </button>
              );
            })}
          </div>
          {sistemaCais === 't1' && (
            <p className="text-[10px] text-amber-300/90">
              1 terno só é autorizado com risco de segurança operacional ou com toda a carga num único porão (Cap. 9, §2º).
            </p>
          )}
        </div>

        {/* COLUNA 3: TRANSPORTE INTERNO E ARMAZÉM */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <Layers size={15} /> 3. Transporte e Armazém
          </h3>

          <div>
            <span className="text-[11px] text-slate-400 block mb-1">Transporte Interno</span>
            <div className="space-y-1.5">
              {EQUIPAMENTOS.transporteInterno.map(eq => (
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
            <span className="text-[11px] text-slate-400 block mb-1">Armazenagem</span>
            <div className="space-y-1.5">
              {EQUIPAMENTOS.armazenagem.map(eq => (
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
            {EQUIPAMENTOS.expedicao.map(eq => (
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
                // Usa o sistema mecanizado; se não houver neste berço, vai ao berço onde a norma o prevê
                const bercoMec = pranchaNorma(produto, berco, 'mec').valor
                  ? berco
                  : BERCOS.find(b => pranchaNorma(produto, b, 'mec').valor) ?? berco;
                aplicarBerco(bercoMec, produto, 'mec');
                setEqTransp(EQUIPAMENTOS.transporteInterno[1]); // Correia
                setEqArmaz(EQUIPAMENTOS.armazenagem[1]); // Silos
                setEqExp(EQUIPAMENTOS.expedicao[1]); // Pêra
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
