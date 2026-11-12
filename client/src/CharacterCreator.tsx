/* ---------------- character creator （捏脸 / 形象设计） ----------------
   PUBG Mobile-style: pick your own face, hair, outfit and accessory with
   a LIVE 3D preview — the preview IS the game's figure (the same
   makeFigure both renderers use), so what you see is exactly what the
   map and every interior show. No second renderer, no 2D drawing.

   Two uses, one body (CreatorBody, controlled):
   - Start screen: inline, live draft — the creator IS the first screen.
     The draft lives in App's setupLook state; the single "开始过日子"
     button carries it into the new save. No modal, no save button.
   - In game: CharacterCreatorModal wraps the same body with 保存 / 取消.
     Opened in 1 tap from the HUD 🎨 button (primary) or the 过日子
     modal's "换个形象" (secondary). Saving writes the draft to the
     player state (face / hair / accessory / outfit) in one mutate. */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  makeFigure, addAccessory, disposeGroup, randomFaceSpec,
  FACE_SKINS, FACE_HAIRS, FACE_SKIN_NAMES, FACE_HAIR_NAMES,
  type FaceSpec,
} from "./figure";
import { HAIRS, ACCESSORIES } from "./living";
import { outfitOf } from "./data";
import { getLang } from "./i18n";

export interface CreatorDraft {
  face: FaceSpec;
  hair: number;
  accessory: number;
  outfit: string;
}

/** Live 3D preview: the real figure, slowly turning; drag to spin it. */
function FacePreview({ draft }: { draft: CreatorDraft }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const rebuildRef = useRef<(() => void) | null>(null);
  const firstRef = useRef(true);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2));
    const w = mount.clientWidth || 320;
    const h = mount.clientHeight || 260;
    renderer.setSize(w, h);
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 50);
    camera.position.set(0, 1.5, 4.6);
    camera.lookAt(0, 1.05, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(2, 4, 3);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0xbfd8ff, 0.55);
    fill.position.set(-2, 2, -2);
    scene.add(fill);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 32),
      new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.08 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.01;
    scene.add(ground);
    const mat = (c: number, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    let fig: ReturnType<typeof makeFigure> | null = null;
    let raf = 0;
    let rot = 0;
    let dragging = false;
    let lastX = 0;
    let auto = true;
    const rebuild = () => {
      const d = draftRef.current;
      if (fig) { scene.remove(fig.g); disposeGroup(fig.g); fig = null; }
      const o = outfitOf(d.outfit);
      fig = makeFigure(mat, o.shirt, o.pants, d.face.skin, undefined, d.face);
      // hair silhouette follows the chosen hairstyle (same scale MapView
      // applies per frame); the colour is the face spec's, not the style's
      const look = HAIRS[Math.max(0, Math.min(HAIRS.length - 1, d.hair))] ?? HAIRS[0]!;
      fig.mats.hairMesh.scale.set(look.sx, look.sy, 1);
      addAccessory(fig.g, ACCESSORIES[d.accessory]?.id);
      fig.g.rotation.y = rot;
      scene.add(fig.g);
    };
    rebuildRef.current = rebuild;
    rebuild();
    const el = renderer.domElement;
    el.style.touchAction = "none";
    el.style.cursor = "grab";
    const onDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; auto = false; el.style.cursor = "grabbing"; };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      rot += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
      if (fig) fig.g.rotation.y = rot;
    };
    const onUp = () => { dragging = false; el.style.cursor = "grab"; };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (auto && fig) { rot += dt * 0.45; fig.g.rotation.y = rot; }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (fig) { scene.remove(fig.g); disposeGroup(fig.g); }
      renderer.dispose();
      if (el.parentElement === mount) mount.removeChild(el);
    };
  }, []);

  // every draft change rebuilds the figure — the preview never lags the controls
  useEffect(() => {
    if (firstRef.current) { firstRef.current = false; return; }
    rebuildRef.current?.();
  }, [draft]);

  return <div ref={mountRef} className="h-[260px] w-full overflow-hidden rounded-[16px] bg-gradient-to-b from-[#fdf6da] to-[var(--surface2)]" aria-label="3D preview of your character" />;
}

/* ---------------- the creator body (shared by start screen + modal) ---------------- */

const hexCss = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

