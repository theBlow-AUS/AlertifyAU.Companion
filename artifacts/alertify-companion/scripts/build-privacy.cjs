// Generate a portable /privacy/index.html from the same policy used in the app.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'lib/privacy-policy.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const policyModule = { exports: {} };
new Function('exports', 'module', compiled)(policyModule.exports, policyModule);
const policy = policyModule.exports.privacyPolicy;
const escape = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const sections = policy.sections.map((section, i) => `
  <section id="section-${i + 1}" aria-labelledby="heading-${i + 1}">
    <h2 id="heading-${i + 1}">${escape(section.title)}</h2>
    ${section.paragraphs.map(p => `<p>${escape(p)}</p>`).join('\n    ')}
    ${section.links ? `<ul class="sources">${section.links.map(link =>
      `<li><a href="${escape(link.url)}">${escape(link.label)}</a></li>`).join('')}</ul>` : ''}
  </section>`).join('\n');
const contents = policy.sections.map((section, i) =>
  `<li><a href="#section-${i + 1}">${escape(section.title)}</a></li>`).join('\n');
const html = `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Privacy policy | Alertify.au Companion</title>
  <meta name="description" content="How Alertify.au Companion handles location, saved watch addresses, notifications, hazard feeds and Live Map analytics.">
  <meta property="og:title" content="Privacy policy | Alertify.au Companion">
  <meta property="og:description" content="Understand your information and privacy choices in Alertify.au Companion.">
  <meta property="og:type" content="website">
  <style>
    :root { --ink:#1b2e39; --paper:#f3f4ee; --teal:#376e65; --line:#d6dfd9; --muted:#52646b; --red:#e74f51; }
    * { box-sizing:border-box; }
    html { scroll-behavior:smooth; scroll-padding-top:24px; }
    body { margin:0; color:var(--ink); background:var(--paper); font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; font-size:16px; line-height:1.75; }
    a { color:var(--teal); text-underline-offset:4px; overflow-wrap:anywhere; }
    a:hover { text-decoration-thickness:2px; }
    a:focus-visible,summary:focus-visible { outline:3px solid var(--teal); outline-offset:5px; border-radius:2px; }
    .skip { position:absolute; top:-80px; left:16px; background:white; padding:10px; z-index:2; }
    .skip:focus { top:16px; }
    header { background:var(--ink); border-bottom:4px solid var(--red); color:#fff; }
    .header-inner { max-width:880px; margin:auto; padding:26px 28px; display:flex; gap:16px; justify-content:space-between; align-items:center; flex-wrap:wrap; }
    .brand { color:#fff; text-decoration:none; font-size:26px; font-weight:800; letter-spacing:-1px; line-height:1.2; }
    .tagline { display:block; font-size:10px; letter-spacing:2.4px; font-weight:500; margin-top:8px; color:#c1d2cd; }
    .site-link { color:#dcebe6; font-size:14px; }
    main { max-width:824px; margin:auto; padding:48px 28px 60px; }
    .eyebrow { color:var(--teal); font-size:12px; font-weight:750; letter-spacing:1.8px; text-transform:uppercase; margin:0 0 10px; }
    h1 { font-size:clamp(34px,6vw,48px); line-height:1.14; letter-spacing:-1.8px; margin:0 0 16px; }
    .date { color:var(--muted); font-size:14px; margin:0; }
    .intro { margin:24px 0 28px; font-size:18px; }
    details { padding:17px 22px; border:1px solid var(--line); border-radius:12px; background:#e5eee7; margin-bottom:16px; }
    summary { cursor:pointer; font-weight:700; }
    details ol { padding-left:23px; margin-bottom:4px; }
    details li { padding:3px 0; }
    section { padding:29px 0 24px; border-bottom:1px solid var(--line); }
    h2 { font-size:23px; letter-spacing:-.5px; line-height:1.35; margin:0 0 16px; }
    p { margin:0 0 15px; }
    section p:last-child { margin-bottom:0; }
    .sources { padding-left:22px; }
    .sources li { padding:4px 0; }
    .contact { margin-top:32px; padding:25px; border-radius:12px; background:var(--ink); color:#fff; }
    .contact a { color:#d4e9dd; }
    .contact p { margin-bottom:0; }
    footer { border-top:1px solid var(--line); padding:25px 28px; text-align:center; font-size:13px; color:var(--muted); }
    footer a { margin:0 8px; }
    @media(max-width:480px) { .header-inner { padding:22px; } main { padding:34px 22px 44px; } h2 { font-size:21px; } }
    @media(prefers-reduced-motion:reduce) { html { scroll-behavior:auto; } }
    @media print { header { background:none; color:#000; } .brand { color:#000; } details,.site-link,.skip { display:none; } main { max-width:none; padding:20px 0; } .contact { background:none; color:#000; padding:0; } .contact a { color:#000; } section { break-inside:avoid; } }
  </style>
</head>
<body>
  <a class="skip" href="#policy">Skip to privacy policy</a>
  <header>
    <div class="header-inner">
      <a class="brand" href="https://alertify.au" aria-label="Alertify.au website">alertify<span class="tagline">AWARENESS, NOT ALARM</span></a>
      <a class="site-link" href="https://alertify.au">Visit alertify.au &rarr;</a>
    </div>
  </header>
  <main id="policy">
    <p class="eyebrow">Alertify.au Companion</p>
    <h1>Privacy policy</h1>
    <p class="date">Last updated <time datetime="2026-10-28">${escape(policy.updatedAt)}</time></p>
    <p class="intro">How information is handled when you use the Companion app, and the choices available to you.</p>
    <details>
      <summary>In this policy</summary>
      <nav aria-label="Policy contents"><ol>${contents}</ol></nav>
    </details>
    ${sections}
    <aside class="contact" aria-labelledby="privacy-contact">
      <h2 id="privacy-contact">Privacy contact</h2>
      <p>Privacy operator: Alertify.au<br>Questions or requests: <a href="mailto:support@ignisse.app">support@ignisse.app</a></p>
    </aside>
  </main>
  <footer>
    <p>Alertify.au Companion &middot; Source material belongs to its respective data holders.</p>
    <a href="https://alertify.au">Alertify.au</a>
    <a href="mailto:support@ignisse.app">Support</a>
    <a href="./" aria-current="page">Privacy policy</a>
  </footer>
</body>
</html>
`;
const outDir = path.join(root, 'public/privacy');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log('Built public/privacy/index.html');
