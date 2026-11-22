---
stage: in-progress
title: 'Marketing videos: trending music picker'
status: in-progress
tags: [workflow, in-progress, marketing, video-editor, music, meta]
updated: 2026-11-23
kind: plan
---

# Marketing videos: trending music picker

**Goal:** a music picker like the Instagram / Facebook Story one, with **Trending**, **Popular** and grouped browsing (genres, moods, "For stays" collections). It should replace today's short, flat list of free tracks. The budget is free, or cheap if it has to be paid.

**Research date:** 2026-11-22. Re-check every vendor term below before building, because music API terms change often.

## Where we are today

| Piece     | Today                                                                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog   | Jamendo only (`_shared/jamendoMusic.ts`, `JAMENDO_CLIENT_ID`), plus uploads and import-by-URL                                                        |
| Browse    | `marketing-music` GET: `order=popularity_week \| popularity_total \| relevance`, `q`, `limit=20`. No genres, moods or collections                    |
| UI        | `JamendoTrackBrowser.tsx` (flat list) used by `VideoMusicSettings.tsx` and the media library                                                         |
| Export    | Jamendo streams are cached to `property-media` before `renderMediaOnWeb` (`exportAudio.ts`); the music is baked into the MP4                         |
| Publish   | `publish-to-meta` supports `REELS` via `publishType=instagram_reel`, but **the UI never sends it** (open gap in `marketing-meta-publishing-gaps.md`) |
| Meta auth | Facebook Login with `instagram_basic` + `instagram_content_publish` (`_shared/metaInboxConfig.ts`)                                                   |

The limit is not a project rule. Jamendo was picked because it was free and its files could be downloaded and baked into an export.

## Why "real" trending songs can't just be baked into the MP4

The ask was to set legality aside for now. The blocker is practical, not legal:

1. **Meta Rights Manager.** Any MP4 that contains a copyrighted pop song is audio-fingerprinted on upload. The usual result is muted audio, a blocked post or a restricted Page. The video goes out on the **host's own** Facebook Page and Instagram account, so the host takes the hit, however few users we have.
2. **Business accounts get a limited library even in the Instagram app.** Business accounts only see commercially cleared music. A host on a business account would not see the full trending list we are trying to copy, even in the Instagram app.
3. **No free API hands out full mainstream songs.** The ones that look like they might (Spotify, Deezer, Apple) only expose 30-second previews, and their terms forbid putting those into a video. See the rejected list below.

So the trending pop songs Instagram shows can only reach a post the way Instagram does it: **Meta attaches the song at publish time**, on its own servers, under its own licence.

## Options researched

| Option                                    | Trending / groups                                                      | Cost                                                                              | Full track in our export?                                                | Verdict                                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **Instagram Audio API** (`GET /ig_audio`) | No query returns **trending music on Instagram**; search by text       | Free (Graph API)                                                                  | No, Meta adds it on publish                                              | **Adopt for IG Reels**                                                               |
| **Jamendo, used fully**                   | `popularity_week/month`, plus `tags`/`fuzzytags` for genres and moods  | Free API                                                                          | Yes (already works)                                                      | **Adopt: base catalog**                                                              |
| **Audius API** (`/v1/tracks/trending`)    | Trending by week/month/year/all time, `genre` filter, `mood` field     | Free (probed 2026-11-22, no key needed)                                           | Yes, full streams                                                        | **Adopt as a second free source**                                                    |
| Epidemic Sound API                        | Moods, genres, curated collections, "similar to a Spotify song" search | Free prototype (50 downloads, no commercial licence); paid Scale price not public | Yes, licensed for social                                                 | **Paid fallback**: ask for a quote                                                   |
| Spotify Web API                           | Charts via playlists                                                   | Free                                                                              | No. `preview_url` removed for new apps (Nov 2024), no audio files at all | Rejected                                                                             |
| Deezer API (`/chart`)                     | Real global and genre charts                                           | Free                                                                              | 30 s preview only                                                        | Rejected: terms forbid combining content with video, local copies and commercial use |
| Apple Marketing Tools RSS + iTunes Search | Real "most played" charts per country                                  | Free                                                                              | 30 s preview only                                                        | Rejected: previews are for promoting sales; Rights Manager would mute the post       |
| YouTube / TikTok downloaders              | Anything                                                               | Free                                                                              | Yes                                                                      | Rejected: breaks terms, gets fingerprinted, breaks often                             |
| Feed.fm, 7digital / Songtradr, Lickd      | Licensed mainstream catalogs                                           | Enterprise contracts                                                              | Yes                                                                      | Out of budget for now                                                                |

