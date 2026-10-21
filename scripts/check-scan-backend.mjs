// Read-only integration check. Invalid photo data is rejected before any OpenAI call.
import assert from 'node:assert/strict';
const base='https://vibe-coding-sc04.onrender.com';
const origin=process.env.PAGES_ORIGIN || 'https://ivoratrace-ux.github.io';
const options=await fetch(`${base}/api/fridge/scan`, {
  method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'},
  signal:AbortSignal.timeout(120000)
});
assert.equal(options.status,204,`CORS preflight failed (${options.status}). Add ${origin} to ALLOWED_ORIGINS on Render.`);
assert.equal(options.headers.get('access-control-allow-origin'),origin);
const invalid=await fetch(`${base}/api/fridge/scan`, {
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(30000)
});
assert.equal(invalid.status,400,`Scanner should reject an empty photo before calling OpenAI; received ${invalid.status}.`);
assert.equal(invalid.headers.get('access-control-allow-origin'),origin);
console.log('Scanner route, input validation, and FamilyMenu Pages CORS: OK. No photo or paid generation sent.');
