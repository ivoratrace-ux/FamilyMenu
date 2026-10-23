import test from 'node:test';
import assert from 'node:assert/strict';
import {probeLavka} from '../server/lavka-research.mjs';
test('Render probe creates and transfers only its own anonymous test cart; tokens never appear in the report',async()=>{
  const requests=[];let homes=0,gets=0;
  const report=await probeLavka({fetchImpl:async(url,options)=>{
    requests.push(url);assert.equal(options.headers.Authorization,undefined);
    if(url==='https://lavka.yandex.ru/'){
      homes++;assert.equal(options.headers.Cookie,undefined,'Recipient must start in a separate session');
      return new Response('<script id="__page_props__-data">'+JSON.stringify({csrfToken:'csrf-private',authProxyCsrfToken:'proxy-private'})+'</script>',{headers:{'Set-Cookie':'anonymous='+homes+'; Path=/','Content-Type':'text/html'}});
    }
    assert.equal(options.headers['X-Csrf-Token-Bff'],'csrf-private');
    assert.match(options.headers.Cookie,/anonymous=[12]/);
    const body=JSON.parse(options.body);
    if(url.endsWith('/search/v3/lavka'))return Response.json({cacheProducts:[{id:'milk',title:'Моло\u00adко',currentPrice:98}]});
    if(url.endsWith('/shared/retrieve')){assert.equal(options.headers.Cookie,'anonymous=2');assert.equal(body.sharedCartId,'source-id');return Response.json({items:[{id:'milk',quantity:'1'}]});}
    if(url.endsWith('/cart/v1/retrieve'))return Response.json({cartId:++gets===1?'source-id':'target-id',items:[],cartVersion:1});
    if(url.endsWith('/cart/v1/update')){assert.equal(body.items.length,1);assert.equal(body.items[0].id,'milk');return Response.json({items:body.items});}
    assert.fail('Unexpected endpoint');
  }});
  assert.equal(report.status,'ok');assert.equal(report.independentRecipient,true);assert.equal(report.product,'Молоко');
  assert.equal(report.link,'https://lavka.yandex.ru/cart?sharedCartId=source-id&countryCode=RU');
  assert.doesNotMatch(JSON.stringify(report),/csrf-private|proxy-private|anonymous=/);
  assert.ok(!requests.some(url=>/order|payment|checkout|submit/.test(url)));
  assert.equal(requests.length,8);
});
test('a blocked Render network produces a safe stage report and stops before creating a basket',async()=>{
  let called=0;
  const report=await probeLavka({fetchImpl:async()=>{called++;return new Response('<html>private challenge</html>',{status:403,headers:{'Content-Type':'text/html'}});}});
  assert.equal(report.status,'error');assert.equal(report.error.stage,'source_home');assert.equal(report.error.httpStatus,403);assert.equal(called,1);
  assert.doesNotMatch(JSON.stringify(report),/private challenge/);
});
