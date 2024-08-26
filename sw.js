const cacheName = "v1";
const filesToBeCached = [
	"/index.html",
	"/index.js",
	"/style.css",
	"/assets/favicon.ico",
	"/assets/dark-mode.svg",
	"/assets/light-mode.svg",
	"/assets/language.svg",
	"/assets/video.svg",
	"/assets/poster.jpg",
];

self.addEventListener("install", (e) => {
	e.waitUntil(
		(async () => {
			const cache = await caches.open(cacheName);
			await cache.addAll(filesToBeCached);
		})()
	);
});

self.addEventListener("fetch", (e) => {
	e.respondWith(
		(async () => {
			const r = await caches.match(e.request);
			if (r) {
				return r;
			}
			const response = await fetch(e.request);
			const cache = await caches.open(cacheName);
			cache.put(e.request, response.clone());
			return response;
		})()
	);
});
