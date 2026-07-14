#!/usr/bin/env node
// Pre-build gate for build:development / build:qa / build:production.
//
// Vite loads .env.local for every mode, so an environment-specific build can
// silently succeed using another environment's leftover local values instead of
// its own. This script requires .env.{mode} or .env.{mode}.local to exist and to
// independently define real, non-placeholder values for every required key —
// closing that gap before vite build ever runs.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REQUIRED_KEYS = ['VITE_AZURE_CLIENT_ID', 'VITE_AZURE_TENANT_ID', 'VITE_AZURE_API_SCOPE'];

const mode = process.argv[2];
if (!mode) {
  console.error('[check-env] Uso: node scripts/check-env.mjs <development|qa|production>');
  process.exit(1);
}

function parseEnvFile(content) {
  const values = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function isPlaceholder(value) {
  return value.includes('<') || value.includes('>') || value.includes('...');
}

const candidates = [`.env.${mode}`, `.env.${mode}.local`];
const foundFile = candidates.find(f => existsSync(resolve(process.cwd(), f)));

if (!foundFile) {
  console.error(`\n[check-env] ERROR: no se encontró ${candidates.join(' ni ')} para el ambiente "${mode}".`);
  console.error(
    `[check-env] Copiá .env.${mode}.example a .env.${mode}, completá los valores reales del ` +
    `App Registration de "${mode}" en Entra ID, y volvé a compilar.\n`,
  );
  process.exit(1);
}

const parsed = parseEnvFile(readFileSync(resolve(process.cwd(), foundFile), 'utf8'));
const problems = [];

for (const key of REQUIRED_KEYS) {
  const value = parsed[key];
  if (value === undefined || value.trim() === '') {
    problems.push(`${key} está vacía o no definida en ${foundFile}.`);
  } else if (isPlaceholder(value)) {
    problems.push(`${key}="${value}" en ${foundFile} parece un placeholder sin reemplazar.`);
  }
}

if (problems.length > 0) {
  console.error(`\n[check-env] ERROR: configuración inválida en ${foundFile} para el ambiente "${mode}":`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('');
  process.exit(1);
}

console.log(`[check-env] OK — ${foundFile} tiene configuración válida para "${mode}".`);
