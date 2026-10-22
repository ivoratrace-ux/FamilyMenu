import {createApp as realApp} from '../server/app.mjs';
export const testUser={id:'9d1c6cdc-9976-4630-b1f2-732000d6f002',email:'user@example.com'};
export const createApp=(options={})=>realApp({auth:{getUser:async()=>testUser},...options});
export const fetch=(url,options={})=>globalThis.fetch(url,{...options,headers:{Authorization:'Bearer test-token',...options.headers}});
