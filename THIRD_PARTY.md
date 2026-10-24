# Sources retained in this local integration

- Room of Memories: 404-NOT-FOUND-ERROR, revision 8fea2169, MIT; original room scene retained and adapted for host navigation and state.
- Voxel Beat Planet: EverettFish, revision 87b2a66e, MIT; original terrain core, instanced voxel planet and wave shader, voxel builder with baked AO, layered kit, spherical anchors, climate interpolation, lighting and glow in planet/engine/, plus offline audio analysis in vendor/planet-audio.js. Engine files are copied unchanged; the authored city models, itinerary, controls and scene composition live in src/scene/ and planet/js/. Three.js r160 is supplied as the engine's THREE binding. See vendor/LICENSE-voxel-beat.txt.
  Since 0.5.0, the active renderer uses room-style low-poly meshes and a continuous adaptation of the travelling-wave equations in src/scene/surface-wave.js. The upstream voxel renderer, kit, lighting and glow remain preserved as reference files but are not loaded. Terrain coordinates/noise, spherical placement and climate remain in use; voxelmodel is loaded for its Surf coordinate helpers only, without building voxel geometry.
- Footprints Globe: Iris Zhou, revision aad6f440, MIT; local-data/backup approach informed the earlier integration. The geographic globe was replaced by a music planet on 2026-10-24; city positions are now authored scenery, not real coordinates. See vendor/LICENSE-footprints.txt.
- Three.js r160 (MIT), Lucide 0.468.0 (ISC), D3 Geo / D3 Array (ISC), TopoJSON Client (ISC): corresponding licenses in vendor/.
- World Atlas 110m: Natural Earth data, public domain. https://www.naturalearthdata.com/about/terms-of-use/
- Built-in 64-second audio is a locally synthesized demonstration, not a recording supplied by any upstream project. Users can select their own local music.
- Public preview images are from Room of Memories. User photos, notes and music stay in browser storage and must not be committed into this repository.
