import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

const prismaCli = path.resolve('node_modules', 'prisma', 'build', 'index.js')

const args = process.argv.slice(2)

const child = spawn(process.execPath, [prismaCli, ...args], {
  stdio: 'inherit',
  shell: false,
  env: process.env,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
