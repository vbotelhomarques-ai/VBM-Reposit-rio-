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

## Notas sobre o modelo

- **Sentido da operação:** soja, milho e farelo são tratados como *embarque* (exportação, terra → navio);
  fertilizante como *descarga* (importação, navio → terra). A animação e os rótulos se ajustam.
- **Berço:** o lote máximo do navio é limitado pelo DWT máximo do berço selecionado.
- **OPEX/ton:** soma do custo de todas as etapas (cada tonelada passa por todas elas).
- **Dados:** os valores de berços, pranchas e custos são referências pedagógicas.
  Confira com a Norma EMAP vigente antes de uso oficial.
