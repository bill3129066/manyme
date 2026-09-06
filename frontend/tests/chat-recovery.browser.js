// Run with the pinned playwright_cli.sh run-code --filename=frontend/tests/chat-recovery.browser.js.
// Browser-only fixtures intercept every API and wallet request; no transactions are sent.
async (page) => {
  await page.unrouteAll()
  const wallet = '0x1111111111111111111111111111111111111111'
  const session = {id:'recovery-fixture',agent_id:'fixture-agent',onchain_session_id:1,status:'active',accrued_total:1,total_rate:301,curator_rate:1,platform_fee:300,started_at:new Date().toISOString(),steps:[],proofs:[],executions:[]}
  let walletWrites=0, signatures=0, chats=0
  await page.route('**/api/**',async route=>{
    const req=route.request(),path='/api/'+req.url().split('/api/')[1].split('?')[0]
    const body=req.method()==='POST'?req.postDataJSON():{}
    const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)})
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}})
    if(path==='/api/test-wallet') {
      if(body.method==='eth_accounts'||body.method==='eth_requestAccounts')return json({result:[wallet]})
      if(body.method==='eth_chainId')return json({result:'0x14a34'})
      if(body.method==='eth_sendTransaction'){walletWrites++;return json({error:'Fixture prevents transactions'},400)}
      if(body.method==='personal_sign'){signatures++;return json({error:'Unexpected signature'},400)}
      return json({result:null})
    }
    if(path==='/api/auth/session')return json({wallet,token:'fixture-token',expiresAt:Math.floor(Date.now()/1000)+3600})
    if(path.endsWith('/chat')){chats++;return chats===1?json({error:'Failed to fetch provider response'},503):json({reply:'收到追問，接著討論。'})}
    if(path.endsWith('/stream'))return route.fulfill({contentType:'text/event-stream',body:'event: connected\ndata: {}\n\n'})
    if(path==='/api/sessions/recovery-fixture')return json(session)
    if(path==='/api/agents/fixture-agent')return json({name:'恢復測試'})
    return json({error:'Fixture rejects unplanned request'},400)
  })
  await page.goto('http://localhost:3000/sessions/recovery-fixture',{waitUntil:'domcontentloaded'})
  await page.locator('.wallet-menu summary').click()
  const testMenu=page.getByText('開發測試錢包',{exact:true});if(await testMenu.count())await testMenu.click()
  await page.getByRole('button',{name:'連接測試使用者錢包',exact:true}).click()
  await page.evaluate(({wallet})=>sessionStorage.setItem('manyme.auth-session:'+wallet,JSON.stringify({wallet,token:'fixture-token',expiresAt:Math.floor(Date.now()/1000)+3600})),{wallet})
  await page.getByLabel('你的訊息').fill('接著討論')
  await page.getByRole('button',{name:'送出',exact:true}).click()
  await page.locator('.chat-message-error').waitFor()
  await page.waitForTimeout(1200)
  if(walletWrites!==0||signatures!==0)throw new Error(`REGRESSION: chat failure requested ${walletWrites} transactions and ${signatures} signatures`)
  if(await page.getByRole('dialog').count())throw new Error('REGRESSION: failed follow-up opened settlement')
  await page.getByLabel('你的訊息').fill('再試一次')
  await page.getByRole('button',{name:'送出',exact:true}).click()
  await page.getByText('收到追問，接著討論。',{exact:true}).waitFor()
  return {walletWrites,signatures,chats,recovered:true}
}
