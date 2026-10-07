#!/usr/bin/env node
// Run any command with a build variant's environment:
//   node scripts/with-variant.mjs <development|sandbox|production> <command> [args...]
import { spawnSync } from 'node:child_process'
import { variantEnv } from './variant.mjs'

const [variant, command, ...args] = process.argv.slice(2)
if (!variant || !command) {
  console.error('Usage: node scripts/with-variant.mjs <development|sandbox|production> <command> [args...]')
  process.exit(2)
}

let env
try {
  env = variantEnv(variant)
} catch (err) {
  console.error(err.message)
  process.exit(2)
}

const result = spawnSync(command, args, { stdio: 'inherit', env, shell: process.platform === 'win32' })
process.exit(result.status ?? 1)
