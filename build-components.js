const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'docs/marketing/index(6).html');
const outDir = path.join(__dirname, 'apps/marketing/src/components');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

let html = fs.readFileSync(htmlPath, 'utf-8');

// Convert HTML to JSX
html = html.replace(/class=/g, 'className=');
html = html.replace(/<!--[\s\S]*?-->/g, ''); // Remove comments
html = html.replace(/<img(.*?)>/g, '<img$1 />'); // Self-closing imgs
html = html.replace(/<br>/g, '<br />'); // Self-closing br

function extractSection(regex, name, isClient = false) {
  const match = html.match(regex);
  if (!match) {
    console.log(`Failed to extract ${name}`);
    return;
  }
  let content = match[0];
  let fileContent = '';
  if (isClient) {
    fileContent += `'use client';\n`;
  }
  fileContent += `export function ${name}() {\n  return (\n    ${content}\n  );\n}\n`;
  fs.writeFileSync(path.join(outDir, `${name}.tsx`), fileContent);
  console.log(`Created ${name}.tsx`);
}

extractSection(/<nav className="nav">[\s\S]*?<\/nav>/, 'Navigation');
extractSection(/<header className="hero">[\s\S]*?<\/header>/, 'Hero');
extractSection(/<div className="product-stage">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, 'ProductDemo');
// The rest of the sections:
// They are mostly `<section id="...">` or `<section className="...">`
extractSection(/<section id="service"[\s\S]*?<\/section>/, 'ServicePlatform');
extractSection(/<section id="workforce"[\s\S]*?<\/section>/, 'Workforce');
// UseCases has client side logic so we'll do it manually
extractSection(/<section className="problem-section" id="platform">[\s\S]*?<\/section>/, 'Platform');
extractSection(/<section className="integrations-section" id="integrations">[\s\S]*?<\/section>/, 'Integrations');
extractSection(/<section id="enterprise"[\s\S]*?<\/section>/, 'Enterprise');
extractSection(/<section className="brand-system" id="brand">[\s\S]*?<\/section>/, 'BrandSystem');
extractSection(/<section className="cta-section">[\s\S]*?<\/section>/, 'Cta');
extractSection(/<footer[\s\S]*?<\/footer>/, 'Footer');

console.log("Done extracting components.");
