// Retire only the previous V6 app cache; never touch journal/IndexedDB/localStorage.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const scope=self.registration.scope;
 for(const key of await caches.keys())if(key.startsWith('workbox-')&&key.includes(scope))await caches.delete(key);
 await self.clients.claim();await self.registration.unregister();
 for(const client of await self.clients.matchAll({type:'window'}))if(client.url.startsWith(scope))await client.navigate(client.url);
})()));
