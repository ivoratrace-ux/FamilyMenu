// Read-only readiness check. Invalid photo data is rejected before any OpenAI call.
import assert from 'node:assert/strict';
const base=(process.env.BACKEND_URL || 'https://vibe-coding-sc04.onrender.com').replace(/\/$/,'');
const parsed=new URL(base);
assert.ok(parsed.protocol==='https:' || parsed.protocol==='http:' && ['localhost','127.0.0.1'].includes(parsed.hostname),'Backend must use HTTPS (except loopback tests)');
const origin=process.env.PAGES_ORIGIN || 'https://ivoratrace-ux.github.io';
const expected=process.env.EXPECTED_REVISION;
let ready=false;
for(let attempt=0;attempt<30;attempt++) {
  try {
    const health=await fetch(`${base}/health`,{signal:AbortSignal.timeout(15000)});
    const body=await health.json();
    if(health.status===503 && body.status==='missing_api_key') throw Error('OPENAI_API_KEY is missing on the backend');
    if(health.status===200 && body.status==='ok' && body.service==='family-menu-api' && (!expected || body.revision===expected)) {ready=true;console.log(`FamilyMenu API ready: revision ${body.revision}`);break;}
  } catch(error) {if(error.message==='OPENAI_API_KEY is missing on the backend') throw error;}
  if(attempt<29) await new Promise(resolve=>setTimeout(resolve,2000));
}
assert.ok(ready,`FamilyMenu API did not become ready${expected ? ' at the expected revision '+expected : ''}`);
const options=await fetch(`${base}/api/fridge/scan`, {
  method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'},
  signal:AbortSignal.timeout(30000)
});
assert.equal(options.status,204,`CORS preflight failed (${options.status})`);
assert.equal(options.headers.get('access-control-allow-origin'),origin);
const invalid=await fetch(`${base}/api/fridge/scan`, {
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(30000)
});
assert.equal(invalid.status,400,`Scanner should reject an empty photo before calling OpenAI; received ${invalid.status}`);
assert.equal(invalid.headers.get('access-control-allow-origin'),origin);
console.log('Scanner route, validation, and FamilyMenu Pages CORS: OK. No photo or paid generation sent.');
