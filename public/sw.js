/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-1e826536'], (function (workbox) { 'use strict';

  importScripts();
  self.skipWaiting();
  workbox.clientsClaim();

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "/_next/static/BGrw8_9JxVc731MzhYZDN/_buildManifest.js",
    "revision": "69457b05b7cca5c609cadd491c97fbb4"
  }, {
    "url": "/_next/static/BGrw8_9JxVc731MzhYZDN/_ssgManifest.js",
    "revision": "b6652df95db52feb4daf4eca35380933"
  }, {
    "url": "/_next/static/chunks/176-dbfe7d379a5d476e.js",
    "revision": "dbfe7d379a5d476e"
  }, {
    "url": "/_next/static/chunks/239-d33310ddfa6356f4.js",
    "revision": "d33310ddfa6356f4"
  }, {
    "url": "/_next/static/chunks/421-516d213b0b7a5d1d.js",
    "revision": "516d213b0b7a5d1d"
  }, {
    "url": "/_next/static/chunks/4bd1b696-c023c6e3521b1417.js",
    "revision": "c023c6e3521b1417"
  }, {
    "url": "/_next/static/chunks/538-75a31de24835d712.js",
    "revision": "75a31de24835d712"
  }, {
    "url": "/_next/static/chunks/696-95016c8e77458347.js",
    "revision": "95016c8e77458347"
  }, {
    "url": "/_next/static/chunks/909-aed3aa549e59d0fb.js",
    "revision": "aed3aa549e59d0fb"
  }, {
    "url": "/_next/static/chunks/app/_not-found/page-a726bf2a4c79d564.js",
    "revision": "a726bf2a4c79d564"
  }, {
    "url": "/_next/static/chunks/app/api/browse/movies/route-0104c30c9a02c942.js",
    "revision": "0104c30c9a02c942"
  }, {
    "url": "/_next/static/chunks/app/api/embed/movie/%5Bid%5D/route-0104c30c9a02c942.js",
    "revision": "0104c30c9a02c942"
  }, {
    "url": "/_next/static/chunks/app/api/embed/series/%5Bid%5D/%5Bseason%5D/%5Bepisode%5D/route-0104c30c9a02c942.js",
    "revision": "0104c30c9a02c942"
  }, {
    "url": "/_next/static/chunks/app/api/health/route-0104c30c9a02c942.js",
    "revision": "0104c30c9a02c942"
  }, {
    "url": "/_next/static/chunks/app/api/search/titles/route-0104c30c9a02c942.js",
    "revision": "0104c30c9a02c942"
  }, {
    "url": "/_next/static/chunks/app/api/tmdb/%5B...path%5D/route-0104c30c9a02c942.js",
    "revision": "0104c30c9a02c942"
  }, {
    "url": "/_next/static/chunks/app/api/videos/movie/%5Bid%5D/route-0104c30c9a02c942.js",
    "revision": "0104c30c9a02c942"
  }, {
    "url": "/_next/static/chunks/app/api/videos/series/%5Bid%5D/route-0104c30c9a02c942.js",
    "revision": "0104c30c9a02c942"
  }, {
    "url": "/_next/static/chunks/app/browse/%5Bid%5D/loading-1d6153bbb83e2418.js",
    "revision": "1d6153bbb83e2418"
  }, {
    "url": "/_next/static/chunks/app/browse/%5Bid%5D/page-4c3e79cbf1391201.js",
    "revision": "4c3e79cbf1391201"
  }, {
    "url": "/_next/static/chunks/app/layout-1ff7d59498bf8922.js",
    "revision": "1ff7d59498bf8922"
  }, {
    "url": "/_next/static/chunks/app/loading-0104c30c9a02c942.js",
    "revision": "0104c30c9a02c942"
  }, {
    "url": "/_next/static/chunks/app/movie/%5Bid%5D/loading-1d6153bbb83e2418.js",
    "revision": "1d6153bbb83e2418"
  }, {
    "url": "/_next/static/chunks/app/movie/%5Bid%5D/page-a1692d68399b24e9.js",
    "revision": "a1692d68399b24e9"
  }, {
    "url": "/_next/static/chunks/app/movie/%5Bid%5D/watch/page-1639fc142b19b46e.js",
    "revision": "1639fc142b19b46e"
  }, {
    "url": "/_next/static/chunks/app/page-30601041a587d8a1.js",
    "revision": "30601041a587d8a1"
  }, {
    "url": "/_next/static/chunks/app/person/%5Bid%5D/loading-1d6153bbb83e2418.js",
    "revision": "1d6153bbb83e2418"
  }, {
    "url": "/_next/static/chunks/app/person/%5Bid%5D/page-7ca9c0427695f43f.js",
    "revision": "7ca9c0427695f43f"
  }, {
    "url": "/_next/static/chunks/app/search/loading-1d6153bbb83e2418.js",
    "revision": "1d6153bbb83e2418"
  }, {
    "url": "/_next/static/chunks/app/search/page-9dec326aca22f233.js",
    "revision": "9dec326aca22f233"
  }, {
    "url": "/_next/static/chunks/app/series/%5Bid%5D/loading-1d6153bbb83e2418.js",
    "revision": "1d6153bbb83e2418"
  }, {
    "url": "/_next/static/chunks/app/series/%5Bid%5D/page-40a3b360a7997ec5.js",
    "revision": "40a3b360a7997ec5"
  }, {
    "url": "/_next/static/chunks/app/series/%5Bid%5D/watch/loading-0104c30c9a02c942.js",
    "revision": "0104c30c9a02c942"
  }, {
    "url": "/_next/static/chunks/app/series/%5Bid%5D/watch/page-39d0909c643bfe39.js",
    "revision": "39d0909c643bfe39"
  }, {
    "url": "/_next/static/chunks/framework-050c1f32293f7182.js",
    "revision": "050c1f32293f7182"
  }, {
    "url": "/_next/static/chunks/main-app-e7b21ce2c9e95af2.js",
    "revision": "e7b21ce2c9e95af2"
  }, {
    "url": "/_next/static/chunks/main-bf843958cbb56269.js",
    "revision": "bf843958cbb56269"
  }, {
    "url": "/_next/static/chunks/pages/_app-7d307437aca18ad4.js",
    "revision": "7d307437aca18ad4"
  }, {
    "url": "/_next/static/chunks/pages/_error-cb2a52f75f2162e2.js",
    "revision": "cb2a52f75f2162e2"
  }, {
    "url": "/_next/static/chunks/polyfills-42372ed130431b0a.js",
    "revision": "846118c33b2c0e922d7b3a7676f81f6f"
  }, {
    "url": "/_next/static/chunks/webpack-6c2605a86b0cdb42.js",
    "revision": "6c2605a86b0cdb42"
  }, {
    "url": "/_next/static/css/19eaccec0335b55f.css",
    "revision": "19eaccec0335b55f"
  }, {
    "url": "/_next/static/css/d992b61b204faeb1.css",
    "revision": "d992b61b204faeb1"
  }, {
    "url": "/_next/static/media/024ead497118aa23-s.woff2",
    "revision": "04a76b62d183d06a851464a83dc06856"
  }, {
    "url": "/_next/static/media/0da54fcd0470ea43-s.woff2",
    "revision": "b970cda172e5c105d36642ea0cbbd193"
  }, {
    "url": "/_next/static/media/13971731025ec697-s.p.woff2",
    "revision": "d4c68940b772538be3593f0c646de4a0"
  }, {
    "url": "/_next/static/media/393d45a2251e223a-s.woff2",
    "revision": "c88e7854dc9e21b3df900e1e9bbb9791"
  }, {
    "url": "/_next/static/media/48410f3df60da620-s.woff2",
    "revision": "e1f7cd82031b41027ce3b241bca44c88"
  }, {
    "url": "/_next/static/media/63b7f7cf762c1c1b-s.p.woff2",
    "revision": "1472b4fcf031515088f4f45648a1e023"
  }, {
    "url": "/_next/static/media/680a7121f7a85e3f-s.woff2",
    "revision": "c9890e96868d69cf23857ff02fd06aa8"
  }, {
    "url": "/_next/static/media/736504ce0c225627-s.woff2",
    "revision": "3f9fbe2acb96ebea95d7d3380ddac821"
  }, {
    "url": "/_next/static/media/75791ab424a6b224-s.woff2",
    "revision": "397dc8b89b1a1032d59999924dcc3c48"
  }, {
    "url": "/_next/static/media/7ab938503e4547a1-s.woff2",
    "revision": "9598e1855de9dcb4c522f0d705e8fd5c"
  }, {
    "url": "/_next/static/media/7b89a4fd5e90ede0-s.p.woff2",
    "revision": "ec4225ec161bd5285480b6b197e10b2b"
  }, {
    "url": "/_next/static/media/8715d2ed531152f4-s.woff2",
    "revision": "4707efc4a5178d63587bcd41cb9b91c7"
  }, {
    "url": "/_next/static/media/8a1d8947e5852e30-s.p.woff2",
    "revision": "06dac3d9f8a5ed82542f7e51f9eaa120"
  }, {
    "url": "/_next/static/media/c48b38fe8bb532f3-s.woff2",
    "revision": "3e6270b013fa54e61b296effea15acc2"
  }, {
    "url": "/_next/static/media/e18f83c737786aa7-s.p.woff2",
    "revision": "b0fa095eb2a6dcb5c16b01bd4497711c"
  }, {
    "url": "/_next/static/media/e74f24ed7f0e4323-s.woff2",
    "revision": "d4b577745e9f7a0172d55c9db19f5084"
  }, {
    "url": "/_next/static/media/ea896c3885e026c1-s.woff2",
    "revision": "160db4ca1c04a1c0c7696a60112e7d52"
  }, {
    "url": "/_next/static/media/fd3893c623c32b6d-s.woff2",
    "revision": "e37755b15ebf86db9a7f97151761bd39"
  }, {
    "url": "/apple-touch-icon.png",
    "revision": "aa2ba5a8c9655de4f49bd9c5600f4da9"
  }, {
    "url": "/icon-192.png",
    "revision": "aa2ba5a8c9655de4f49bd9c5600f4da9"
  }, {
    "url": "/icon-512.png",
    "revision": "5346241ea260b16f894c8dfefacff397"
  }, {
    "url": "/icon.svg",
    "revision": "d2d959ad521ee6dd1a07a757da587b09"
  }, {
    "url": "/logo.svg",
    "revision": "38ebfa8d097e1c5b8da872598dfb17ee"
  }, {
    "url": "/manifest.json",
    "revision": "59abafc4a92aeb1ce50bfbdd59bfa0eb"
  }, {
    "url": "/robots.txt",
    "revision": "f71d20196d4caf35b6a670db8c70b03d"
  }], {
    "ignoreURLParametersMatching": [/^utm_/, /^fbclid$/]
  });
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute("/", new workbox.NetworkFirst({
    "cacheName": "start-url",
    plugins: [{
      cacheWillUpdate: function (param) {
        var e = param.response;
        return _async_to_generator(function () {
          return _ts_generator(this, function (_state) {
            return [2, e && "opaqueredirect" === e.type ? new Response(e.body, {
              status: 200,
              statusText: "OK",
              headers: e.headers
            }) : e];
          });
        })();
      }
    }]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.(?:gstatic)\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-webfonts",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 4,
      maxAgeSeconds: 31536000
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.(?:googleapis)\.com\/.*/i, new workbox.StaleWhileRevalidate({
    "cacheName": "google-fonts-stylesheets",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 4,
      maxAgeSeconds: 604800
    })]
  }), 'GET');
  workbox.registerRoute(/\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i, new workbox.StaleWhileRevalidate({
    "cacheName": "static-font-assets",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 4,
      maxAgeSeconds: 604800
    })]
  }), 'GET');
  workbox.registerRoute(/\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i, new workbox.StaleWhileRevalidate({
    "cacheName": "static-image-assets",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 64,
      maxAgeSeconds: 2592000
    })]
  }), 'GET');
  workbox.registerRoute(/\/_next\/static.+\.js$/i, new workbox.CacheFirst({
    "cacheName": "next-static-js-assets",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 64,
      maxAgeSeconds: 86400
    })]
  }), 'GET');
  workbox.registerRoute(/\/_next\/image\?url=.+$/i, new workbox.StaleWhileRevalidate({
    "cacheName": "next-image",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 64,
      maxAgeSeconds: 86400
    })]
  }), 'GET');
  workbox.registerRoute(/\.(?:mp3|wav|ogg)$/i, new workbox.CacheFirst({
    "cacheName": "static-audio-assets",
    plugins: [new workbox.RangeRequestsPlugin(), new workbox.ExpirationPlugin({
      maxEntries: 32,
      maxAgeSeconds: 86400
    })]
  }), 'GET');
  workbox.registerRoute(/\.(?:mp4|webm)$/i, new workbox.CacheFirst({
    "cacheName": "static-video-assets",
    plugins: [new workbox.RangeRequestsPlugin(), new workbox.ExpirationPlugin({
      maxEntries: 32,
      maxAgeSeconds: 86400
    })]
  }), 'GET');
  workbox.registerRoute(/\.(?:js)$/i, new workbox.StaleWhileRevalidate({
    "cacheName": "static-js-assets",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 48,
      maxAgeSeconds: 86400
    })]
  }), 'GET');
  workbox.registerRoute(/\.(?:css|less)$/i, new workbox.StaleWhileRevalidate({
    "cacheName": "static-style-assets",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 32,
      maxAgeSeconds: 86400
    })]
  }), 'GET');
  workbox.registerRoute(/\/_next\/data\/.+\/.+\.json$/i, new workbox.StaleWhileRevalidate({
    "cacheName": "next-data",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 32,
      maxAgeSeconds: 86400
    })]
  }), 'GET');
  workbox.registerRoute(/\.(?:json|xml|csv)$/i, new workbox.NetworkFirst({
    "cacheName": "static-data-assets",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 32,
      maxAgeSeconds: 86400
    })]
  }), 'GET');
  workbox.registerRoute(function (param) {
    var e = param.sameOrigin,
      _param_url = param.url,
      t = _param_url.pathname;
    return !(!e || t.startsWith("/api/auth/callback")) && !!t.startsWith("/api/");
  }, new workbox.NetworkFirst({
    "cacheName": "apis",
    "networkTimeoutSeconds": 10,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 16,
      maxAgeSeconds: 86400
    })]
  }), 'GET');
  workbox.registerRoute(function (param) {
    var e = param.request,
      _param_url = param.url,
      t = _param_url.pathname,
      a = param.sameOrigin;
    return "1" === e.headers.get("RSC") && "1" === e.headers.get("Next-Router-Prefetch") && a && !t.startsWith("/api/");
  }, new workbox.NetworkFirst({
    "cacheName": "pages-rsc-prefetch",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 32,
      maxAgeSeconds: 86400
    })]
  }), 'GET');
  workbox.registerRoute(function (param) {
    var e = param.request,
      _param_url = param.url,
      t = _param_url.pathname,
      a = param.sameOrigin;
    return "1" === e.headers.get("RSC") && a && !t.startsWith("/api/");
  }, new workbox.NetworkFirst({
    "cacheName": "pages-rsc",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 32,
      maxAgeSeconds: 86400
    })]
  }), 'GET');
  workbox.registerRoute(function (param) {
    var _param_url = param.url,
      e = _param_url.pathname,
      t = param.sameOrigin;
    return t && !e.startsWith("/api/");
  }, new workbox.NetworkFirst({
    "cacheName": "pages",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 32,
      maxAgeSeconds: 86400
    })]
  }), 'GET');
  workbox.registerRoute(function (param) {
    var e = param.sameOrigin;
    return !e;
  }, new workbox.NetworkFirst({
    "cacheName": "cross-origin",
    "networkTimeoutSeconds": 10,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 32,
      maxAgeSeconds: 3600
    })]
  }), 'GET');

}));
