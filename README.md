# Simulador de Mecanização Portuária — Porto do Itaqui

Simulador pedagógico (React + Vite + Tailwind) da cadeia de movimentação de granéis no Porto do Itaqui:
cais → transporte interno → armazenagem → expedição/recepção. Identifica o gargalo (Teoria das Restrições),
compara a prancha praticada com a meta da Norma EMAP 2023 e estima tempo de estadia, demurrage, CAPEX, OPEX e índice ESG.

## Como rodar

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm run build    # build de produção em dist/
```

## Base normativa

Os dados de `src/normaEmap.js` vêm da *Norma para Atracação e Desatracação de Navios no Porto
Organizado do Itaqui* (EMAP, revisão 2023):

- **Cap. 3 (item 3.1):** características dos berços 99 a 105 (calado, LOA, boca, calado aéreo, DWT, tipos de navio).
- **Cap. 9 (item 9.1):** pranchas mínimas de granéis sólidos, por produto, berço e sistema:
  mecanizado (por berço), não mecanizado de descarga (berços 99 a 103, com desconto de 20% no berço 104)
  e não mecanizado de carregamento (2/3 ternos e 1 terno). Produto sem prancha num berço ou sistema
  aparece desabilitado, com o motivo.
- **Item 10.7:** abaixo da prancha mínima o navio fica sujeito a desatracar e voltar à fila;
  horas excedentes são aprovadas pelo Gerente (até 12 h) ou pelo Diretor de Operações (acima de 12 h).
- **Cap. 8 e item 7.1 §2º:** preferências por aparelhamento especial de cais e de exportação dependem de cumprir a prancha.

## Suposições do simulador (fora da norma)

- O equipamento de cais opera exatamente na prancha mínima do Cap. 9.
- As capacidades de transporte interno, armazenagem e expedição/recepção, o CAPEX, o OPEX, o índice ESG
  e a demurrage (contratual) são ilustrativos.
- Carregamento não mecanizado: a tabela da norma não indica berços; o simulador aceita qualquer berço de
  granel sólido (GS), sem o desconto do berço 104.
- Granéis líquidos e carga geral não fazem parte da cadeia simulada.
- **OPEX/ton** é a soma do custo de todas as etapas (cada tonelada passa por todas elas).
