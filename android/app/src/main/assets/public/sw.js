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
    uri = new URL(uri + '.js', parentUri).href;
    return (
      registry[uri] ||
      new Promise((resolve) => {
        if ('document' in self) {
          const script = document.createElement('script');
          script.src = uri;
          script.onload = resolve;
          document.head.appendChild(script);
        } else {
          nextDefineUri = uri;
          importScripts(uri);
          resolve();
        }
      }).then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri =
      nextDefineUri || ('document' in self ? document.currentScript.src : '') || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = (depUri) => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require,
    };
    registry[uri] = Promise.all(
      depsNames.map((depName) => specialDeps[depName] || require(depName)),
    ).then((deps) => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-1e826536'], function (workbox) {
  'use strict';

  importScripts();
  self.skipWaiting();
  workbox.clientsClaim();

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute(
    [
      {
        url: '/_next/static/chunks/1331-0d8572792b3a43d5.js',
        revision: '0d8572792b3a43d5',
      },
      {
        url: '/_next/static/chunks/1869.a736d54fe554f252.js',
        revision: 'a736d54fe554f252',
      },
      {
        url: '/_next/static/chunks/2335-c9da5727f54cbd63.js',
        revision: 'c9da5727f54cbd63',
      },
      {
        url: '/_next/static/chunks/4696-2a8b1d9863c6b5d2.js',
        revision: '2a8b1d9863c6b5d2',
      },
      {
        url: '/_next/static/chunks/4850-351c47ca1335e5c4.js',
        revision: '351c47ca1335e5c4',
      },
      {
        url: '/_next/static/chunks/4909-a6ccb82e391d8f86.js',
        revision: 'a6ccb82e391d8f86',
      },
      {
        url: '/_next/static/chunks/4bd1b696-f785427dddbba9fb.js',
        revision: 'f785427dddbba9fb',
      },
      {
        url: '/_next/static/chunks/5604-d8adfe9bbce424dd.js',
        revision: 'd8adfe9bbce424dd',
      },
      {
        url: '/_next/static/chunks/6880-50c961e42b44b794.js',
        revision: '50c961e42b44b794',
      },
      {
        url: '/_next/static/chunks/9209-fd7e72cbe1147dcf.js',
        revision: 'fd7e72cbe1147dcf',
      },
      {
        url: '/_next/static/chunks/a4634e51.c3e691ac240a79f3.js',
        revision: 'c3e691ac240a79f3',
      },
      {
        url: '/_next/static/chunks/app/_not-found/page-79f48bbda8285224.js',
        revision: '79f48bbda8285224',
      },
      {
        url: '/_next/static/chunks/app/api/auth/change-password/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/auth/delete-account/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/auth/login/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/auth/logout/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/auth/me/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/auth/signup/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/browse/movies/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/channels/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/collections/%5Bid%5D/items/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/collections/%5Bid%5D/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/collections/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/media-proxy/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/preferences/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/profile/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/search/autocomplete/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/search/collections/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/search/titles/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/stream/%5Btype%5D/%5Bid%5D/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/tmdb/%5B...path%5D/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/videos/movie/%5Bid%5D/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/videos/series/%5Bid%5D/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/watch-history/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/api/watchlist/route-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/auth/login/page-8c821f4330a0d5ef.js',
        revision: '8c821f4330a0d5ef',
      },
      {
        url: '/_next/static/chunks/app/auth/signup/page-4abb975b6d9c01c2.js',
        revision: '4abb975b6d9c01c2',
      },
      {
        url: '/_next/static/chunks/app/browse/%5Bid%5D/loading-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/browse/%5Bid%5D/page-1eb4253d35b0f06a.js',
        revision: '1eb4253d35b0f06a',
      },
      {
        url: '/_next/static/chunks/app/browse/provider/%5Bkey%5D/loading-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/browse/provider/%5Bkey%5D/page-64ed40cab67e1956.js',
        revision: '64ed40cab67e1956',
      },
      {
        url: '/_next/static/chunks/app/browse/streaming/page-9acbde35e04f4145.js',
        revision: '9acbde35e04f4145',
      },
      {
        url: '/_next/static/chunks/app/channels/page-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/collection/%5Bid%5D/page-b288544d61a9f3c4.js',
        revision: 'b288544d61a9f3c4',
      },
      {
        url: '/_next/static/chunks/app/layout-9b383a27764ffefb.js',
        revision: '9b383a27764ffefb',
      },
      {
        url: '/_next/static/chunks/app/loading-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/movie/%5Bid%5D/loading-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/movie/%5Bid%5D/page-a232d38f38f8103c.js',
        revision: 'a232d38f38f8103c',
      },
      {
        url: '/_next/static/chunks/app/movie/%5Bid%5D/watch/page-5fe403639f9c3fa9.js',
        revision: '5fe403639f9c3fa9',
      },
      {
        url: '/_next/static/chunks/app/page-0376f6d7e7a70cbc.js',
        revision: '0376f6d7e7a70cbc',
      },
      {
        url: '/_next/static/chunks/app/person/%5Bid%5D/loading-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/person/%5Bid%5D/page-ceaf5e37ed5cb065.js',
        revision: 'ceaf5e37ed5cb065',
      },
      {
        url: '/_next/static/chunks/app/profile/page-035323c8a72e0128.js',
        revision: '035323c8a72e0128',
      },
      {
        url: '/_next/static/chunks/app/search/loading-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/search/page-e2e9ba08fed0373a.js',
        revision: 'e2e9ba08fed0373a',
      },
      {
        url: '/_next/static/chunks/app/series/%5Bid%5D/loading-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/series/%5Bid%5D/page-ddb87d00a69d6e04.js',
        revision: 'ddb87d00a69d6e04',
      },
      {
        url: '/_next/static/chunks/app/series/%5Bid%5D/watch/loading-5fa54035bdbea92a.js',
        revision: '5fa54035bdbea92a',
      },
      {
        url: '/_next/static/chunks/app/series/%5Bid%5D/watch/page-56c3d5e8bb935dfd.js',
        revision: '56c3d5e8bb935dfd',
      },
      {
        url: '/_next/static/chunks/app/settings/page-f6ac9a1eabe31dd8.js',
        revision: 'f6ac9a1eabe31dd8',
      },
      {
        url: '/_next/static/chunks/app/watchlist/page-375df66e53af9073.js',
        revision: '375df66e53af9073',
      },
      {
        url: '/_next/static/chunks/framework-d0ede7c356a84725.js',
        revision: 'd0ede7c356a84725',
      },
      {
        url: '/_next/static/chunks/main-28cb8051dcf9e713.js',
        revision: '28cb8051dcf9e713',
      },
      {
        url: '/_next/static/chunks/main-app-eeebc6fc26db1dd4.js',
        revision: 'eeebc6fc26db1dd4',
      },
      {
        url: '/_next/static/chunks/pages/_app-6c8c2371b16a04b8.js',
        revision: '6c8c2371b16a04b8',
      },
      {
        url: '/_next/static/chunks/pages/_error-94812ad32cad7365.js',
        revision: '94812ad32cad7365',
      },
      {
        url: '/_next/static/chunks/polyfills-42372ed130431b0a.js',
        revision: '846118c33b2c0e922d7b3a7676f81f6f',
      },
      {
        url: '/_next/static/chunks/webpack-53a388fb2515f4ae.js',
        revision: '53a388fb2515f4ae',
      },
      {
        url: '/_next/static/css/5501b005c9b4a9a5.css',
        revision: '5501b005c9b4a9a5',
      },
      {
        url: '/_next/static/h1GH__eSAH7r_SjQsmOlA/_buildManifest.js',
        revision: 'ffcb6c3a73094c8b4a08141bc0662f18',
      },
      {
        url: '/_next/static/h1GH__eSAH7r_SjQsmOlA/_ssgManifest.js',
        revision: 'b6652df95db52feb4daf4eca35380933',
      },
      {
        url: '/_next/static/media/13971731025ec697-s.p.woff2',
        revision: 'd4c68940b772538be3593f0c646de4a0',
      },
      {
        url: '/_next/static/media/7ab938503e4547a1-s.woff2',
        revision: '9598e1855de9dcb4c522f0d705e8fd5c',
      },
      {
        url: '/apple-touch-icon.png',
        revision: 'aa2ba5a8c9655de4f49bd9c5600f4da9',
      },
      {
        url: '/apple-tv/slide-1-desktop.webp',
        revision: '39c93e3a2330edbc6d3a1816a74bbc7a',
      },
      {
        url: '/apple-tv/slide-1-mobile.webp',
        revision: 'ffd530423f23d5e7d5461ef4f33d9582',
      },
      {
        url: '/apple-tv/slide-10-desktop.webp',
        revision: 'dec0b4c3c00478442650709e6c220ce8',
      },
      {
        url: '/apple-tv/slide-10-logo.webp',
        revision: '36b1e5b16756b33eb2e6ccad2792cdc0',
      },
      {
        url: '/apple-tv/slide-11-desktop.webp',
        revision: 'd101696129db61b04b747fb282bca695',
      },
      {
        url: '/apple-tv/slide-11-logo.webp',
        revision: '7eba9f8dea9d7f054ddbaabd921571a5',
      },
      {
        url: '/apple-tv/slide-2-desktop.webp',
        revision: '52d43063556f4d6783cc1f2049551a73',
      },
      {
        url: '/apple-tv/slide-2-logo.webp',
        revision: 'c6b15d9c7c65ba7d81889794b114e434',
      },
      {
        url: '/apple-tv/slide-3-desktop.webp',
        revision: '665e1676498494769b81b1c272fff69d',
      },
      {
        url: '/apple-tv/slide-3-logo.webp',
        revision: '6dcdbae4e07853e6bab806b947451e70',
      },
      {
        url: '/apple-tv/slide-4-desktop.webp',
        revision: '9e3df6f3dd41ad73f2de81b65f505684',
      },
      {
        url: '/apple-tv/slide-4-logo.webp',
        revision: '8cc7bc7bbf69382397d9f3d4d0654bc8',
      },
      {
        url: '/apple-tv/slide-5-desktop.webp',
        revision: '0915887ec2f1270d71bb638aac22487c',
      },
      {
        url: '/apple-tv/slide-5-logo.webp',
        revision: '16f7a0b048ebc3d145f377eb72cb8a1d',
      },
      {
        url: '/apple-tv/slide-6-desktop.webp',
        revision: '8ec8d111acb04d39ea5a7ab14da12d1d',
      },
      {
        url: '/apple-tv/slide-6-logo.webp',
        revision: 'ca175cfe996eb6b34894d41dacdf7649',
      },
      {
        url: '/apple-tv/slide-7-desktop.webp',
        revision: '1a92d746b12024929109f2b79b088dc0',
      },
      {
        url: '/apple-tv/slide-7-logo.webp',
        revision: '2eccafc8308d11ff622387b34967f710',
      },
      {
        url: '/apple-tv/slide-8-desktop.webp',
        revision: '417c78bb9e30d8920e9e824658d0e823',
      },
      {
        url: '/apple-tv/slide-8-logo.webp',
        revision: '2d09b9ce28ba23df46efd508d9660199',
      },
      {
        url: '/apple-tv/slide-9-desktop.webp',
        revision: '9aff5d1a92eceb4cb79532b2d34fface',
      },
      {
        url: '/apple-tv/slide-9-logo.webp',
        revision: 'aaa8c2a1ef303964048c9c55dd5a36a7',
      },
      {
        url: '/avatar1.png',
        revision: 'bf700f850bfe46910fc7338e3c4affe9',
      },
      {
        url: '/avatar2.png',
        revision: 'a9be811fcf092f6b5bf5d9e6f27acf4c',
      },
      {
        url: '/avatar3.png',
        revision: '14e1a8718578cbd9405b164145628982',
      },
      {
        url: '/avatar4.png',
        revision: '88e0c3272805d5b1478eccaeefbca244',
      },
      {
        url: '/avatar5.png',
        revision: '8a723bb599bd8ba94346a18552c404e0',
      },
      {
        url: '/backdrop-disneyplus.avif',
        revision: '7ff279a79a2fed333a487580b4e68145',
      },
      {
        url: '/backdrop-max.avif',
        revision: '54791776f45465ad97fa6d0f87e97090',
      },
      {
        url: '/backdrop-netflix.avif',
        revision: '180d480dccbac54861fde143ca2596a8',
      },
      {
        url: '/backdrop-paramountplus.avif',
        revision: '04d87f42d90533f1f06ae6eb10caf2ab',
      },
      {
        url: '/backdrop-primevideo.avif',
        revision: '261fda1f7a140b7cc34a29dbdf7376cb',
      },
      {
        url: '/fonts/ITCPioneer.otf',
        revision: '0cf668ff4bd44f782737b651d17b5601',
      },
      {
        url: '/fonts/chesnagrotesk-regular-webfont.woff2',
        revision: '0bc35deac15c4e4e7cfc3c72aac280f8',
      },
      {
        url: '/fresh-tomato-logo.png',
        revision: 'a71e35bb5b696387af64271b02eb47ca',
      },
      {
        url: '/icon-192.png',
        revision: 'aa2ba5a8c9655de4f49bd9c5600f4da9',
      },
      {
        url: '/icon-512.png',
        revision: '5346241ea260b16f894c8dfefacff397',
      },
      {
        url: '/icon.svg',
        revision: 'd2d959ad521ee6dd1a07a757da587b09',
      },
      {
        url: '/logo.svg',
        revision: '38ebfa8d097e1c5b8da872598dfb17ee',
      },
      {
        url: '/logos/fresh.svg',
        revision: '4c0ccb7d782fbb937021596593fc2da1',
      },
      {
        url: '/logos/rotten.svg',
        revision: '494998ffc082212d21551ba1696a305b',
      },
      {
        url: '/manifest.json',
        revision: '59abafc4a92aeb1ce50bfbdd59bfa0eb',
      },
      {
        url: '/providers/appletv.svg',
        revision: '4f39853a063a51a29f7ab0ff4e41c21f',
      },
      {
        url: '/providers/disneyplus.svg',
        revision: '2540eacfb16aac39969931215220e6a6',
      },
      {
        url: '/providers/max.svg',
        revision: '16a63bae0eb5ed33885aeb8f4ba38ecd',
      },
      {
        url: '/providers/netflix.svg',
        revision: '6dbba458959d4ce1edd2f5b3ab3ae13b',
      },
      {
        url: '/providers/paramountplus.svg',
        revision: '2654c4f7ad5bc2b5a90c6624f2fd54c3',
      },
      {
        url: '/providers/primevideo.svg',
        revision: 'edcc7b44616a107bbb560cecc5d93487',
      },
      {
        url: '/robots.txt',
        revision: 'f71d20196d4caf35b6a670db8c70b03d',
      },
      {
        url: '/test-character.avif',
        revision: 'e75e2b52d769ffa33e3d7b35f7e112a4',
      },
    ],
    {
      ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
    },
  );
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(
    '/',
    new workbox.NetworkFirst({
      cacheName: 'start-url',
      plugins: [
        {
          cacheWillUpdate: function (param) {
            var e = param.response;
            return _async_to_generator(function () {
              return _ts_generator(this, function (_state) {
                return [
                  2,
                  e && 'opaqueredirect' === e.type
                    ? new Response(e.body, {
                        status: 200,
                        statusText: 'OK',
                        headers: e.headers,
                      })
                    : e,
                ];
              });
            })();
          },
        },
      ],
    }),
    'GET',
  );
  workbox.registerRoute(
    /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
    new workbox.CacheFirst({
      cacheName: 'google-fonts-webfonts',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 4,
          maxAgeSeconds: 31536000,
        }),
      ],
    }),
    'GET',
  );
  workbox.registerRoute(
    /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
    new workbox.StaleWhileRevalidate({
      cacheName: 'google-fonts-stylesheets',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 4,
          maxAgeSeconds: 604800,
        }),
      ],
    }),
    'GET',
  );
  workbox.registerRoute(
    /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
    new workbox.StaleWhileRevalidate({
      cacheName: 'static-font-assets',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 4,
          maxAgeSeconds: 604800,
        }),
      ],
    }),
    'GET',
  );
  workbox.registerRoute(
    /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
    new workbox.StaleWhileRevalidate({
      cacheName: 'static-image-assets',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 64,
          maxAgeSeconds: 2592000,
        }),
      ],
    }),
    'GET',
  );
  workbox.registerRoute(
    /\/_next\/static.+\.js$/i,
    new workbox.CacheFirst({
      cacheName: 'next-static-js-assets',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 64,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET',
  );
  workbox.registerRoute(
    /\/_next\/image\?url=.+$/i,
    new workbox.StaleWhileRevalidate({
      cacheName: 'next-image',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 64,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET',
  );
  workbox.registerRoute(
    /\.(?:mp3|wav|ogg)$/i,
    new workbox.CacheFirst({
      cacheName: 'static-audio-assets',
      plugins: [
        new workbox.RangeRequestsPlugin(),
        new workbox.ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET',
  );
  workbox.registerRoute(
    /\.(?:mp4|webm)$/i,
    new workbox.CacheFirst({
      cacheName: 'static-video-assets',
      plugins: [
        new workbox.RangeRequestsPlugin(),
        new workbox.ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET',
  );
  workbox.registerRoute(
    /\.(?:js)$/i,
    new workbox.StaleWhileRevalidate({
      cacheName: 'static-js-assets',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 48,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET',
  );
  workbox.registerRoute(
    /\.(?:css|less)$/i,
    new workbox.StaleWhileRevalidate({
      cacheName: 'static-style-assets',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET',
  );
  workbox.registerRoute(
    /\/_next\/data\/.+\/.+\.json$/i,
    new workbox.StaleWhileRevalidate({
      cacheName: 'next-data',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET',
  );
  workbox.registerRoute(
    /\.(?:json|xml|csv)$/i,
    new workbox.NetworkFirst({
      cacheName: 'static-data-assets',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET',
  );
  workbox.registerRoute(
    function (param) {
      var e = param.sameOrigin,
        _param_url = param.url,
        t = _param_url.pathname;
      return !(!e || t.startsWith('/api/auth/callback')) && !!t.startsWith('/api/');
    },
    new workbox.NetworkFirst({
      cacheName: 'apis',
      networkTimeoutSeconds: 10,
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 16,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET',
  );
  workbox.registerRoute(
    function (param) {
      var e = param.request,
        _param_url = param.url,
        t = _param_url.pathname,
        a = param.sameOrigin;
      return (
        '1' === e.headers.get('RSC') &&
        '1' === e.headers.get('Next-Router-Prefetch') &&
        a &&
        !t.startsWith('/api/')
      );
    },
    new workbox.NetworkFirst({
      cacheName: 'pages-rsc-prefetch',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET',
  );
  workbox.registerRoute(
    function (param) {
      var e = param.request,
        _param_url = param.url,
        t = _param_url.pathname,
        a = param.sameOrigin;
      return '1' === e.headers.get('RSC') && a && !t.startsWith('/api/');
    },
    new workbox.NetworkFirst({
      cacheName: 'pages-rsc',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET',
  );
  workbox.registerRoute(
    function (param) {
      var _param_url = param.url,
        e = _param_url.pathname,
        t = param.sameOrigin;
      return t && !e.startsWith('/api/');
    },
    new workbox.NetworkFirst({
      cacheName: 'pages',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET',
  );
  workbox.registerRoute(
    function (param) {
      var e = param.sameOrigin;
      return !e;
    },
    new workbox.NetworkFirst({
      cacheName: 'cross-origin',
      networkTimeoutSeconds: 10,
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 3600,
        }),
      ],
    }),
    'GET',
  );
});
