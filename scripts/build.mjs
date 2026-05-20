// scripts/build.mjs
// Renders the COIK static site from YAML data files into HTML pages.
// Run with: node scripts/build.mjs
//
// Inputs:  _data/site.yml, _data/tenets.yml, _data/projects.yml, _data/pages/*.yml
// Outputs: index.html, tenets.html, projects.html, about.html, join.html

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { marked } from "marked";

marked.setOptions({ mangle: false, headerIds: false });

const ROOT = process.cwd();
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const loadYaml = (p) => yaml.load(read(p));

const site = loadYaml("_data/site.yml");
const tenetsData = loadYaml("_data/tenets.yml");
const projectsData = loadYaml("_data/projects.yml");
const pages = {
  home:  loadYaml("_data/pages/home.yml"),
  about: loadYaml("_data/pages/about.yml"),
  join:  loadYaml("_data/pages/join.yml"),
};

// -- Helpers --------------------------------------------------------------

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

const md = (s) => marked.parse(String(s ?? "").trim());
const mdInline = (s) => marked.parseInline(String(s ?? "").trim());

// Page key -> output file + display title
const PAGE_META = {
  home:     { file: "index.html",    nav: "home"     },
  tenets:   { file: "tenets.html",   nav: "tenets"   },
  projects: { file: "projects.html", nav: "projects" },
  about:    { file: "about.html",    nav: "about"    },
  join:     { file: "join.html",     nav: "join"     },
};

function navHTML(activeKey) {
  const items = site.nav.map((n) => {
    const href = PAGE_META[n.page]?.file || (n.page + ".html");
    const cls = n.page === activeKey ? ' class="active"' : "";
    return `        <a href="${esc(href)}"${cls}>${esc(n.label)}</a>`;
  }).join("\n");
  return `      <nav class="primary" aria-label="Primary">\n${items}\n      </nav>`;
}

function headerHTML(activeKey) {
  return `  <header class="site-header">
    <div class="container">
      <a class="brand" href="index.html">
        <span class="brand-mark"><img src="assets/icon.png" alt="" /></span>
        <span class="brand-text">
          <span class="title">${esc(site.title)}</span>
          <span class="sub">${esc(site.tagline)}</span>
        </span>
      </a>
${navHTML(activeKey)}
    </div>
  </header>`;
}

function footerHTML() {
  return `  <footer class="site-footer">
    <div class="container">
      <p>&copy; <span id="yr"></span> ${esc(site.footer.text)} · <a href="about.html">${esc(site.footer.contact_link_label)}</a> · <a href="join.html">${esc(site.footer.join_link_label)}</a></p>
    </div>
    <script>document.getElementById('yr').textContent = new Date().getFullYear();</script>
  </footer>`;
}

