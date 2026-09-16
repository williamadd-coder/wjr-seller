const { test }=require('node:test');
const assert=require('node:assert/strict');
const { join }=require('node:path');
const { researchShopeePublic,shopeeMoney,extractShopeeItems }=require(join(process.env.WJR_RESEARCH_TEST_DIR,'public-research.js'));
const { saveResearchEvidence }=require(join(process.env.WJR_RESEARCH_TEST_DIR,'research-evidence.js'));
const { researchMessage,isAutomaticResearch }=require(join(process.env.WJR_RESEARCH_TEST_DIR,'research-status.js'));
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

const {researchShopeeIndex,shopeeProductUrl,indexedPrice}=require(join(process.env.WJR_RESEARCH_TEST_DIR,'indexed-research.js'));
const {researchShopeeMarket}=require(join(process.env.WJR_RESEARCH_TEST_DIR,'market-research.js'));
test('index accepts product URLs only and strips tracking parameters',()=>{
  assert.equal(shopeeProductUrl('https://shopee.com.br/Pista-i.10.20?tracking=abc').url,'https://shopee.com.br/product/10/20');
  for(const url of ['https://shopee.com.br.evil.test/product/10/20','https://evil.test/product/10/20','https://shopee.com.br/search?keyword=pista','https://shopee.com.br@evil.test/product/10/20','http://shopee.com.br/product/10/20']) assert.equal(shopeeProductUrl(url),null);
});
test('ambiguous, installment, shipping and coupon amounts are not reference prices',()=>{
  assert.equal(indexedPrice('Pista de corrida R$ 49,90').value,49.9);
  for(const s of ['12x R$ 4,99','Frete R$ 10,00','De R$ 99,00 por R$ 49,90','Cupom R$ 5,00','A partir de R$ 20,00','R$ 5,00 por mês']) assert.equal(indexedPrice(s),null);
});
test('one basic external search returns attributable offers without generating answers or live prices',async()=>{
  let count=0;
  const result=await researchShopeeIndex(seed,{apiKey:'test-key',fetcher:async(url,options)=>{
    count++;assert.equal(url,'https://api.tavily.com/search');assert.equal(options.redirect,'error');
    const body=JSON.parse(options.body);assert.equal(body.search_depth,'basic');assert.equal(body.include_answer,false);assert.equal(body.auto_parameters,false);assert.deepEqual(body.include_domains,['shopee.com.br']);
    return response({results:[{title:seed.name,url:'https://shopee.com.br/product/10/20',content:'Pista R$ 49,90'},{title:'Cabo USB',url:'https://shopee.com.br/product/10/30',content:'R$ 5,00'},{title:seed.name,url:'https://other.example/product/10/50',content:'R$ 99,00'}]});
  }});
  assert.equal(count,1);assert.equal(result.attempt.status,'completed');assert.equal(result.data.competitors.length,1);
  const c=result.data.competitors[0];assert.equal(c.indexedPrice,49.9);assert.equal(c.price,null);assert.equal(c.evidenceSource,'tavily_index');assert.ok(c.observedAt);assert.ok(c.priceEvidence);
  assert.equal(result.data.priceMedian,null);assert.equal(result.attempt.pricedCount,0);assert.deepEqual(result.data.attributes,{});
});
test('conflicting duplicate offers do not manufacture a price',async()=>{
  const result=await researchShopeeIndex(seed,{apiKey:'test',fetcher:async()=>response({results:[49,59].map(price=>({title:seed.name,url:'https://shopee.com.br/product/10/20',content:`R$ ${price},90`}))})});
  assert.equal(result.data.competitors.length,1);assert.equal(result.data.competitors[0].indexedPrice,null);
});
test('missing key makes no external request; provider authorization and quotas are distinct',async()=>{
  const missing=await researchShopeeIndex(seed,{apiKey:'',fetcher:async()=>{throw new Error('must not request')}});assert.equal(missing.attempt.status,'provider_not_configured');
  for(const [http,status] of [[401,'provider_auth_failed'],[429,'provider_limit'],[432,'provider_limit'],[433,'provider_limit'],[500,'unavailable']]) {
    const r=await researchShopeeIndex(seed,{apiKey:'test',fetcher:async()=>response({},http)});assert.equal(r.attempt.status,status);assert.equal(r.data,null);
  }
});
test('successful direct research never spends external search credits',async()=>{
  const directResult=await researchShopeePublic(seed,{fetcher:mock([row(1,4490000)])});
  const result=await researchShopeeMarket(seed,{direct:async()=>directResult,indexed:{apiKey:'test',fetcher:async()=>{throw new Error('must not request')}}});assert.equal(result,directResult);
});
test('direct restriction falls back to the index and preserves both diagnoses',async()=>{
  const blocked=await researchShopeePublic(seed,{fetcher:async()=>response({},403)});
  const result=await researchShopeeMarket(seed,{direct:async()=>blocked,indexed:{apiKey:'test',fetcher:async()=>response({results:[{title:seed.name,url:'https://shopee.com.br/product/10/20',content:'R$ 49,90'}]})}});
  assert.equal(result.attempt.status,'completed');assert.equal(result.attempt.diagnostics[0].status,'blocked');assert.equal(result.attempt.diagnostics.at(-1).source,'tavily_search');
  assert.equal(result.data.source,'shopee_indexed_tavily');
});
test('without a configured index the original error remains visible',async()=>{
  const blocked=await researchShopeePublic(seed,{fetcher:async()=>response({},403)});
  const result=await researchShopeeMarket(seed,{direct:async()=>blocked,indexed:{apiKey:''}});
  assert.equal(result.attempt.status,'blocked');assert.equal(result.attempt.diagnostics.at(-1).status,'provider_not_configured');
});
test('external timeout covers body consumption',async()=>{
  const r=await researchShopeeIndex(seed,{apiKey:'test',timeoutMs:10,fetcher:async(_url,{signal})=>({ok:true,json:()=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('timeout')),{once:true}))})});
  assert.equal(r.attempt.status,'timeout');assert.equal(r.data,null);
});