export function CreatorBody(p: {
  draft: CreatorDraft;
  onChange: (d: CreatorDraft) => void;
  seedFace: FaceSpec;
  outfits: string[];
}) {
  const en = getLang() === "en";
  const { draft, onChange, seedFace, outfits } = p;
  const f = draft.face;
  const setFace = (patch: Partial<FaceSpec>) => onChange({ ...draft, face: { ...f, ...patch } });
  const chip = (on: boolean) =>
    `rounded-full border px-2.5 py-1 text-[11px] font-black ${on ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--line)]"}`;
  const swatch = (on: boolean) =>
    `h-7 w-7 rounded-full border-2 ${on ? "border-[var(--accent)] scale-110" : "border-white/70"} shadow transition`;
  return (
    <div>
      <FacePreview draft={draft} />
      <p className="mt-1 text-center text-[11px] font-bold text-[var(--dim)]">
        {en ? "Live 3D preview — drag to spin. What you see is what the map shows." : "实时 3D 预览 · 拖动可以转着看，你看到的就是地图上那个你。"}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onChange({ ...draft, face: randomFaceSpec() })} className="rounded-full bg-[var(--text)] px-3 py-1.5 text-[11px] font-black text-[var(--bg)]">
          🎲 {en ? "Random face" : "随机一张脸"}
        </button>
        <button type="button" onClick={() => onChange({ ...draft, face: seedFace })} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[11px] font-black">
          ↺ {en ? "Back to my system face" : "回到系统给的脸"}
        </button>
      </div>

      <div className="mt-3">
        <p className="text-xs font-black text-[var(--dim)]">{en ? "Skin" : "肤色"}</p>
        <div className="mt-1.5 flex gap-2">
          {FACE_SKINS.map((c, i) => (
            <button key={c} type="button" aria-label={FACE_SKIN_NAMES[i]} title={FACE_SKIN_NAMES[i]} onClick={() => setFace({ skin: c })} className={swatch(f.skin === c)} style={{ background: hexCss(c) }} />
          ))}
        </div>
      </div>

      <div className="mt-3">
        <p className="text-xs font-black text-[var(--dim)]">{en ? "Face shape" : "脸型"}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {([["窄", 0.92], ["标准", 0.98], ["宽", 1.04]] as const).map(([label, v]) => (
            <button key={label} type="button" onClick={() => setFace({ faceWidth: v })} className={chip(Math.abs(f.faceWidth - v) < 0.005)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <p className="text-xs font-black text-[var(--dim)]">{en ? "Eyes" : "眼睛"}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {([["圆", "round"], ["细长", "narrow"], ["大", "wide"]] as const).map(([label, v]) => (
            <button key={v} type="button" onClick={() => setFace({ eyeShape: v as FaceSpec["eyeShape"] })} className={chip(f.eyeShape === v)}>{label}</button>
          ))}
        </div>
        <label className="mt-2 block text-[11px] font-bold text-[var(--dim)]">
          {en ? "Size" : "大小"}
          <input type="range" min={0.034} max={0.05} step={0.002} value={f.eyeSize} onChange={(e) => setFace({ eyeSize: Number(e.target.value) })} className="mt-0.5 w-full" />
        </label>
        <label className="mt-1 block text-[11px] font-bold text-[var(--dim)]">
          {en ? "Gap" : "间距"}
          <input type="range" min={0.095} max={0.135} step={0.005} value={f.eyeGap} onChange={(e) => setFace({ eyeGap: Number(e.target.value) })} className="mt-0.5 w-full" />
        </label>
      </div>

      <div className="mt-3">
        <p className="text-xs font-black text-[var(--dim)]">{en ? "Brows" : "眉毛"}</p>
        <label className="mt-1 block text-[11px] font-bold text-[var(--dim)]">
          {en ? "Angle" : "眉角"}
          <input type="range" min={-0.25} max={0.25} step={0.05} value={f.browAngle} onChange={(e) => setFace({ browAngle: Number(e.target.value) })} className="mt-0.5 w-full" />
        </label>
        <label className="mt-1 block text-[11px] font-bold text-[var(--dim)]">
          {en ? "Thickness" : "粗细"}
          <input type="range" min={0.7} max={1.5} step={0.1} value={f.browThick} onChange={(e) => setFace({ browThick: Number(e.target.value) })} className="mt-0.5 w-full" />
        </label>
      </div>

      <div className="mt-3">
        <p className="text-xs font-black text-[var(--dim)]">{en ? "Mouth" : "嘴"}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {([["微笑", "smile"], ["平", "flat"], ["张开", "open"], ["歪笑", "smirk"]] as const).map(([label, v]) => (
            <button key={v} type="button" onClick={() => setFace({ mouth: v as FaceSpec["mouth"] })} className={chip(f.mouth === v)}>{label}</button>
          ))}
        </div>
        <label className="mt-2 block text-[11px] font-bold text-[var(--dim)]">
          {en ? "Size" : "大小"}
          <input type="range" min={0.8} max={1.3} step={0.05} value={f.mouthSize} onChange={(e) => setFace({ mouthSize: Number(e.target.value) })} className="mt-0.5 w-full" />
        </label>
        <div className="mt-1.5 flex gap-1.5">
          <button type="button" onClick={() => setFace({ nose: true })} className={chip(f.nose)}>{en ? "Nose" : "有鼻子"}</button>
          <button type="button" onClick={() => setFace({ nose: false })} className={chip(!f.nose)}>{en ? "No nose" : "没鼻子"}</button>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-xs font-black text-[var(--dim)]">{en ? "Hair colour" : "发色"}</p>
        <div className="mt-1.5 flex gap-2">
          {FACE_HAIRS.map((c, i) => (
            <button key={`${c}-${i}`} type="button" aria-label={FACE_HAIR_NAMES[i]} title={FACE_HAIR_NAMES[i]} onClick={() => setFace({ hair: c })} className={swatch(f.hair === c)} style={{ background: hexCss(c) }} />
          ))}
        </div>
        <p className="mt-2 text-xs font-black text-[var(--dim)]">{en ? "Hairstyle" : "发型"}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {HAIRS.map((h, i) => (
            <button key={h.zh} type="button" onClick={() => onChange({ ...draft, hair: i })} className={chip(draft.hair === i)}>{en ? h.en : h.zh}</button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <p className="text-xs font-black text-[var(--dim)]">{en ? "Accessory" : "配饰"}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {ACCESSORIES.map((a, i) => (
            <button key={a.id} type="button" onClick={() => onChange({ ...draft, accessory: i })} className={chip(draft.accessory === i)}>{en ? a.en : a.zh}</button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <p className="text-xs font-black text-[var(--dim)]">{en ? "Outfit (yours)" : "衣服（已有的）"}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {outfits.map((id) => {
            const o = outfitOf(id);
            return (
              <button key={id} type="button" onClick={() => onChange({ ...draft, outfit: id })} className={chip(draft.outfit === id)}>
                {o.emoji} {o.name}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-[11px] text-[var(--dim)]">{en ? "New outfits come from the wardrobe at home." : "想穿别的衣服，去家里衣柜买。"}</p>
      </div>
    </div>
  );
}

/* ---------------- in-game modal wrapper (draft lives here until 保存） ---------------- */

export function CharacterCreatorModal(p: {
  initial: CreatorDraft;
  seedFace: FaceSpec;
  outfits: string[];
  onSave: (d: CreatorDraft) => void;
  onClose: () => void;
}) {
  const en = getLang() === "en";
  const [draft, setDraft] = useState<CreatorDraft>(p.initial);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={en ? "Create your look" : "捏个形象"}>
      <div className="rise max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="flex items-center justify-between">
          <span className="font-display text-xl font-black">🎨 {en ? "Create your look" : "捏个形象"}</span>
          <button type="button" onClick={p.onClose} className="rounded-full border px-3 py-1 text-xs font-black">✕</button>
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
          {en ? "Your face, your hair, your outfit — free, and everyone in the city sees it." : "脸、头发、衣服都自己定，免费，全城的人都看得到。"}
        </p>
        <div className="mt-3">
          <CreatorBody draft={draft} onChange={setDraft} seedFace={p.seedFace} outfits={p.outfits} />
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={p.onClose} className="flex-1 rounded-full border-2 border-[var(--border)] py-2.5 text-sm font-black">
            {en ? "Cancel" : "取消"}
          </button>
          <button type="button" onClick={() => p.onSave(draft)} className="flex-1 rounded-full bg-[var(--accent)] py-2.5 text-sm font-black text-white shadow-[3px_3px_0_var(--border)]">
            {en ? "Save this look ✓" : "就长这样 ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}
