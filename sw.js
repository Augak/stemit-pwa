const CACHE="stemit-studio-v4";
const CORE=["./","./index.html","./styles.css","./app.js","./manifest.webmanifest","./icons/stemit.svg"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const url=new URL(event.request.url);
 if(url.origin!==location.origin)return;
 const isPage=event.request.mode==="navigate"||url.pathname.endsWith(".html")||url.pathname.endsWith(".css")||url.pathname.endsWith(".js")||url.pathname.endsWith(".webmanifest");
 if(isPage){
  event.respondWith(fetch(event.request,{cache:"no-cache"}).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
   return response;
  }).catch(()=>caches.match(event.request).then(hit=>hit||caches.match("./index.html"))));
 }else{
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
   return response;
  })));
 }
});