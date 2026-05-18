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
    "url": "/_next/static/chunks/1261-7e995449c8fd3815.js",
    "revision": "7e995449c8fd3815"
  }, {
    "url": "/_next/static/chunks/4277-7a95d25fa5570228.js",
    "revision": "7a95d25fa5570228"
  }, {
    "url": "/_next/static/chunks/4bd1b696-602635ee57868870.js",
    "revision": "602635ee57868870"
  }, {
    "url": "/_next/static/chunks/5881-29133d93e5137b8a.js",
    "revision": "29133d93e5137b8a"
  }, {
    "url": "/_next/static/chunks/8558-2ff1a96d697b11a5.js",
    "revision": "2ff1a96d697b11a5"
  }, {
    "url": "/_next/static/chunks/8971-8fbf04bd947a2035.js",
    "revision": "8fbf04bd947a2035"
  }, {
    "url": "/_next/static/chunks/9253-93ab0887cdd54d92.js",
    "revision": "93ab0887cdd54d92"
  }, {
    "url": "/_next/static/chunks/app/_not-found/page-42ef1bd93781e6cf.js",
    "revision": "42ef1bd93781e6cf"
  }, {
    "url": "/_next/static/chunks/app/api/auth/change-password/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/api/auth/delete-account/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/api/auth/login/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/api/auth/logout/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/api/auth/me/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/api/auth/signup/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/api/browse/movies/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/api/collections/%5Bid%5D/items/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/api/collections/%5Bid%5D/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/api/collections/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/api/health/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/api/preferences/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/api/profile/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/api/search/collections/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/api/search/titles/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/api/stream/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/api/tmdb/%5B...path%5D/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/api/videos/movie/%5Bid%5D/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/api/videos/series/%5Bid%5D/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/api/watch-history/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/api/watchlist/route-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/auth/login/page-43ad171d1efc3f49.js",
    "revision": "43ad171d1efc3f49"
  }, {
    "url": "/_next/static/chunks/app/auth/signup/page-e6c36e3a72dfd1bf.js",
    "revision": "e6c36e3a72dfd1bf"
  }, {
    "url": "/_next/static/chunks/app/browse/%5Bid%5D/loading-152ef7e728f0cfe3.js",
    "revision": "152ef7e728f0cfe3"
  }, {
    "url": "/_next/static/chunks/app/browse/%5Bid%5D/page-fa41befbdc712f80.js",
    "revision": "fa41befbdc712f80"
  }, {
    "url": "/_next/static/chunks/app/browse/provider/%5Bkey%5D/page-4b31cc8626abe011.js",
    "revision": "4b31cc8626abe011"
  }, {
    "url": "/_next/static/chunks/app/collection/%5Bid%5D/page-fc8085f66b66500e.js",
    "revision": "fc8085f66b66500e"
  }, {
    "url": "/_next/static/chunks/app/layout-cd3dfbd05cb57c00.js",
    "revision": "cd3dfbd05cb57c00"
  }, {
    "url": "/_next/static/chunks/app/loading-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/movie/%5Bid%5D/loading-152ef7e728f0cfe3.js",
    "revision": "152ef7e728f0cfe3"
  }, {
    "url": "/_next/static/chunks/app/movie/%5Bid%5D/page-15ad16271025d88d.js",
    "revision": "15ad16271025d88d"
  }, {
    "url": "/_next/static/chunks/app/movie/%5Bid%5D/watch/page-0068e4843adc6cae.js",
    "revision": "0068e4843adc6cae"
  }, {
    "url": "/_next/static/chunks/app/page-b73708bdd5655c77.js",
    "revision": "b73708bdd5655c77"
  }, {
    "url": "/_next/static/chunks/app/person/%5Bid%5D/loading-152ef7e728f0cfe3.js",
    "revision": "152ef7e728f0cfe3"
  }, {
    "url": "/_next/static/chunks/app/person/%5Bid%5D/page-b089992f0d5b3c06.js",
    "revision": "b089992f0d5b3c06"
  }, {
    "url": "/_next/static/chunks/app/profile/page-94ab47815f34dc96.js",
    "revision": "94ab47815f34dc96"
  }, {
    "url": "/_next/static/chunks/app/search/loading-152ef7e728f0cfe3.js",
    "revision": "152ef7e728f0cfe3"
  }, {
    "url": "/_next/static/chunks/app/search/page-d8a059ea8ecd6568.js",
    "revision": "d8a059ea8ecd6568"
  }, {
    "url": "/_next/static/chunks/app/series/%5Bid%5D/loading-152ef7e728f0cfe3.js",
    "revision": "152ef7e728f0cfe3"
  }, {
    "url": "/_next/static/chunks/app/series/%5Bid%5D/page-f005f3a0f622ce0a.js",
    "revision": "f005f3a0f622ce0a"
  }, {
    "url": "/_next/static/chunks/app/series/%5Bid%5D/watch/loading-d0bc31b1215de8d4.js",
    "revision": "d0bc31b1215de8d4"
  }, {
    "url": "/_next/static/chunks/app/series/%5Bid%5D/watch/page-dbdbd077f03e420f.js",
    "revision": "dbdbd077f03e420f"
  }, {
    "url": "/_next/static/chunks/app/settings/page-95dbc29154d96084.js",
    "revision": "95dbc29154d96084"
  }, {
    "url": "/_next/static/chunks/app/watchlist/page-8cbfb420910c87d7.js",
    "revision": "8cbfb420910c87d7"
  }, {
    "url": "/_next/static/chunks/framework-1249c36e9fb0600c.js",
    "revision": "1249c36e9fb0600c"
  }, {
    "url": "/_next/static/chunks/main-3ad8113d6971076c.js",
    "revision": "3ad8113d6971076c"
  }, {
    "url": "/_next/static/chunks/main-app-8dcbf89022117a10.js",
    "revision": "8dcbf89022117a10"
  }, {
    "url": "/_next/static/chunks/pages/_app-e934d87da5baeb95.js",
    "revision": "e934d87da5baeb95"
  }, {
    "url": "/_next/static/chunks/pages/_error-1b76d02a45a765cb.js",
    "revision": "1b76d02a45a765cb"
  }, {
    "url": "/_next/static/chunks/polyfills-42372ed130431b0a.js",
    "revision": "846118c33b2c0e922d7b3a7676f81f6f"
  }, {
    "url": "/_next/static/chunks/webpack-5e239341b31ad600.js",
    "revision": "5e239341b31ad600"
  }, {
    "url": "/_next/static/css/19eaccec0335b55f.css",
    "revision": "19eaccec0335b55f"
  }, {
    "url": "/_next/static/css/98a1e12a562bc963.css",
    "revision": "98a1e12a562bc963"
  }, {
    "url": "/_next/static/lX8V1J-Ie94ToggZqveIj/_buildManifest.js",
    "revision": "af2ebf472afeec5fa61de33060dbbc6c"
  }, {
    "url": "/_next/static/lX8V1J-Ie94ToggZqveIj/_ssgManifest.js",
    "revision": "b6652df95db52feb4daf4eca35380933"
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
    "url": "/apple-tv/slide-1-desktop.webp",
    "revision": "39c93e3a2330edbc6d3a1816a74bbc7a"
  }, {
    "url": "/apple-tv/slide-1-mobile.webp",
    "revision": "ffd530423f23d5e7d5461ef4f33d9582"
  }, {
    "url": "/apple-tv/slide-10-desktop.webp",
    "revision": "dec0b4c3c00478442650709e6c220ce8"
  }, {
    "url": "/apple-tv/slide-10-logo.webp",
    "revision": "36b1e5b16756b33eb2e6ccad2792cdc0"
  }, {
    "url": "/apple-tv/slide-11-desktop.webp",
    "revision": "d101696129db61b04b747fb282bca695"
  }, {
    "url": "/apple-tv/slide-11-logo.webp",
    "revision": "7eba9f8dea9d7f054ddbaabd921571a5"
  }, {
    "url": "/apple-tv/slide-2-desktop.webp",
    "revision": "52d43063556f4d6783cc1f2049551a73"
  }, {
    "url": "/apple-tv/slide-2-logo.webp",
    "revision": "c6b15d9c7c65ba7d81889794b114e434"
  }, {
    "url": "/apple-tv/slide-3-desktop.webp",
    "revision": "665e1676498494769b81b1c272fff69d"
  }, {
    "url": "/apple-tv/slide-3-logo.webp",
    "revision": "6dcdbae4e07853e6bab806b947451e70"
  }, {
    "url": "/apple-tv/slide-4-desktop.webp",
    "revision": "9e3df6f3dd41ad73f2de81b65f505684"
  }, {
    "url": "/apple-tv/slide-4-logo.webp",
    "revision": "8cc7bc7bbf69382397d9f3d4d0654bc8"
  }, {
    "url": "/apple-tv/slide-5-desktop.webp",
    "revision": "0915887ec2f1270d71bb638aac22487c"
  }, {
    "url": "/apple-tv/slide-5-logo.webp",
    "revision": "16f7a0b048ebc3d145f377eb72cb8a1d"
  }, {
    "url": "/apple-tv/slide-6-desktop.webp",
    "revision": "8ec8d111acb04d39ea5a7ab14da12d1d"
  }, {
    "url": "/apple-tv/slide-6-logo.webp",
    "revision": "ca175cfe996eb6b34894d41dacdf7649"
  }, {
    "url": "/apple-tv/slide-7-desktop.webp",
    "revision": "1a92d746b12024929109f2b79b088dc0"
  }, {
    "url": "/apple-tv/slide-7-logo.webp",
    "revision": "2eccafc8308d11ff622387b34967f710"
  }, {
    "url": "/apple-tv/slide-8-desktop.webp",
    "revision": "417c78bb9e30d8920e9e824658d0e823"
  }, {
    "url": "/apple-tv/slide-8-logo.webp",
    "revision": "2d09b9ce28ba23df46efd508d9660199"
  }, {
    "url": "/apple-tv/slide-9-desktop.webp",
    "revision": "9aff5d1a92eceb4cb79532b2d34fface"
  }, {
    "url": "/apple-tv/slide-9-logo.webp",
    "revision": "aaa8c2a1ef303964048c9c55dd5a36a7"
  }, {
    "url": "/avatar1.png",
    "revision": "bf700f850bfe46910fc7338e3c4affe9"
  }, {
    "url": "/avatar2.png",
    "revision": "a9be811fcf092f6b5bf5d9e6f27acf4c"
  }, {
    "url": "/avatar3.png",
    "revision": "14e1a8718578cbd9405b164145628982"
  }, {
    "url": "/avatar4.png",
    "revision": "88e0c3272805d5b1478eccaeefbca244"
  }, {
    "url": "/avatar5.png",
    "revision": "8a723bb599bd8ba94346a18552c404e0"
  }, {
    "url": "/backdrop-disneyplus.avif",
    "revision": "359fcc886b3e130f9705e581583adbec"
  }, {
    "url": "/backdrop-max.avif",
    "revision": "54791776f45465ad97fa6d0f87e97090"
  }, {
    "url": "/backdrop-paramountplus.avif",
    "revision": "462af1ad2d28a19077ef2b1b3fc2165f"
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
    "url": "/providers/appletv.svg",
    "revision": "4f39853a063a51a29f7ab0ff4e41c21f"
  }, {
    "url": "/providers/disneyplus.svg",
    "revision": "2540eacfb16aac39969931215220e6a6"
  }, {
    "url": "/providers/max.svg",
    "revision": "16a63bae0eb5ed33885aeb8f4ba38ecd"
  }, {
    "url": "/providers/netflix.svg",
    "revision": "6dbba458959d4ce1edd2f5b3ab3ae13b"
  }, {
    "url": "/providers/paramountplus.svg",
    "revision": "2654c4f7ad5bc2b5a90c6624f2fd54c3"
  }, {
    "url": "/providers/primevideo.svg",
    "revision": "edcc7b44616a107bbb560cecc5d93487"
  }, {
    "url": "/robots.txt",
    "revision": "f71d20196d4caf35b6a670db8c70b03d"
  }, {
    "url": "/test-character.avif",
    "revision": "e75e2b52d769ffa33e3d7b35f7e112a4"
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
