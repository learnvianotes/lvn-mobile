import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parseEnv } from 'node:util'

export const VARIANTS = ['development', 'sandbox', 'production']

const root = path.resolve(import.meta.dirname, '..')

/**
 * Environment for one build variant: env/<variant>.env, then the git-ignored env/<variant>.local.env.
 * Variant values win over the calling shell so a build is reproducible from the repo alone.
 */
export function variantEnv(variant) {
  if (!VARIANTS.includes(variant)) {
    throw new Error(`Unknown variant "${variant}". Use one of: ${VARIANTS.join(', ')}`)
  }
  const files = [`env/${variant}.env`, `env/${variant}.local.env`].map((f) => path.join(root, f))
  const fromFiles = Object.assign({}, ...files.filter(existsSync).map((f) => parseEnv(readFileSync(f, 'utf8'))))
  return { ...process.env, ...fromFiles }
}
