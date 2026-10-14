// Gera uma página HTML única (CSS e JS embutidos) a partir do build do Vite,
// no formato de conteúdo de página (sem <!doctype>/<html>/<head>/<body>).
// Uso: npm run build && node scripts/build-artifact.mjs [saida.html]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const assetsDir = 'dist/assets';
const files = readdirSync(assetsDir);
const pick = (ext) => {
  const name = files.find(f => f.endsWith(ext));
  if (!name) throw new Error(`Nenhum arquivo ${ext} em ${assetsDir}; rode "npm run build" antes.`);
  return readFileSync(join(assetsDir, name), 'utf8');
};

const css = pick('.css').replace(/<\/style/gi, '<\\/style');
const js = pick('.js').replace(/<\/script/gi, '<\\/script');
const out = process.argv[2] ?? 'dist/simulador-itaqui.html';

const html = `<title>Simulador Porto do Itaqui</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;

writeFileSync(out, html);
console.log(`${out}: ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
