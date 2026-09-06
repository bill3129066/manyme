// Pinned Playwright CLI fixture: intercepts all payments; sends no real funds.
async (page) => {
 await page.unrouteAll()
 const encode = data => page.evaluate(value => btoa(JSON.stringify(value)), data)
 const wallet='0x1111111111111111111111111111111111111111'
 const tx='0x'+'33'.repeat(32)
 let signatures=0,paid=0
 await page.route('**/api/test-wallet',async route=>{
  const {method}=route.request().postDataJSON()
  let result=null
  if(method==='eth_requestAccounts'||method==='eth_accounts') result=[wallet]
  if(method==='eth_chainId') result='0x14a34'
  if(method==='eth_signTypedData_v4'){signatures++;result='0x'+'11'.repeat(65)}
  await route.fulfill({json:{result}})
 })
 await page.route('**/api/agents',route=>route.fulfill({headers:{'access-control-allow-origin':'*'},json:[{id:'summary-fixture',name:'測試服務'}]}))
 await page.route('**/queries/agent/summary-fixture/summary',async route=>{
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-expose-headers':'PAYMENT-REQUIRED,PAYMENT-RESPONSE'}
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
  if(route.request().headers()['payment-signature']){
   paid++
   return route.fulfill({headers:{...headers,'PAYMENT-RESPONSE':(await encode({success:true,transaction:tx,network:'eip155:84532'}))},json:{agentId:'summary-fixture',agentName:'測試服務',summary:'這是已取得的分析摘要。',timestamp:'2026-09-06'}})
  }
  return route.fulfill({status:402,headers:{...headers,'PAYMENT-REQUIRED':(await encode({x402Version:2,resource:{url:route.request().url(),description:'summary',mimeType:'application/json'},accepts:[{scheme:'exact',network:'eip155:84532',asset:'0x036CbD53842c5426634e7929541eC2318f3dCF7e',amount:'1000',payTo:'0x'+'22'.repeat(20),maxTimeoutSeconds:300,extra:{name:'USDC',version:'2'}}]}))},json:{error:'Payment Required'}})
 })
 await page.setViewportSize({width:1440,height:1000})
 await page.goto('http://localhost:3000/settings')
 await page.getByRole('heading',{name:'最近分析摘要',exact:true}).waitFor()
 if(!await page.getByRole('button',{name:'付 0.001 USDC，取得摘要'}).isDisabled())throw new Error('Disconnected purchase is enabled')
 await page.locator('.wallet-overview').getByText('開發測試錢包',{exact:true}).click()
 await page.locator('.wallet-overview').getByRole('button',{name:'連接測試使用者錢包',exact:true}).click()
 await page.getByRole('button',{name:'付 0.001 USDC，取得摘要'}).click()
 await page.getByText('這是已取得的分析摘要。',{exact:true}).waitFor()
 if(signatures!==1||paid!==1)throw new Error(`Unexpected payments ${paid}, signatures ${signatures}`)
 await page.screenshot({path:'/tmp/manyme-summary-desktop.png'})
 await page.setViewportSize({width:390,height:844})
 await page.getByRole('button',{name:'開啟選單',exact:true}).click()
 const mobileWallet=await page.locator('#mobile-nav').getByRole('link',{name:'我的錢包',exact:true}).getAttribute('href')
 await page.getByRole('button',{name:'關閉選單',exact:true}).click()
 await page.screenshot({path:'/tmp/manyme-summary-mobile.png',fullPage:true})
 return {signatures,paid,mobileWallet,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}
}