function headHTML(pageTitle, pageDesc) {
  const fullTitle = pageTitle ? `${pageTitle} · ${site.title}` : site.title;
  const desc = pageDesc || site.description;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="icon" href="assets/icon.png" type="image/png" />
  <link rel="shortcut icon" href="assets/icon.png" type="image/png" />
  <link rel="apple-touch-icon" href="assets/icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css" />
</head>`;
}

function heroHTML(hero, withBadge = false) {
  if (!hero) return "";
  const badge = withBadge && hero.show_logo
    ? `      <div class="badge-lg"><img src="assets/coik_logo.png" alt="${esc(site.title)} logo" /></div>\n`
    : "";
  const btns = (hero.buttons || []).map((b) => {
    const cls = b.style === "ghost" ? "btn ghost" : "btn";
    return `        <a class="${cls}" href="${esc(b.href)}">${esc(b.label)}</a>`;
  }).join("\n");
  const btnRow = btns ? `      <div class="btn-row">\n${btns}\n      </div>\n` : "";
  return `    <section class="hero${withBadge ? " container" : ""}">
${badge}      <h1>${esc(hero.title)}</h1>
      <p class="lede">${esc(hero.lede)}</p>
${btnRow}    </section>`;
}

function panelHTML(panel) {
  const bullets = panel.bullets && panel.bullets.length
    ? `        <ul>\n${panel.bullets.map((b) => `          <li>${mdInline(b)}</li>`).join("\n")}\n        </ul>\n`
    : "";
  const cta = panel.cta_label && panel.cta_href
    ? `        <p class="center" style="margin-top:24px;"><a class="btn" href="${esc(panel.cta_href)}" rel="noopener">${esc(panel.cta_label)}</a></p>\n${panel.cta_note ? `        <p class="small center">${esc(panel.cta_note)}</p>\n` : ""}`
    : "";
  return `      <section class="panel">
        <h2>${esc(panel.heading)}</h2>
        ${md(panel.body)}
${bullets}${cta}      </section>`;
}

function contactFormHTML(c) {
  if (!c) return "";
  return `      <section class="panel">
        <h2>${esc(c.heading)}</h2>
        <p>${esc(c.intro)}</p>
        <form class="contact" action="https://formspree.io/f/${esc(c.formspree_id)}" method="POST">
          <div class="form-row">
            <div>
              <label for="name">Name</label>
              <input id="name" type="text" name="name" autocomplete="name" required />
            </div>
            <div>
              <label for="email">Email</label>
              <input id="email" type="email" name="email" autocomplete="email" required />
            </div>
          </div>
          <div>
            <label for="subject">Subject</label>
            <input id="subject" type="text" name="subject" />
          </div>
          <div>
            <label for="message">Message</label>
            <textarea id="message" name="message" required></textarea>
          </div>
          <div class="hp" aria-hidden="true">
            <label for="website">Leave this field blank</label>
            <input id="website" type="text" name="_gotcha" tabindex="-1" autocomplete="off" />
          </div>
          <input type="hidden" name="_subject" value="${esc(c.subject_default)}" />
          <div>
            <button class="btn" type="submit">Send message</button>
          </div>
          <p class="small">${esc(c.privacy_note)}</p>
        </form>
      </section>`;
}

function bodyOpen() { return "<body>"; }
function bodyClose() { return "</body>\n</html>\n"; }

// -- Renderers ------------------------------------------------------------

function renderHome() {
  const p = pages.home;
  const html = `${headHTML("", site.description)}
${bodyOpen()}
${headerHTML("home")}

  <main>
${heroHTML(p.hero, true)}

    <div class="container">
      <hr class="divider" />

${p.panels.map(panelHTML).join("\n\n")}
    </div>
  </main>

${footerHTML()}
${bodyClose()}`;
  writeFileSync("index.html", html);
}

function renderTenets() {
  const t = tenetsData;
  const list = t.tenets.map((x) => `          <li>
            <h3>${esc(x.numeral)}. ${esc(x.title)}</h3>
            <p>${esc(String(x.body).trim())}</p>
          </li>`).join("\n");
  const html = `${headHTML("Tenets", "The tenets of " + site.title + ".")}
${bodyOpen()}
${headerHTML("tenets")}

  <main>
    <div class="container">
${heroHTML(t.page, false)}

      <section class="panel">
        <ol class="tenets">
${list}
        </ol>
      </section>
    </div>
  </main>

${footerHTML()}
${bodyClose()}`;
  writeFileSync("tenets.html", html);
}

function renderProjects() {
  const d = projectsData;
  const projectPanels = d.projects.map((p) => {
    const bullets = p.bullets && p.bullets.length
      ? `        <ul>\n${p.bullets.map((b) => `          <li>${mdInline(b)}</li>`).join("\n")}\n        </ul>\n`
      : "";
    const after = p.body_after ? md(p.body_after) : "";
    return `      <section class="panel">
        <h2>${esc(p.numeral)}. ${esc(p.title)}</h2>
        ${md(p.body)}
${bullets}        ${after}
      </section>`;
  }).join("\n\n");
  const closing = d.closing
    ? `      <section class="panel">
        <h2>${esc(d.closing.title)}</h2>
        ${md(d.closing.body)}
        <p class="center" style="margin-top:18px;"><a class="btn ghost" href="${esc(d.closing.cta_href)}">${esc(d.closing.cta_label)}</a></p>
      </section>`
    : "";
  const html = `${headHTML("Projects", "Current projects of " + site.title + ".")}
${bodyOpen()}
${headerHTML("projects")}

  <main>
    <div class="container">
${heroHTML(d.page, false)}

${projectPanels}

${closing}
    </div>
  </main>

${footerHTML()}
${bodyClose()}`;
  writeFileSync("projects.html", html);
}

function renderAbout() {
  const p = pages.about;
  const html = `${headHTML("About & Contact", "About " + site.title + " and how to reach us.")}
${bodyOpen()}
${headerHTML("about")}

  <main>
    <div class="container">
${heroHTML(p.hero, false)}

${p.panels.map(panelHTML).join("\n\n")}

${contactFormHTML(p.contact)}
    </div>
  </main>

${footerHTML()}
${bodyClose()}`;
  writeFileSync("about.html", html);
}

function renderJoin() {
  const p = pages.join;
  const html = `${headHTML("Join & Support", "Membership in " + site.title + " is free, always.")}
${bodyOpen()}
${headerHTML("join")}

  <main>
    <div class="container">
${heroHTML(p.hero, false)}

${p.panels.map(panelHTML).join("\n\n")}
    </div>
  </main>

${footerHTML()}
${bodyClose()}`;
  writeFileSync("join.html", html);
}

// -- Run ------------------------------------------------------------------

renderHome();
renderTenets();
renderProjects();
renderAbout();
renderJoin();

console.log("Built: index.html, tenets.html, projects.html, about.html, join.html");
