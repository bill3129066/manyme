import { resolve } from 'node:path'
import { createPublicClient, http } from '../backend/node_modules/viem'
const root = resolve(import.meta.dir, '..')
if (!process.env.GEMINI_API_KEY)
  throw new Error('GEMINI_API_KEY required in root .env')
if (
  process.env.X402_MOCK !== 'false' ||
  process.env.ALLOW_UNVERIFIED_DEPOSITS !== 'false'
)
  throw new Error('Real payment/deposit verification required')
const rpc = createPublicClient({ transport: http(process.env.BASE_RPC_URL) })
if ((await rpc.getChainId()) !== 84532)
  throw new Error('This launcher only permits Base Sepolia')
if (
  !process.env.ESCROW_CONTRACT_ADDRESS ||
  !(await rpc.getCode({
    address: process.env.ESCROW_CONTRACT_ADDRESS as `0x${string}`,
  }))
)
  throw new Error('Deploy the escrow first')
const children = [
  Bun.spawn(['bun', 'run', 'src/server.ts'], {
    cwd: resolve(root, 'backend'),
    env: { ...process.env, PORT: '3001' },
    stdout: 'inherit',
    stderr: 'inherit',
  }),
  Bun.spawn(['pnpm', 'dev', '--hostname', '127.0.0.1'], {
    cwd: resolve(root, 'frontend'),
    env: { ...process.env, PORT: '3000' },
    stdout: 'inherit',
    stderr: 'inherit',
  }),
]
const stop = () => children.forEach((child) => child.kill())
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
try {
  await Promise.race(children.map((child) => child.exited))
} finally {
  stop()
}
