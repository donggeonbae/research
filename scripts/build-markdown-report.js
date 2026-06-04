#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const imageMimes = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
]);

function usage() {
  console.error([
    'Usage:',
    '  node scripts/build-markdown-report.js --slug <slug> --input <report.md> --title <title> [options]',
    '',
    'Options:',
    '  --label <text>       Hero kicker label',
    '  --summary <text>     One-sentence report scope',
    '  --date <text>        Report date shown in metadata',
    '  --method <text>      Method/system shown in metadata',
    '  --metric <text>      Primary metric shown in metadata',
    '  --hero <path>        Optional local hero image embedded as base64',
    '',
    'If REPORT_PASSWORD is set, the script writes projects/<slug>/report.enc.',
    'A transient plaintext build is always written under build/<slug>/report.html.',
  ].join('\n'));
  process.exit(2);
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];

    if (!key.startsWith('--')) usage();

    const name = key.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith('--')) usage();

    options[name] = value;
    index += 1;
  }

  if (!options.slug || !options.input || !options.title) usage();

  return options;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(value) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[`*_~[\](){}:,.!?/\\|+="']/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || `section-${Math.random().toString(36).slice(2)}`;
}

function inlineMarkdown(value) {
  let out = escapeHtml(value);

  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  return out;
}

function readImage(src, sourceRoot) {
  const dataUri = src.match(/^data:([^;]+);base64,(.+)$/);

  if (dataUri) {
    return { mime: dataUri[1], base64: dataUri[2] };
  }

  if (/^(https?:|#)/.test(src)) fail(`Refusing to embed non-local image: ${src}`);

  const withoutFragment = src.split('#')[0].split('?')[0];
  const ext = path.extname(withoutFragment).toLowerCase();
  const mime = imageMimes.get(ext);

  if (!mime) fail(`Unsupported report image type: ${src}`);

  const filePath = path.resolve(sourceRoot, withoutFragment);
  const boundary = `${path.resolve(sourceRoot)}${path.sep}`;

  if (!filePath.startsWith(boundary)) fail(`Refusing to embed image outside source root: ${src}`);
  if (!fs.existsSync(filePath)) fail(`Missing report image: ${filePath}`);

  return { mime, base64: fs.readFileSync(filePath).toString('base64') };
}

function renderImage(src, sourceRoot) {
  const image = readImage(src, sourceRoot);

  return `<img data-image-mime="${escapeHtml(image.mime)}" data-image-base64="${escapeHtml(image.base64)}" alt="" loading="lazy">`;
}

function renderTable(rows, sourceRoot) {
  const parsed = rows.map((row) => row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));
  const header = parsed[0] || [];
  const body = parsed.slice(2);
  const renderCell = (cell, tag) => {
    const imageOnly = cell.match(/^!\[[^\]]*\]\(([^)]+)\)$/);
    const content = imageOnly
      ? renderImage(imageOnly[1], sourceRoot)
      : inlineMarkdown(cell).replace(/!\[[^\]]*\]\(([^)]+)\)/g, (_, src) => renderImage(src, sourceRoot));

    return `<${tag}>${content}</${tag}>`;
  };

  return [
    '<div class="table-wrap"><table>',
    '<thead><tr>' + header.map((cell) => renderCell(cell, 'th')).join('') + '</tr></thead>',
    '<tbody>' + body.map((row) => '<tr>' + row.map((cell) => renderCell(cell, 'td')).join('') + '</tr>').join('') + '</tbody>',
    '</table></div>',
  ].join('\n');
}

function renderMarkdown(markdown, sourceRoot) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  const headings = [];
  let paragraph = [];
  let list = [];
  let table = [];
  let inCode = false;
  let codeLang = '';
  let code = [];
  let blockquote = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(' ')).replace(/!\[[^\]]*\]\(([^)]+)\)/g, (_, src) => renderImage(src, sourceRoot))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!list.length) return;
    html.push('<ul>' + list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('') + '</ul>');
    list = [];
  }

  function flushTable() {
    if (!table.length) return;
    html.push(renderTable(table, sourceRoot));
    table = [];
  }

  function flushBlockquote() {
    if (!blockquote.length) return;
    html.push(`<blockquote>${blockquote.map((line) => `<p>${inlineMarkdown(line)}</p>`).join('')}</blockquote>`);
    blockquote = [];
  }

  function flushAll() {
    flushParagraph();
    flushList();
    flushTable();
    flushBlockquote();
  }

  for (const line of lines) {
    const fence = line.match(/^```\s*([\w.+-]*)\s*$/);

    if (fence) {
      if (inCode) {
        html.push(`<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(code.join('\n'))}</code></pre>`);
        inCode = false;
        codeLang = '';
        code = [];
      } else {
        flushAll();
        inCode = true;
        codeLang = fence[1] || '';
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (!line.trim()) {
      flushAll();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);

    if (heading) {
      flushAll();
      const level = heading[1].length;
      const text = heading[2].trim();
      const idBase = slugify(text);
      let id = idBase;
      let suffix = 2;

      while (headings.some((item) => item.id === id)) id = `${idBase}-${suffix++}`;

      headings.push({ level, text: text.replace(/`/g, ''), id });
      html.push(`<h${level} id="${id}">${inlineMarkdown(text)}<a class="anchor" href="#${id}" aria-label="section link">#</a></h${level}>`);
      continue;
    }

    if (/^\|.+\|\s*$/.test(line)) {
      flushParagraph();
      flushList();
      flushBlockquote();
      table.push(line);
      continue;
    }

    flushTable();

    if (/^---+$/.test(line.trim())) {
      flushAll();
      html.push('<hr>');
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);

    if (quote) {
      flushParagraph();
      flushList();
      blockquote.push(quote[1]);
      continue;
    }

    if (blockquote.length) flushBlockquote();

    const listItem = line.match(/^[-*]\s+(.+)$/);

    if (listItem) {
      flushParagraph();
      list.push(listItem[1]);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushAll();

  return { body: html.join('\n'), headings };
}

function readTemplate(name) {
  return fs.readFileSync(path.join(repoRoot, 'templates', name), 'utf8');
}

function buildUnlockShell(title) {
  return readTemplate('unlock-template.html').replaceAll('{{PROJECT_TITLE}}', title);
}

function buildReportHtml(markdown, options) {
  const sourceRoot = path.dirname(path.resolve(options.input));
  const reportTemplate = readTemplate('report-template.html');
  const reportStyle = reportTemplate.match(/<style>([\s\S]*?)<\/style>/i)?.[1];
  const blobScript = reportTemplate.match(/<script>\s*\(function \(\)[\s\S]*?<\/script>/i)?.[0];

  if (!reportStyle) fail('Missing report style in templates/report-template.html');
  if (!blobScript) fail('Missing Blob URL image script in templates/report-template.html');

  const { body, headings } = renderMarkdown(markdown, sourceRoot);
  const nav = headings
    .filter((heading) => heading.level <= 3)
    .map((heading) => `<a class="toc-level-${heading.level}" href="#${heading.id}">${escapeHtml(heading.text)}</a>`)
    .join('\n');
  const hero = options.hero ? readImage(options.hero, process.cwd()) : null;
  const title = options.title;
  const label = options.label || 'Encrypted HTML Report';
  const summary = options.summary || 'Protected research report generated from Markdown.';
  const date = options.date || new Date().toISOString().slice(0, 10);
  const method = options.method || 'Markdown to HTML';
  const metric = options.metric || 'Traceable report';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="./">
  <title>${escapeHtml(title)}</title>
  <style>
${reportStyle}
  </style>
</head>
<body style="--hero-image: none;" data-hero-mime="${hero ? escapeHtml(hero.mime) : ''}" data-hero-base64="${hero ? escapeHtml(hero.base64) : ''}">
  <header class="hero">
    <p class="kicker">${escapeHtml(label)}</p>
    <h1>${escapeHtml(title)}</h1>
    <p class="hero-summary">${escapeHtml(summary)}</p>
    <div class="meta-grid" aria-label="Report metadata">
      <div class="meta-item"><strong>${escapeHtml(date)}</strong>Date</div>
      <div class="meta-item"><strong>${escapeHtml(method)}</strong>Method</div>
      <div class="meta-item"><strong>${escapeHtml(metric)}</strong>Primary Metric</div>
    </div>
  </header>
  <div class="layout">
    <nav class="toc" aria-label="Table of contents"><strong>Contents</strong>${nav}</nav>
    <main class="content">${body}</main>
  </div>
  ${blobScript}
</body>
</html>`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const input = path.resolve(options.input);

  if (!fs.existsSync(input)) fail(`Missing report source: ${input}`);

  const projectRoot = path.join(repoRoot, 'projects', options.slug);
  const buildRoot = path.join(repoRoot, 'build', options.slug);
  const buildHtml = path.join(buildRoot, 'report.html');
  const reportEnc = path.join(projectRoot, 'report.enc');
  const reportHtml = buildReportHtml(fs.readFileSync(input, 'utf8'), options);

  fs.mkdirSync(projectRoot, { recursive: true });
  fs.mkdirSync(buildRoot, { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'index.html'), buildUnlockShell(options.title));
  fs.writeFileSync(buildHtml, reportHtml);

  if (process.env.REPORT_PASSWORD) {
    const result = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'encrypt-report.js'), buildHtml, reportEnc], {
      cwd: repoRoot,
      env: process.env,
      stdio: 'inherit',
    });

    if (result.status !== 0) process.exit(result.status || 1);
  } else {
    console.warn(`REPORT_PASSWORD is not set; wrote plaintext build to ${path.relative(repoRoot, buildHtml)} and skipped report.enc.`);
  }

  console.log(`Built ${path.relative(repoRoot, projectRoot)}`);
}

main();

