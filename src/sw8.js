/* Frigo: shows cooking-timer notifications; a tap brings the app back. No caching. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>list.length?list[0].focus():self.clients.openWindow('../')));});
