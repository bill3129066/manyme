import {
  generatePrivateKey,
  privateKeyToAccount,
} from '../../backend/node_modules/viem/accounts'
import { chmodSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const root = resolve(import.meta.dir, '../..')
const path = resolve(root, '.env')
let env = readFileSync(path, 'utf8')
function put(name: string, value: string) {
  const re = new RegExp(`^${name}=.*$`, 'm')
  env = re.test(env)
    ? env.replace(re, `${name}=${value}`)
    : `${env}\n${name}=${value}\n`
}
function key(name: string) {
  const existing = env.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim()
  const value = existing || generatePrivateKey()
  put(name, value)
  return privateKeyToAccount(value as `0x${string}`)
}
const platform = key('PLATFORM_OPERATOR_KEY')
const payer = key('TEST_PAYER_PRIVATE_KEY')
const author = key('TEST_AUTHOR_PRIVATE_KEY')
put('PLATFORM_WALLET', platform.address)
put('PLATFORM_OPERATOR', platform.address)
put('DEPLOYER_PRIVATE_KEY', env.match(/^PLATFORM_OPERATOR_KEY=(.*)$/m)![1])
put('BASE_CHAIN_ID', '84532')
put('X402_MOCK', 'false')
put('ALLOW_UNVERIFIED_DEPOSITS', 'false')
writeFileSync(path, env)
chmodSync(path, 0o600)
console.log(
  JSON.stringify(
    {
      chainId: 84532,
      platform: platform.address,
      payer: payer.address,
      author: author.address,
    },
    null,
    2,
  ),
)
