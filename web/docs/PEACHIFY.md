# Peachify Player Integration

## 1. Base URL

The player is hosted at: `https://peachify.top`

## 2. Endpoints

- **Movies:** `https://peachify.top/embed/movie/{media_id}`
- **TV Shows:** `https://peachify.top/embed/tv/{media_id}/{season}/{episode}`

Use a TMDB numeric ID or an IMDb ID that starts with `tt`. TMDB IDs are recommended, but IMDb IDs are also supported as long as you keep the `tt` prefix so the player can distinguish and resolve them automatically.

## 3. Query Parameters

- `dub` / `audio` (string): Target audio language (e.g. `English`)
- `sub` / `subtitle` (string): Target subtitle language or label (e.g. `English`, `eng`, `Arabic`). If it isn't available, the player only falls back to the user's saved subtitle preference.
- `quality` / `q` (string or number): Request a preferred quality such as `1080` or `1080p`
- `server` (string): Force a specific provider first (e.g. `iron`, `spider`, `wolf`)
- `api` (string / URL): Override the provider API base URL if I am using my own Peachify-compatible backend
- `startAt` / `progress` / `t` (number): Start playback from this timestamp in seconds
- `autoNext` (boolean-like or number, TV only): enable episode auto-next. When credits data exists, the player uses that credits start automatically. Otherwise it falls back to the default 30-second threshold or your custom value like `?autoNext=45`
- `showNextBtn` / `showAutoNextButton` / `nextEpisodeButton` (boolean-like, TV only): show or hide the manual Next Episode prompt button. Example: `?showNextBtn=false`
- `accent` (hex): Custom UI accent color (e.g. `B54666` without `#`)
- `autoPlay` (boolean-like, default: `true`): omit it for normal autoplay behavior. Pass `?autoPlay=false` to disable autoplay
- **Hide UI controls:** pass `hide`, `false`, `0`, or `off` to any of these keys:
  `pip`, `cast`, `fullscreen`, `volume`, `servers`, `captions`, `quality`, `play`, `rewind`, `forward`, `timegroup`, `timeslider`, `settings`

## 4. PostMessage API

Control the iframe from the parent page with:
`iframe.contentWindow.postMessage({ command, value }, '*')`

Supported commands:
- `play`
- `pause`
- `seek` or `start` with `value` in seconds
- `setVolume` with `value` from `0` to `1`
- `toggleMute`
- `toggleFullscreen`
- `getStatus`

## 5. Events & Progress Tracking

The iframe posts two message types back to the parent window:
- `PLAYER_EVENT` for playback changes like play, pause, seeked, ended, and timeupdate
- `MEDIA_DATA` for the full Peachify progress object you can store directly

`PLAYER_EVENT` has this top-level shape:
```json
{
  "type": "PLAYER_EVENT",
  "data": {
    "event": "play",
    "currentTime": 31.435372,
    "duration": 3609.867,
    "tmdbId": 76479,
    "mediaType": "tv",
    "season": 1,
    "episode": 1
  }
}
```

Example listener:
```javascript
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://peachify.top') return;

  if (event.data?.type === 'MEDIA_DATA') {
    const peachifyProgress = event.data.data;
    localStorage.setItem('peachifyProgress', JSON.stringify(peachifyProgress));
  }

  if (event.data?.type === 'PLAYER_EVENT') {
    const { event: playerEvent, currentTime, duration } = event.data.data;
    console.log(`Player ${playerEvent} at ${currentTime}s of ${duration}s`);
  }
});
```

## 6. Continue Watching Storage

The `MEDIA_DATA.data` payload can be stored as a JSON object like this:
```json
{
  "76479": {
    "id": 76479,
    "type": "tv",
    "title": "The Boys",
    "poster_path": "/2zmTngn1tYC1AvfnrFLhxeD82hz.jpg",
    "progress": {
      "watched": 31.435372,
      "duration": 3609.867
    },
    "last_season_watched": "1",
    "last_episode_watched": "1",
    "show_progress": {
      "s1e1": {
        "season": "1",
        "episode": "1",
        "progress": {
          "watched": 31.435372,
          "duration": 3609.867
        }
      }
    }
  },
  "786892": {
    "id": 786892,
    "type": "movie",
    "title": "Furiosa: A Mad Max Saga",
    "poster_path": "/iADOJ8Zymht2JPMoy3R7xceZprc.jpg",
    "backdrop_path": "/wNAhuOZ3Zf84jCIlrcI6JhgmY5q.jpg",
    "progress": {
      "watched": 8726.904767,
      "duration": 8891.763
    },
    "last_updated": 1725723972695
  }
}
```

## 7. Source & Subtitle Behavior

When no specific dub is requested, the player prefers:
1. sources containing `original`
2. sources containing `english`
3. the first available source

If `quality` / `q` is supplied, the player tries to match that quality when choosing the initial source.

If `sub` / `subtitle` is supplied, the player tries to match that subtitle label or language code first. If that match is unavailable, it only falls back to the stored subtitle choice. Otherwise subtitles stay off until the viewer picks one.

When switching to a hard-subbed source, the player temporarily turns off the active external subtitle track. If the user goes back to a regular dub, the preferred subtitle can be restored automatically.

For TV shows, the built-in settings menu now includes an Episodes browser so viewers can jump across seasons and episodes from inside the player.