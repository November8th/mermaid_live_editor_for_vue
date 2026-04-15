/**
 * gui-editor bundle builder
 * Usage: node build.js
 *
 * Outputs:
 * - dist/gui-editor.component.js
 * - dist/gui-editor.mount.iife.js
 * - dist/GuiEditor.css
 *
 * File order matters because child modules must be registered before
 * parent components use them.
 */
const fs = require('fs');
const path = require('path');

const coreFiles = [
  'src/sequence-parser.js',
  'src/sequence-generator.js',
  'src/mermaid-parser.js',
  'src/mermaid-generator.js',
  'src/services/HistoryManager.js',
  'src/services/SvgExport.js',
  'src/actions/SvgPositionTracker.js',
  'src/actions/SvgNodeHandler.js',
  'src/actions/SvgEdgeHandler.js',
  'src/actions/PortDragHandler.js',
  'src/actions/SequencePositionTracker.js',
  'src/actions/SequenceMessageDragHandler.js',
  'src/actions/SequenceSvgHandler.js',
  'src/components/MermaidEditor.js',
  'src/components/MermaidToolbar.js',
  'src/components/MermaidPreview.js',
  'src/components/MermaidFullEditor.js',
];

const mountRuntimeFile = 'src/runtime/GuiEditorMount.js';

const assetFiles = [
  'GuiEditor.css',
];

const builtAt = new Date().toISOString();

const componentDependencyGuard = `/* ===== runtime: dependency guard ===== */
(function (global) {
  if (!global.Vue || !/^2\\./.test(String(global.Vue.version || ''))) {
    throw new Error('gui-editor component bundle requires global Vue 2 to be loaded first.');
  }
})(typeof window !== 'undefined' ? window : this);`;

const mountDependencyGuard = `if (!global.Vue || !/^2\\./.test(String(global.Vue.version || ''))) {
  throw new Error('gui-editor.mount.iife.js requires global Vue 2 to be loaded before this bundle.');
}`;

function createBanner(fileName, descriptionLines) {
  return `/**
 * ${fileName}
 * Built: ${builtAt}
 *
 * ${descriptionLines.join('\n * ')}
 */`;
}

function readSource(file) {
  const abs = path.join(__dirname, file);
  if (!fs.existsSync(abs)) {
    console.error('Missing:', abs);
    process.exit(1);
  }
  return fs.readFileSync(abs, 'utf8');
}

function createBlocks(files) {
  return files.map((file) => {
    console.log('  +', file);
    return `/* ===== ${file} ===== */\n${readSource(file)}`;
  });
}

function writeBundle(relativePath, content) {
  const outPath = path.join(__dirname, relativePath);
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(`\nBundle written: ${outPath} (${(content.length / 1024).toFixed(1)} KB)`);
}

function wrapIife(innerSource) {
  return `(function (global) {\n'use strict';\n\n${innerSource}\n\n})(typeof window !== 'undefined' ? window : this);\n`;
}

fs.mkdirSync('dist', { recursive: true });

console.log('Building component bundles...');
const componentParts = [
  createBanner('gui-editor.component.js', [
    'Concatenation of gui-editor source files (no minification).',
    'Requires global Vue 2 and Mermaid loaded separately.',
    'Registers the global Vue component <mermaid-full-editor>.'
  ]),
  componentDependencyGuard,
].concat(createBlocks(coreFiles));

const componentBundle = componentParts.join('\n\n');
writeBundle('dist/gui-editor.component.js', componentBundle);

console.log('\nBuilding mount bundle...');
const mountInnerParts = [
  mountDependencyGuard,
].concat(createBlocks(coreFiles)).concat([
  `/* ===== ${mountRuntimeFile} ===== */\n${readSource(mountRuntimeFile)}`
]);

const mountBundle = [
  createBanner('gui-editor.mount.iife.js', [
    'Browser mount bundle for gui-editor (no minification).',
    'Requires global Vue 2 and Mermaid loaded separately.',
    'Exposes window.GuiEditor.mount(...).'
  ]),
  wrapIife(mountInnerParts.join('\n\n'))
].join('\n\n');

writeBundle('dist/gui-editor.mount.iife.js', mountBundle);

for (const assetFile of assetFiles) {
  const assetSrc = path.join(__dirname, assetFile);
  if (!fs.existsSync(assetSrc)) {
    console.error('Missing asset:', assetSrc);
    process.exit(1);
  }

  const assetOut = path.join(__dirname, 'dist', path.basename(assetFile));
  fs.copyFileSync(assetSrc, assetOut);
  console.log(`Asset copied: ${assetOut}`);
}