### Instagram Audio API details (verified from Meta docs)

- `GET /ig_audio?audio_type=music&user_id=<ig-user-id>` with no `search_query` returns **trending** music. Add `search_query` to search. `audio_type=original_sound` returns trending original sounds.
- Fields: `audio_id`, `title`, `display_artist`, `cover_artwork_thumbnail_uri`, `duration_in_ms`, `download_url` (a preview that expires after about 1.5 days, may be null), `on_platform_audio_preview_link`.
- Publish: `POST /{ig-user-id}/media` with `media_type=REELS`, `video_url` and `audio_configuration={ audio_id, audio_volume 1-100, video_volume 1-100 }`, then `media_publish`.
- Login: Facebook Login or Unified Login, which we already use. Not available with Instagram Login. Business or Creator account with a linked Page. Scopes: `instagram_basic` + `instagram_content_publish`, which we already request.
- Limits: **Reels only** (Stories and Facebook Page Reels are not documented). There is **no start offset**, so the song plays from Meta's default point. **Meta does not preview the mixed result.** The catalog is "audio authorized for third party use" and may differ from the app.
- No genre browse endpoint. Our groups would have to be search terms (for example "chill", "summer", "travel").

## Recommended approach

There are two tiers, shown honestly in one picker.

1. **"In your video" music** (Jamendo + Audius): full tracks we can trim, loop, lower under voice and bake into the MP4. Works for every export, download and Story.
2. **"Trending on Instagram"** (Instagram Audio API): shown only when the property has a connected Instagram Business account and the video is going out as an **Instagram Reel**. Preview plays in the editor. On publish, Meta adds the song. The exported MP4 stays without it.

Picker layout (phone first, bottom sheet like Instagram):

```
[ Search music                    ]
For you | Trending | Instagram | Saved
-- Trending this week (Jamendo popularity_week + Audius week) --
-- Genres: Chill · Pop · Acoustic · Lo-fi · Electronic · Hip-hop
-- Moods: Happy · Calm · Romantic · Upbeat · Cinematic
-- For stays: Beach day · City nights · Cozy weekend · Family trip
```

Each row has cover art, title, artist, duration, a play/pause preview and **Use**. Instagram rows carry a small "Added by Instagram when you post a Reel" note.

## Status (2026-11-22)

Built on branch `sprmke/video-trending-music`, not merged. Phases 0 to 3 are implemented and tested with mocks. **Open: one live check against Meta**, see below.

### Spike results

| Question                                         | Result                                                                                                                                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audius trending, genre, mood and search, keyless | **Verified live.** `GET /v1/tracks/trending?time=&genre=` and `/tracks/search?mood=&genre=&sort_method=popular` work; stable `/tracks/{id}/stream` follows two redirects to a 320 kbps MP3 with open CORS                     |
| Audius catalog fit                               | Trending is mostly electronic and dubstep, some explicit, some multi-hour mixes. Filtered server-side (not explicit, 30 s to 5 min). Most tracks carry no licence field, so this is the legal risk the owner accepted for now |
| Jamendo tag and mood queries                     | **Not verified.** Jamendo's public sample key is suspended and the project key lives only in hosted secrets. Coded to the documented `tags` / `fuzzytags` / `order`; verify after deploy                                      |
| Instagram Audio API (`/ig_audio`)                | **Not verified live.** Needs a connected business account token. Implemented from Meta's docs and covered by mocked tests                                                                                                     |
| `/ig_audio` as a service                         | Docs say trending music comes back when `search_query` is empty; Reels only; no start offset; no preview of the mix                                                                                                           |

