var CACHE_NAME = "gih-cache-v5";
var CACHED_URLS = [
  // Our HTML
  "/index.html",
  "/my-account.html",
  // Stylesheets
  "/css/gih.css",
  "https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css",
  "https://fonts.googleapis.com/css?family=Lato:300,600,900",
  // JavaScript
  "https://code.jquery.com/jquery-3.0.0.min.js",
  "/js/app.js",
  "/js/offline-map.js",
  "/js/my-account.js",
  "/js/reservations-store.js",
  // Images
  "/img/logo.png",
  "/img/logo-header.png",
  "/img/event-calendar-link.jpg",
  "/img/switch.png",
  "/img/logo-top-background.png",
  "/img/jumbo-background-sm.jpg",
  "/img/jumbo-background.jpg",
  "/img/reservation-gih.jpg",
  "/img/about-hotel-spa.jpg",
  "/img/about-hotel-luxury.jpg",
  "/img/event-default.jpg",
  "/img/map-offline.jpg",
  // JSON
  "/events.json",
  "/reservations.json",
  // UI KITT
  "/js/vendor/progressive-ui-kitt/themes/flat.css",
  "/js/vendor/progressive-ui-kitt/progressive-ui-kitt.js",
];
var googleMapsAPIJS = "https://maps.googleapis.com/maps/api/js?key="+
  "AIzaSyDm9jndhfbcWByQnrivoaWAEQA8jy3COdE&callback=initMap";

importScripts("/js/reservations-store.js");
importScripts("/js/vendor/progressive-ui-kitt/progressive-ui-kitt-sw-helper.js");

self.addEventListener("install", function(event) {
  // Cache everything in CACHED_URLS. Installation fails if anything fails to cache
  event.waitUntil(caches.open(CACHE_NAME).then(function(cache) {
    return cache.addAll(CACHED_URLS);
  }).then(function(){
    ProgressiveKITT.addMessage("Caching complete! Future visits will work offline.", {
      hideAfter:2000
    });
    return self.clients.matchAll({
      includeUncontrolled: true
    });
  }).then(function(clients){
    clients.forEach(function(client){
      client.postMessage("caching-complete");
    });
  }));
});

self.addEventListener("fetch", function(event) {
  var requestURL = new URL(event.request.url);
  // Handle requests for index.html
  if (requestURL.pathname === "/" || requestURL.pathname === "/index.html") {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match("/index.html").then(function(cachedResponse) {
          var fetchPromise = fetch("/index.html").then(function(networkResponse) {
            cache.put("/index.html", networkResponse.clone());
            return networkResponse;
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
  // Handle requests for my account page
  } else if (requestURL.pathname === "/my-account") {
    event.respondWith(
      caches.match("/my-account.html").then(function(response) {
        return response || fetch("/my-account.html");
      })
    );
  // Handle requests for reservations JSON file
  } else if (requestURL.pathname === "/reservations.json") {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return fetch(event.request).then(function(networkResponse) {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }).catch(function() {
          return caches.match(event.request);
        });
      })
    );
  // Handle requests for Google Maps JavaScript API file
  } else if (requestURL.href === googleMapsAPIJS) {
    event.respondWith(
      fetch(
        googleMapsAPIJS+"&"+Date.now(),
        { mode: "no-cors", cache: "no-store" }
      ).catch(function() {
        return caches.match("/js/offline-map.js");
      })
    );
  // Handle requests for events JSON file
  } else if (requestURL.pathname === "/events.json") {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return fetch(event.request).then(function(networkResponse) {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }).catch(function() {
          ProgressiveKITT.addAlert("Your are currently offline. The content of this page my be out of date.");
          // self.clients.get(event.clientId).then(function(client){
          //   client.postMessage("events-returned-from-cache");
          // });
          return caches.match(event.request);
        });
      })
    );
  // Handle requests for event images.
  } else if (requestURL.pathname.startsWith("/img/event-")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request).then(function(cacheResponse) {
          return cacheResponse||fetch(event.request).then(function(networkResponse) {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }).catch(function() {
            return cache.match("/img/event-default.jpg");
          });
        });
      })
    );
  // Handle analytics requests
  } else if (requestURL.host === "www.google-analytics.com") {
    event.respondWith(fetch(event.request));
  // Handle requests for files cached during installation
  } else if (
    CACHED_URLS.includes(requestURL.href) ||
    CACHED_URLS.includes(requestURL.pathname)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request).then(function(response) {
          return response || fetch(event.request);
        });
      })
    );
  }
});

self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (CACHE_NAME !== cacheName && cacheName.startsWith("gih-cache")) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 메시지용 helper
var postReservationDetails = function(reservation){
  self.clients.matchAll({
    includeUncontrolled: true
  }).then(function(clients){
    clients.forEach(function(client){
      client.postMessage({
        action: "update-reservation",
        reservation: reservation
      });
    });
  });
};

// offline 처리를 위한 코드 추가
var createReservationUrl = function(reservationDetails){
  var reservationUrl = new URL("http://localhost:8443/make-reservation");
  Object.keys(reservationDetails).forEach(function(key){
    reservationUrl.searchParams.append(key, reservationDetails[key]);
  });
  console.log(reservationUrl);
  return reservationUrl;
};
var syncReservations = function(){
  console.log("333");
  return getReservations("idx_status", "Sending").then(function(reservations){
    return Promise.all(
      reservations.map(function(reservation){
        var reservationUrl = createReservationUrl(reservation);
        return fetch(reservationUrl).then(function(response){
          return response.json();
        }).then(function(newReservation){
          return updateInObjectStore(
            "reservations",
            newReservation.id,
            newReservation
          ).then(function(){
            // 메시지 전달 추가
            postReservationDetails(newReservation);
          });
        });
      })
    );
  });
};
self.addEventListener("sync", function(event) {
  console.log("in");
  if (event.tag === "sync-reservations") {
    console.log("222");
    event.waitUntil(syncReservations());
  }
});

// self.onsync = function(event){
//   console.log("in");
//   if (event.tag === "sync-reservations") {
//     console.log("222");
//     event.waitUntil(syncReservations());
//   }
// };


// 메시지 
self.addEventListener("message", function(event){
  var data = event.data;
  if(data.action === "logout"){
    // logout메시지를 받으면 오픈된 윈도우 클라이언트 전체를 검사하며 my-account인 url에게 navigate 메시지를 보낸다.
    this.self.clients.matchAll().then(function(clients){
      clients.forEach(function(client){
        if(client.url.includes("/my-account")){
          console.log("server->client ::: navigate");
          client.postMessage({
            action: "navigate",
            url: "/"
          });
        }
      });
    });
  }
});