// Public Streamable HTTP MCP. No customer credentials, cookies or OAuth tokens.
export const VKUSVILL_MCP_URL = 'https://mcp.vkusvill.ru/mcp';
export class StoreError extends Error {
  constructor(status,message) { super(message); this.name='StoreError'; this.status=status; }
}
const unavailable=()=>new StoreError(502,'ВкусВилл сейчас недоступен. Попробуйте позже.');

async function boundedText(response) {
  const reader=response.body.getReader();let size=0,text='';const decoder=new TextDecoder();
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000)throw unavailable();text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}
  finally {await reader.cancel().catch(()=>{});}
}
async function rpcResult(response,id) {
  if(!response.headers.get('content-type')?.includes('text/event-stream'))return JSON.parse(await boundedText(response));
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',size=0;
  function parse(event) {
    const data=event.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
    if(!data)return;
    const message=JSON.parse(data);if(message.id===id)return message;
  }
  try {
    while(true) {
      const {done,value}=await reader.read();if(done){const last=parse(buffer);if(last)return last;throw unavailable();}
      size+=value.length;if(size>2_000_000)throw unavailable();buffer+=decoder.decode(value,{stream:true});buffer=buffer.replace(/\r\n/g,'\n');
      let end;while((end=buffer.indexOf('\n\n'))>=0){const message=parse(buffer.slice(0,end));buffer=buffer.slice(end+2);if(message)return message;}
    }
  } finally {await reader.cancel().catch(()=>{});}
}
export function toolData(result) {
  if(result?.isError)throw unavailable();
  if(result?.structuredContent)return result.structuredContent;
  const text=result?.content?.filter(x=>x.type==='text').map(x=>x.text).join('\n');
  if(!text)throw unavailable();
  try{return JSON.parse(text);}catch{return text;}
}
export function safeCartUrl(value) {
  try {
    const url=new URL(value);
    if(url.protocol!=='https:' || url.username || url.password || url.port)return null;
    if(url.hostname==='vkusvill.ru' || url.hostname.endsWith('.vkusvill.ru') || url.hostname==='vkusvill.onelink.me')return url.href;
  }catch{}
  return null;
}
export function cartUrl(data) {
  // Only return a URL actually supplied by the cart tool, never one invented by a model.
  function find(value) {
    if(typeof value==='string') {
      for(const match of value.matchAll(/https:\/\/[^\s<>"'\]\)]+/g)){const url=safeCartUrl(match[0]);if(url)return url;}
    } else if(value && typeof value==='object') {
      for(const child of Object.values(value)){const url=find(child);if(url)return url;}
    }
    return null;
  }
  const url=find(data);if(!url)throw unavailable();return url;
}
export function createVkusvillMcp({fetchImpl=fetch,signal=AbortSignal.timeout(150000)}={}) {
  let nextId=0,session,version='2025-03-26';
  async function rpc(method,params,notification=false) {
    const id=notification?undefined:++nextId;
    const response=await fetchImpl(VKUSVILL_MCP_URL,{method:'POST',redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(25000)]),
      headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...(session?{'Mcp-Session-Id':session}:{}),'MCP-Protocol-Version':version},
      body:JSON.stringify({jsonrpc:'2.0',...(notification?{}:{id}),method,params})});
    if(!response.ok) {
      await response.body?.cancel().catch(()=>{});
      if(response.status===403)throw new StoreError(502,'ВкусВилл отклонил подключение к публичному каталогу. Попробуйте позже.');
      if(response.status===429)throw new StoreError(503,'ВкусВилл ограничил число запросов. Попробуйте позже.');
      throw unavailable();
    }
    const received=response.headers.get('mcp-session-id');
    if(received){if(received.length>200 || /[\r\n]/.test(received))throw unavailable();session=received;}
    if(notification){await response.body?.cancel().catch(()=>{});return;}
    const message=await rpcResult(response,id);
    if(message.jsonrpc!=='2.0' || message.id!==id || message.error || !message.result)throw unavailable();
    return message.result;
  }
  return {
    async connect() {
      const init=await rpc('initialize',{protocolVersion:version,capabilities:{},clientInfo:{name:'FamilyMenu',version:'1.0'}});
      if(!['2024-11-05','2025-03-26','2025-06-18'].includes(init.protocolVersion))throw unavailable();version=init.protocolVersion;
      await rpc('notifications/initialized',{},true);
      const tools=[];let cursor,pages=0;
      do {const page=await rpc('tools/list',cursor?{cursor}:{});if(!Array.isArray(page.tools))throw unavailable();tools.push(...page.tools);cursor=page.nextCursor;if(tools.length>100 || ++pages>10)throw unavailable();}while(cursor);
      for(const name of ['vkusvill_products_search','vkusvill_cart_link_create'])if(!tools.some(t=>t.name===name))throw unavailable();
      return tools;
    },
    async call(name,args){return toolData(await rpc('tools/call',{name,arguments:args}));},
    async close(){if(session)try{const response=await fetchImpl(VKUSVILL_MCP_URL,{method:'DELETE',redirect:'error',headers:{'Mcp-Session-Id':session,'MCP-Protocol-Version':version},signal:AbortSignal.timeout(3000)});await response.body?.cancel();}catch{}}
  };
}

// Independent dependency health; no customer data, search, cart or model calls.
// Cache and coalesce probes so public health checks cannot flood the upstream.
export function createVkusvillHealth({mcpFactory=createVkusvillMcp,now=Date.now}={}) {
  let pending=null,expires=0;
  return function check() {
    if(pending && now()<expires)return pending;
    expires=now()+60000;
    pending=(async()=>{
      const mcp=mcpFactory({signal:AbortSignal.timeout(10000)});
      try {await mcp.connect();return true;}catch{return false;}
      finally {await mcp.close();}
    })();
    return pending;
  };
}
