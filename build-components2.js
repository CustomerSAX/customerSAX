const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'docs/marketing/index(6).html');
const outDir = path.join(__dirname, 'apps/marketing/src/components');

let html = fs.readFileSync(htmlPath, 'utf-8');
html = html.replace(/class=/g, 'className=');
html = html.replace(/<!--[\s\S]*?-->/g, ''); 
html = html.replace(/<img(.*?)>/g, '<img$1 />'); 
html = html.replace(/<br>/g, '<br />'); 

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

extractSection(/<section className="service-platform" id="service">[\s\S]*?<\/section>/, 'ServicePlatform');
extractSection(/<section className="workforce-section" id="workforce">[\s\S]*?<\/section>/, 'Workforce');
extractSection(/<section className="cta-section" id="demo">[\s\S]*?<\/section>/, 'Cta');
extractSection(/<section id="usecases" className="problem-section">[\s\S]*?<\/section>/, 'UseCases', true);

console.log("Done extracting remaining components.");
