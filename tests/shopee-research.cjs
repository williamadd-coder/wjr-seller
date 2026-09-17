const { test }=require('node:test');
const assert=require('node:assert/strict');
const { join }=require('node:path');
const { researchShopeePublic,shopeeMoney,extractShopeeItems }=require(join(process.env.WJR_RESEARCH_TEST_DIR,'public-research.js'));
const { saveResearchEvidence }=require(join(process.env.WJR_RESEARCH_TEST_DIR,'research-evidence.js'));
const { researchMessage,isAutomaticResearch }=require(join(process.env.WJR_RESEARCH_TEST_DIR,'research-status.js'));
const { preserveResearchAttempt }=require(join(process.env.WJR_RESEARCH_TEST_DIR,'optimization-notes.js'));
const { mergeSuggestedAttributes,attributeKey }=require(join(process.env.WJR_RESEARCH_TEST_DIR,'attribute-merge.js'));
const seed={name:'Pista de Corrida Infantil com Garagem e 4 Carrinhos'};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status});
const row=(itemid,price)=>({item_basic:{itemid,shopid:10,name:seed.name,price}});
const empty=()=>response({items:[]});
const mock=(items)=>async url=>url.includes('/pdp/')?response({},503):response({items});

test('API access refusal is recorded and stops further requests',async()=>{
  let calls=0;
  const result=await researchShopeePublic(seed,{fetcher:async()=>{calls++;return response({error:90309999,redirect_to_error_page:true});}});
  assert.equal(result.data,null);assert.equal(result.attempt.status,'blocked');assert.equal(calls,1);
  assert.equal(result.attempt.diagnostics[0].code,'SHOPEE_90309999');
});
test('HTTP 403/429 are not empty search results',async()=>{
  for(const status of [403,429]) {const r=await researchShopeePublic(seed,{fetcher:async()=>response({},status)});assert.equal(r.attempt.status,'blocked');}
});
test('a valid empty response is distinguishable from unavailable HTML',async()=>{
  const emptyResult=await researchShopeePublic(seed,{fetcher:async()=>empty()});
  assert.equal(emptyResult.attempt.status,'no_matches');
  const unavailable=await researchShopeePublic(seed,{fetcher:async()=>new Response('<html><script src="app.js"></script></html>')});
  assert.equal(unavailable.attempt.status,'unavailable');assert.equal(unavailable.data,null);
});
test('timeout covers reading the response body and respects total budget',async()=>{
  const fetcher=async(_url,{signal})=>({ok:true,status:200,url:'',text:()=>new Promise((_,reject)=>{if(signal.aborted)reject(new Error('aborted'));else signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});})});
  const start=Date.now();const result=await researchShopeePublic(seed,{fetcher,timeoutMs:10,budgetMs:25});
  assert.equal(result.attempt.status,'timeout');assert.ok(Date.now()-start<500);
});
test('network failures do not claim there are no competitors',async()=>{
  const result=await researchShopeePublic(seed,{fetcher:async()=>{throw new Error('offline')}});
  assert.equal(result.attempt.status,'unavailable');
});
test('deduplicates, excludes unrelated offers, calculates min/median/max and keeps evidence when details fail',async()=>{
  const rows=[row(1,4490000),row(2,5990000),row(3,4990000),row(4,null),row(1,4490000),{item_basic:{itemid:8,shopid:10,name:'Cabo USB para celular',price:500000}}];
  const result=await researchShopeePublic(seed,{fetcher:mock(rows)});
  assert.equal(result.attempt.status,'completed');assert.equal(result.attempt.foundCount,5);
  assert.equal(result.attempt.comparableCount,4);assert.equal(result.attempt.pricedCount,3);
  assert.deepEqual([result.data.priceMin,result.data.priceMedian,result.data.priceMax],[44.9,49.9,59.9]);
  assert.equal(result.data.category,null);assert.deepEqual(result.data.attributes,{});
});
test('all Shopee API prices use the same units, even R$0.50 or R$1',()=>{
  assert.equal(shopeeMoney(50000),0.5);assert.equal(shopeeMoney(100000),1);
  for(const v of [null,0,-1,'bad',Infinity]) assert.equal(shopeeMoney(v),null);
});
test('HTML parser reads nested structured items but never guesses title/price from neighboring cards',()=>{
  const item=row(1,4490000).item_basic;
  const html=`<script type="application/json">${JSON.stringify({items:[{item_basic:{...item,extra:{nested:true}}}]})}</script>`;
  assert.equal(extractShopeeItems(html)[0].price,4490000);
  assert.deepEqual(extractShopeeItems('<a href="/product/10/1">item</a><div title="Another product">R$ 10,00</div>'),[]);
});
test('HTML fallback uses structured prices in their native units',async()=>{
  const result=await researchShopeePublic(seed,{fetcher:async url=>url.includes('/search?')?new Response(`<script type="application/json">${JSON.stringify({items:[row(1,100000).item_basic]})}</script>`):response({},503)});
  assert.equal(result.attempt.status,'completed');assert.equal(result.data.priceMin,1);assert.equal(result.data.source,'shopee_public_html');
});
test('save failure cannot be treated as research completion or drive price changes',async()=>{
  const result=await researchShopeePublic(seed,{fetcher:mock([row(1,4490000)])});
  const db={from:()=>({insert:()=>({select:()=>({single:async()=>({error:{code:'42501'},data:null})})})})};
  const saved=await saveResearchEvidence(db,'product',result);
  assert.equal(saved.attempt.status,'save_failed');assert.equal(saved.data,null);
});
test('failed searches do not overwrite previous analyses',async()=>{
  const outcome=await researchShopeePublic(seed,{fetcher:async()=>response({},403)});
  const db={from:()=>{throw new Error('must not write')}};
  assert.equal(await saveResearchEvidence(db,'product',outcome),outcome);
});
test('successful insert records count, source and timestamp only after confirmation',async()=>{
  let payload;
  const outcome=await researchShopeePublic(seed,{fetcher:mock([row(1,4490000)])});
  const db={from:()=>({insert:value=>{payload=value;return{select:()=>({single:async()=>({data:{id:'analysis'},error:null})})}}})};
  const result=await saveResearchEvidence(db,'product',outcome);
  assert.equal(result.attempt.status,'completed');assert.equal(payload.competitor_patterns.priced_sample_size,1);
  assert.ok(payload.competitor_patterns.research_attempt.checkedAt);assert.equal(payload.source,'shopee_public_api');
});
test('manual evidence is not labeled automatic and errors have distinct messages',()=>{
  assert.equal(isAutomaticResearch('seller_studio_manual_evidence'),false);assert.equal(isAutomaticResearch('shopee_public_api'),true);
  const statuses=['blocked','timeout','no_matches','unavailable','save_failed'];
  assert.equal(new Set(statuses.map(status=>researchMessage({status}).title)).size,statuses.length);
});
test('a valid previous research attempt is preserved across a new optimization',()=>{
  const attempt={status:'completed',checkedAt:'2024-01-01T00:00:00.000Z',queries:['x'],foundCount:1,comparableCount:1,pricedCount:1,diagnostics:[]};
  const result=preserveResearchAttempt({publicResearchAttempt:attempt},{publicResearchExecuted:false});
  assert.deepEqual(result,{publicResearchExecuted:false,publicResearchAttempt:attempt});
});
test('null, array or incomplete previous research attempts are ignored',()=>{
  const next={publicResearchExecuted:false};
  assert.deepEqual(preserveResearchAttempt(null,next),next);
  assert.deepEqual(preserveResearchAttempt({publicResearchAttempt:null},next),next);
  assert.deepEqual(preserveResearchAttempt({publicResearchAttempt:[]},next),next);
  assert.deepEqual(preserveResearchAttempt({publicResearchAttempt:{status:'completed'}},next),next);
  assert.deepEqual(preserveResearchAttempt({publicResearchAttempt:{checkedAt:'2024-01-01T00:00:00.000Z'}},next),next);
});
test('suggested attributes never duplicate what the generator already wrote, in any casing or synonym',()=>{
  const current={marca:'BasicWear',modelo:'CB-100',ean:'7899999998881'};
  const merged=mergeSuggestedAttributes(current,[
    {name:'Marca',value:'BasicWear'},
    {name:'Modelo',value:'CB-100'},
    {name:'Código de barras (EAN/GTIN)',value:'7899999998881'},
    {name:'Gênero',value:'Masculino'},
  ]);
  assert.deepEqual(merged,{...current,'Gênero':'Masculino'});
});
test('suggested attributes without a value, or duplicated among themselves, are ignored',()=>{
  const merged=mergeSuggestedAttributes({},[
    {name:'Tamanho',value:''},
    {name:'  ',value:'G'},
    {name:'Cor',value:'Azul'},
    {name:'cor',value:'Verde'},
  ]);
  assert.deepEqual(merged,{Cor:'Azul'});
});
test('attribute keys ignore case, accents and punctuation',()=>{
  assert.equal(attributeKey('Gênero'),attributeKey('genero'));
  assert.equal(attributeKey('Tipo de gola'),attributeKey('tipo-de-gola'));
  assert.equal(attributeKey('brand'),attributeKey('Marca'));
  assert.notEqual(attributeKey('Cor'),attributeKey('Tamanho'));
});
test('the default research message says research has not run yet, not that it failed or was incomplete',()=>{
  const message=researchMessage(undefined);
  assert.match(message.title,/não executada/);
  assert.doesNotMatch(message.title,/não concluída/);
  assert.doesNotMatch(message.title,/falha/);
  assert.doesNotMatch(message.detail,/não concluída/);
  assert.doesNotMatch(message.detail,/falha/);
});
