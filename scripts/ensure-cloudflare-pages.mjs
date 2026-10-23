// Direct Upload project provisioning. Tokens stay in the process environment.
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!/^[a-f0-9]{32}$/i.test(account||''))throw Error('Set CLOUDFLARE_ACCOUNT_ID to your Cloudflare Account ID.');
if(!token)throw Error('Set the GitHub Actions secret CLOUDFLARE_API_TOKEN.');
const project='frigo-family-menu',base=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects`;
async function request(url,method='GET',body){
  const response=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
  const data=await response.json();return {response,data};
}
let {response,data}=await request(`${base}/${project}`);
if(response.status===404)({response,data}=await request(base,'POST',{name:project,production_branch:'main'}));
if(!response.ok||!data.success){
  // Log only numeric provider error codes, never headers, credentials or response bodies.
  throw Error(`Cloudflare Pages setup failed: HTTP ${response.status}, codes ${(data.errors||[]).map(e=>e.code).join(',')}. Check Account ID and Account / Cloudflare Pages / Edit permission.`);
}
console.log(`Cloudflare Pages project ready: https://${data.result.subdomain}`);
