// Compile contracts/Sweeper.sol into contracts/Sweeper.json (abi + bytecode).
// Run: npm run sweeper:build
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'contracts', 'Sweeper.sol');
const OUT_DIR = path.join(ROOT, 'contracts');
const OUT = path.join(OUT_DIR, 'Sweeper.json');

const source = readFileSync(SRC, 'utf8');

const input = {
  language: 'Solidity',
  sources: { 'Sweeper.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
    evmVersion: 'paris',
  },
};

const out = JSON.parse(solc.compile(JSON.stringify(input)));
if (out.errors) {
  const fatal = out.errors.filter((e) => e.severity === 'error');
  for (const e of out.errors) console.error(e.formattedMessage);
  if (fatal.length) process.exit(1);
}

const contract = out.contracts['Sweeper.sol']['Sweeper'];
const artifact = {
  contractName: 'Sweeper',
  abi: contract.abi,
  bytecode: '0x' + contract.evm.bytecode.object,
  deployedBytecode: '0x' + contract.evm.deployedBytecode.object,
  compiler: { name: 'solc', version: solc.version() },
  compiledAt: new Date().toISOString(),
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(artifact, null, 2));
console.log(`Wrote ${path.relative(ROOT, OUT)}  (${artifact.bytecode.length / 2 - 1} bytes deployable)`);
