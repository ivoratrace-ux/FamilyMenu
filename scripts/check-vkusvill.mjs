// Read-only network/contract probe; can also run in a Render Shell. No credentials required.
import {createVkusvillMcp,cartUrl} from '../backend/server/vkusvill-mcp.mjs';
import {searchProducts} from '../backend/server/store-cart.mjs';
const mcp=createVkusvillMcp({signal:AbortSignal.timeout(35000),fetchImpl:async(url,options)=>{
  const response=await fetch(url,options);
  console.log(`MCP ${options.method}: HTTP ${response.status}; content-type=${response.headers.get('content-type') || '(none)'}; auth-challenge=${response.headers.has('www-authenticate')?'present':'absent'}`);
  if(response.status===403){
    const text=await response.clone().text();
    const supportId=/Reason or support ID:\s*([a-zA-Z0-9-]+)/.exec(text)?.[1];
    if(supportId)console.log('Access Blocked support ID:',supportId);
  }
  return response;
}});
try {
  const tools=await mcp.connect();
  console.log('Public MCP initialized; search and cart tools are present. OAuth is not used.');
  const schema=tools.find(t=>t.name==='vkusvill_cart_link_create').inputSchema;
  console.log('Cart input schema:',JSON.stringify(schema));
  const data=await mcp.call('vkusvill_products_search',{q:'Молоко',page:1,sort:'popularity'});
  console.log('Public search response sample:',JSON.stringify(data).slice(0,4000));
  const products=searchProducts(data);
  console.log(`Search contract verified: ${products.length} products with store IDs.`);
  if(process.env.VKUSVILL_PROBE_CART==='true' || process.argv.includes('--cart')){
    if(!products.length)throw Error('No milk candidates for the anonymous basket test');
    const result=await mcp.call('vkusvill_cart_link_create',{products:[{id:products[0].productId,q:1}]});
    console.log('Anonymous milk basket response:',JSON.stringify(result).slice(0,4000));
    console.log('Verified basket URL:',cartUrl(result));
  }
}catch(error){console.error(error.name==='StoreError'?error.message:'Cannot connect to the public MCP from this network.');process.exitCode=1;}
finally{await mcp.close();}
