// ROUND-10g Step 2 — chunk worker: builds chunk payloads off the main thread.
//
// The worker owns its own city data + landmarks factory (built once per city
// from the `init` message). It never touches the DOM, the scene, or any
// material used for rendering — it only produces serializable ChunkPayloads
// whose typed arrays cross back as transferables. The main thread
// materializes them (~1–2 ms per chunk) and owns all THREE objects.
//
// Protocol (main -> worker):
//   { type: "init", cityKey }            build city data + landmarks factory
//   { type: "build", key, buildId, playerBuildings }
//                                        generate + build one chunk payload
//   { type: "cancel", key }              drop a build that is no longer wanted
// Protocol (worker -> main):
//   { type: "ready", cityKey, chunks }   init done
//   { type: "built", key, buildId, payload }  (payload arrays transferred)
import * as THREE from "three";
import {
  buildCityData, generateChunkData, buildChunkPayload, payloadTransferables, ROAD_W,
  type ChunkCityData, type PlayerBuildingData,
} from "./chunks";
import { createLandmarks, type LandmarksFactory } from "./landmarks";
import { ROADS } from "./roads";
import type { CityKey } from "./data";

let cityData: ChunkCityData | null = null;
let landmarks: LandmarksFactory | null = null;
const cancelled = new Set<string>();

interface InitMsg { type: "init"; cityKey: CityKey }
interface BuildMsg { type: "build"; key: string; buildId: number; playerBuildings: PlayerBuildingData[] }
interface CancelMsg { type: "cancel"; key: string }
type InMsg = InitMsg | BuildMsg | CancelMsg;

self.onmessage = (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  if (msg.type === "init") {
    // a dummy texture: the factory only uses it as an emissiveMap on
    // materials, which the worker never renders — the geometry is identical
    const winTex = new THREE.Texture();
    landmarks = createLandmarks(winTex);
    const roads = ROADS[msg.cityKey].map((r) => ({ ...r, w: r.w * ROAD_W }));
    cityData = buildCityData(msg.cityKey, roads, landmarks);
    self.postMessage({ type: "ready", cityKey: msg.cityKey, chunks: cityData.chunkKeys.length });
    return;
  }
  if (msg.type === "cancel") {
    cancelled.add(msg.key);
    return;
  }
  if (msg.type === "build") {
    if (!cityData || !landmarks) return;
    if (cancelled.has(msg.key)) { cancelled.delete(msg.key); return; }
    const data = generateChunkData(cityData, msg.key, msg.playerBuildings);
    const payload = buildChunkPayload(data, { cityKey: cityData.cityKey, landmarks, locById: cityData.locById });
    const transfer = payloadTransferables(payload);
    self.postMessage({ type: "built", key: msg.key, buildId: msg.buildId, payload }, transfer);
  }
};