### Done

- **Phase 1 + 2 (free catalog):** `marketing-music` GET groups (`trending`, `popular`, 3 kinds of chips: genre, mood, "for stays"), Jamendo + Audius merged, per-source status, paging, `only=` for legacy callers; `import-track` for both sources; Audius cached for export like Jamendo.
- **Picker:** `MusicPicker` (search, section chips then genre/mood/stay rows, Saved on this device, previews, Show more, dual-source tip when Instagram is on, states for empty, error and every source off), phone sheet and desktop panel, replaces `JamendoTrackBrowser`. Music tool on the phone opens straight to it.
- **Phase 3 (Instagram):** Instagram switch in the picker, `project.instagramSong`, song bar and inspector card with volume, publish dialog Reel format, `instagramAudio` in `publish-to-meta`, Reels carry the caption, video "Post" becomes a Reel (also in the assistant publish path).
- **Tests:** Deno (groups, types, Audius, Instagram audio, catalog, Meta publish), Vitest (parity, types, payload, parser, export caching, publish format), happy-dom (hooks, picker, Instagram panel, song card), Playwright mocked (desktop + phone picker, Audius export caching with a real download, publish with a song).

### Open

- [ ] **Live check on dev or prod:** call `/ig_audio?audio_type=music` with a real connected account, confirm music (not only original sounds), preview link present, and publish one test Reel with `audio_configuration` (song, volume, start point). If `/ig_audio` returns no music for our app, hide the Instagram switch behind the `no_access` state (already handled) and leave the rest.
- [ ] **Jamendo tags:** after deploy, open Chill, Calm and Beach day with `JAMENDO_CLIENT_ID` set and check the Jamendo half is not empty. Adjust `_shared/musicGroups.ts` tags if so.
- [ ] Saved tracks are per browser. Move to a table if hosts ask for it on other devices.
- [ ] Phase 4 (Epidemic Sound) stays parked until hosts want licensed tracks for Facebook and Stories.
- [ ] Scheduling a Reel with an Instagram song is refused (400) until Instagram scheduling exists (see `marketing-meta-publishing-gaps.md`).

## Plans, RBAC and audit

- **RBAC:** browse uses `marketing:view`, and import or attach uses `marketing.content:edit`. Both are unchanged. The Instagram switch shows only for people who can publish.
- **Plans:** `Plans: N/A`. Music stays inside `marketingStudio`.
- **activity-log:** browsing and previewing are N/A because they are reads. Imports to Storage are N/A, same as the existing Jamendo import. The publish event (`marketing.published_to_meta`) now carries `audio_source` and `audio_id`.

## Docs to update when built

`docs/architecture/marketing-video-editor.md` (music sources, export rules), `docs/architecture/edge-functions.md` + `docs/PROJECT.md` (new params, `AUDIUS_*` env if any), `docs/guides/routes/org/property/marketing.md` (picker, Instagram note), the Help Center FAQ ("Why isn't my Instagram song in the downloaded video?").

## Sources

- Meta Instagram Audio API: https://developers.facebook.com/docs/instagram-platform/content-publishing/audio-api/
- Spotify Web API changes (Nov 2024): https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api
- Deezer developer guidelines and terms: https://developers.deezer.com/guidelines
- Audius trending tracks: https://docs.audius.org/developers/api/get-trending-tracks
- Epidemic Sound API: https://developers.epidemicsound.com/docs/ and https://www.epidemicsound.com/blog/free-api/
- Apple Music Feed: https://developer.apple.com/documentation/applemusicfeed
