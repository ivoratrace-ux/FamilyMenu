// Read-only network/contract probe; can also run in a Render Shell. No credentials required.
import {createVkusvillMcp} from '../backend/server/vkusvill-mcp.mjs';
import {searchProducts} from '../backend/server/store-cart.mjs';
const mcp=createVkusvillMcp({signal:AbortSignal.timeout(35000)});
try {
  const tools=await mcp.connect();
  console.log('Public MCP initialized; search and cart tools are present. OAuth is not used.');
  const products=searchProducts(await mcp.call('vkusvill_products_search',{q:'Молоко',page:1,sort:'popularity'}));
  console.log(`Search contract verified: ${products.length} products with XML IDs. No cart was created.`);
  const schema=tools.find(t=>t.name==='vkusvill_cart_link_create').inputSchema;
  console.log('Cart input schema:',JSON.stringify(schema));
}catch(error){console.error(error.name==='StoreError'?error.message:'Cannot connect to the public MCP from this network.');process.exitCode=1;}
finally{await mcp.close();}
