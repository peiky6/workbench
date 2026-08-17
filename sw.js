// PWA 离线缓存 v6：导航请求（打开页面）优先网络，并带 cache:'reload' 绕过 HTTP 缓存，
// 确保每次打开都拿到 GitHub Pages 上的最新 index.html（彻底解决「改了却看不到更新」）；
// 当网络失败 或 返回非 200（403/504/5xx 等服务器错误）时，回退到已缓存的 index.html，
// 保证即使部署服务临时宕机，App 也一定能打开（用缓存版本，本地数据不丢）。
// 每次部署改缓存名 → 强制重新预缓存最新 index.html；activate 时通知页面「已更新」。
const CACHE = 'qi-workbench-v20';
const FILES = ['index.html','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','icon-maskable-512.png'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()).then(()=>{
    return self.clients.matchAll({includeUncontrolled:true}).then(cs=>cs.forEach(c=>c.postMessage({type:'SW_UPDATED', cache:CACHE})));
  }));
});
self.addEventListener('fetch', e=>{
  if(e.request.method!=='GET') return;
  // 导航（打开页面）请求：网络可用且返回 200 才用网络；否则回退缓存，保证 App 打得开
  if(e.request.mode==='navigate'){
    e.respondWith(
      (async()=>{
        try{
          const res = await fetch(e.request, {cache:'reload'}); // 绕过 HTTP 缓存，确保拿到线上最新版
          if(res && res.ok){
            const copy = res.clone();
            caches.open(CACHE).then(c=>c.put(e.request, copy));
            return res;
          }
          throw new Error('bad status '+res.status);
        }catch(_){
          const cached = await caches.match('index.html') || await caches.match('./');
          if(cached) return cached;
          return new Response('离线缓存不可用，请联网后重试',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
        }
      })()
    );
    return;
  }
  // 静态资源：cache-first，后台静默更新
  e.respondWith(
    caches.match(e.request).then(hit=>{
      const net = fetch(e.request).then(res=>{
        if(res && res.status===200){
          const u = e.request.url;
          if(u.endsWith('index.html')||u.endsWith('/')||u.includes('manifest')||u.includes('icon')){
            const copy = res.clone(); caches.open(CACHE).then(c=>c.put(e.request, copy));
          }
        }
        return res;
      }).catch(()=>hit);
      return hit || net;
    })
  );
});
