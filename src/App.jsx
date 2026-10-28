import { currentPage } from "./lib/deployment";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Axis3D,
  BookOpen,
  Box,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CloudOff,
  Copy,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  FileJson,
  FolderOpen,
  Grid2X2,
  Grip,
  Hand,
  Image,
  ImagePlus,
  Layers,
  LayoutTemplate,
  Leaf,
  Lightbulb,
  LoaderCircle,
  Maximize,
  Minus,
  MousePointer2,
  Move3D,
  Orbit,
  Palette,
  Play,
  Plus,
  Printer,
  Redo2,
  Rocket,
  RotateCcw,
  RotateCw,
  Save,
  ScanLine,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Smile,
  Sparkles,
  SquareMousePointer,
  Sun,
  Trash2,
  Undo2,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import StudioCanvas from "./components/StudioCanvas";
import AssetImage from "./components/AssetImage";
import Viewer from "./components/Viewer";
import PrintPage from "./components/PrintPage";
import ShareModal from "./components/ShareModal";
import MarkerMaker from "./components/MarkerMaker";
import MiniProjects from "./components/MiniProjects";
import CollectionViewer from "./components/CollectionViewer";
import {
  loadMiniProjects,
  saveMiniProjects,
  newMiniProject,
  newMiniEntry,
  nextTargetIndex,
  MAX_MINIS,
  MAX_FLASHCARDS,
} from "./lib/mini-projects";
import { saveLocalFile } from "./lib/local-files";
import { ActionEditor } from "./components/ModelActions";
import { loadMyMarkers, saveMyMarkers } from "./lib/marker-maker";
import {
  CardProperties,
  LessonToolsPanel,
  TeacherSignIn,
} from "./components/CardEditor";
import { CARD_ICONS, LessonCardSheet } from "./components/LessonCards";
import {
  CARD_TYPE_NAMES,
  MAX_CARDS,
  newCard,
  validateCard,
} from "./lib/lesson-cards";
import { cloudEnabled, useTeacherSession } from "./lib/cloud";
import { EmptyState, IconButton, Logo, Modal } from "./components/UI";
import {
  ASSETS,
  MARKERS,
  catalogue,
  getAsset,
  getMarker,
  registerCustomMarker,
  registerSharedModel,
  sceneObject,
} from "./lib/assets";
import {
  ACTIVE_KEY,
  MAX_OBJECTS,
  TEMPLATES,
  clone,
  downloadProject,
  loadProjects,
  newProject,
  saveProjects,
  validateProject,
} from "./lib/projects";

export default function App() {
  const [location, setLocation] = useState(() => window.location.href);
  useEffect(() => {
    const update = () => setLocation(window.location.href);
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  const page = currentPage();
  if (page === "collection") return <CollectionViewer key={location} />;
  if (page === "view") return <Viewer key={location} />;
  if (page === "print") return <PrintPage key={location} />;
  return <StudioApp />;
}
function StudioApp() {
  const [projects, setProjects] = useState(loadProjects);
  const [minis, setMinis] = useState(loadMiniProjects);
  const [selectedMiniId, setSelectedMiniId] = useState(null);
  const [miniSaveState, setMiniSaveState] = useState("saved");
  const [miniReturnId, setMiniReturnId] = useState(null);
  const [currentId, setCurrentId] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_KEY);
    } catch {
      return null;
    }
  });
  const project = projects.find((p) => p.id === currentId) || projects[0];
  const [page, setPage] = useState(() =>
      new URLSearchParams(window.location.search).get("studio") === "1"
        ? "studio"
        : "mini",
    ),
    [selectedId, setSelectedId] = useState(project?.objects[0]?.id || null),
    [libraryTab, setLibraryTab] = useState("objects"),
    [inspectorTab, setInspectorTab] = useState("object");
  const [category, setCategory] = useState("All"),
    [search, setSearch] = useState(""),
    [tool, setTool] = useState("select"),
    [grid, setGrid] = useState(true),
    [markerVisible, setMarkerVisible] = useState(false),
    [playing, setPlaying] = useState(false),
    [saveState, setSaveState] = useState("saving");
  const [dialog, setDialog] = useState(null),
    [shareProject, setShareProject] = useState(null),
    [shareImage, setShareImage] = useState(""),
    [toast, setToast] = useState(null),
    [libraryOpen, setLibraryOpen] = useState(false),
    [inspectorOpen, setInspectorOpen] = useState(false),
    [deleteTarget, setDeleteTarget] = useState(null),
    [pickCardId, setPickCardId] = useState(null),
    [previewCard, setPreviewCard] = useState(null);
  const teacher = useTeacherSession();
  const [myMarkers, setMyMarkers] = useState(() =>
    loadMyMarkers((m) => registerCustomMarker(m)?.definition || null),
  );
  useEffect(() => {
    saveMyMarkers(myMarkers);
  }, [myMarkers]);
  const canvas = useRef(null),
    toastTimer = useRef(null),
    history = useRef({ past: [], future: [] }),
    importRef = useRef(null),
    latest = useRef({});
  const selected = project?.objects.find((o) => o.id === selectedId);
  const cards = project?.cards || [];
  const selectedCard = cards.find((c) => c.id === selectedId);
  latest.current = { project, projects, page, selectedId, dialog, pickCardId };
  const notify = useCallback((message, type = "success") => {
    clearTimeout(toastTimer.current);
    setToast({ message, type, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }, []);
  useEffect(() => {
    setSaveState("saving");
    const timer = setTimeout(
      () => setSaveState(saveProjects(projects) ? "saved" : "error"),
      500,
    );
    return () => clearTimeout(timer);
  }, [projects]);
  useEffect(() => {
    const ok = saveMiniProjects(minis);
    setMiniSaveState(ok ? "saved" : "error");
    if (!ok)
      notify(
        "Could not save mini projects on this device. Check browser storage.",
        "error",
      );
  }, [minis, notify]);
  useEffect(() => {
    if (!project) return;
    try {
      localStorage.setItem(ACTIVE_KEY, project.id);
    } catch {}
  }, [project?.id]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const commit = useCallback((update) => {
    setProjects((prev) => {
      const active = prev.find((p) => p.id === latest.current.project?.id);
      if (!active) return prev;
      history.current.past.push(clone(active));
      history.current.past = history.current.past.slice(-50);
      history.current.future = [];
      const next =
        typeof update === "function"
          ? update(clone(active))
          : { ...active, ...update };
      next.updatedAt = new Date().toISOString();
      return prev.map((p) => (p.id === active.id ? next : p));
    });
  }, []);
  function updateObject(id, patch) {
    commit((p) => ({
      ...p,
      objects: p.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  }
  function selectObject(id) {
    setSelectedId(id);
    setPickCardId(null);
    if (id) setInspectorTab("object");
  }
  function selectCard(id) {
    setSelectedId(id);
    setInspectorTab("object");
    setPlaying(false);
    setTool("select");
    if (pickCardId && pickCardId !== id) setPickCardId(null);
  }
  function addCard(type) {
    const current = latest.current.project;
    if (!current) return;
    if ((current.cards || []).length >= MAX_CARDS) {
      notify(`Keep each scene to ${MAX_CARDS} lesson boxes.`, "error");
      return;
    }
    const card = newCard(type, current, latest.current.selectedId);
    commit((p) => ({ ...p, cards: [...(p.cards || []), card] }));
    selectCard(card.id);
    setLibraryOpen(false);
    if (window.matchMedia?.("(max-width: 1100px)").matches)
      setInspectorOpen(true);
    notify(`${CARD_TYPE_NAMES[type]} added. Write your explanation.`);
  }
  function updateCard(id, patch) {
    commit((p) => ({
      ...p,
      cards: (p.cards || []).map((c) => {
        if (c.id !== id) return c;
        const next = validateCard(
          { ...c, ...patch },
          new Set(p.objects.map((o) => o.id)),
        );
        return next || c;
      }),
    }));
  }
  function duplicateCard() {
    if (!selectedCard) return;
    if (cards.length >= MAX_CARDS) {
      notify(`Keep each scene to ${MAX_CARDS} lesson boxes.`, "error");
      return;
    }
    const card = {
      ...clone(selectedCard),
      id: crypto.randomUUID(),
      title: `${selectedCard.title} copy`.slice(0, 60),
      position: [
        Math.min(6, selectedCard.position[0] + 0.5),
        Math.max(-0.5, selectedCard.position[1] - 0.5),
        selectedCard.position[2],
      ],
    };
    commit((p) => ({ ...p, cards: [...(p.cards || []), card] }));
    selectCard(card.id);
    notify("Lesson box duplicated.");
  }
  function pickPoint(objectId, point) {
    const id = latest.current.pickCardId;
    if (!id) return;
    updateCard(id, { target: { objectId, point } });
    setPickCardId(null);
    const name = latest.current.project.objects.find(
      (o) => o.id === objectId,
    )?.name;
    notify(`The box now points to ${name || "this model"}.`);
  }
  function addObject(assetId, position) {
    if (!ASSETS.some((a) => a.id === assetId)) return;
    if ((latest.current.project?.objects.length || 0) >= MAX_OBJECTS) {
      notify(
        `Your scene is full of wonder! Keep it to ${MAX_OBJECTS} objects so it runs smoothly on a phone.`,
        "error",
      );
      return;
    }
    const index = latest.current.project?.objects.length || 0;
    const o = sceneObject(
      assetId,
      position || [
        ((index % 3) - 1) * 0.7,
        0,
        ((Math.floor(index / 3) % 3) - 1) * 0.7,
      ],
      0.8,
    );
    commit((p) => ({ ...p, objects: [...p.objects, o] }));
    selectObject(o.id);
    setPlaying(false);
    notify(`${getAsset(assetId).name} added. Make it yours!`);
  }
  function deleteObject(id = selectedId) {
    if (!id) return;
    if ((latest.current.project?.cards || []).some((c) => c.id === id)) {
      commit((p) => ({ ...p, cards: p.cards.filter((c) => c.id !== id) }));
      setSelectedId(null);
      setPickCardId(null);
      notify("Lesson box removed. Undo is always here.");
      return;
    }
    commit((p) => ({
      ...p,
      objects: p.objects.filter((o) => o.id !== id),
      cards: (p.cards || []).map((c) =>
        c.target?.objectId === id ? { ...c, target: null } : c,
      ),
    }));
    setSelectedId(null);
    notify("Object removed. Undo is always here.");
  }
  function duplicateObject() {
    if (!selected) return;
    if (project.objects.length >= MAX_OBJECTS) {
      notify(`The mobile-friendly limit is ${MAX_OBJECTS} objects.`, "error");
      return;
    }
    const o = {
      ...clone(selected),
      id: crypto.randomUUID(),
      name: `${selected.name} copy`.slice(0, 35),
      position: [
        Math.min(4, selected.position[0] + 0.35),
        selected.position[1],
        Math.min(4, selected.position[2] + 0.35),
      ],
    };
    commit((p) => ({ ...p, objects: [...p.objects, o] }));
    selectObject(o.id);
    notify("A little more of a good thing. Object duplicated.");
  }
  function undo() {
    const h = history.current;
    if (!h.past.length) return;
    const previous = h.past.pop();
    h.future.push(clone(latest.current.project));
    setProjects((prev) =>
      prev.map((p) => (p.id === previous.id ? previous : p)),
    );
    setSelectedId(null);
    setPlaying(false);
  }
  function redo() {
    const h = history.current;
    if (!h.future.length) return;
    const next = h.future.pop();
    h.past.push(clone(latest.current.project));
    setProjects((prev) => prev.map((p) => (p.id === next.id ? next : p)));
    setSelectedId(null);
  }
  function saveNow() {
    const ok = saveProjects(latest.current.projects);
    setSaveState(ok ? "saved" : "error");
    notify(
      ok
        ? "Saved on this device. Your ideas are safe here."
        : "Device storage is full or unavailable. Export your project as a backup.",
      ok ? "success" : "error",
    );
  }
  function openProject(p, fromMini = null) {
    setMiniReturnId(typeof fromMini === "string" ? fromMini : null);
    setCurrentId(p.id);
    setSelectedId(p.objects[0]?.id || null);
    setPage("studio");
    setPlaying(false);
    history.current = { past: [], future: [] };
    setLibraryOpen(false);
    setInspectorOpen(false);
  }
  function createProject(templateId) {
    if (projects.length >= 300) {
      notify(
        "This demo holds 300 scenes. Export a backup and remove an old project first.",
        "error",
      );
      return;
    }
    const p = newProject(templateId);
    setProjects((prev) => [p, ...prev]);
    openProject(p);
    notify(
      templateId === "blank"
        ? "A fresh canvas. What will you imagine?"
        : "Your new adventure starts here.",
    );
  }
  function navigate(next) {
    if (next === "studio" && !project) {
      createProject("blank");
      return;
    }
    setPage(next);
    setLibraryOpen(false);
    setInspectorOpen(false);
  }
  function duplicateProject(p) {
    if (projects.length >= 300) {
      notify("This demo holds up to 300 scenes.", "error");
      return;
    }
    const ids = new Map(p.objects.map((o) => [o.id, crypto.randomUUID()]));
    const dup = {
      ...clone(p),
      id: crypto.randomUUID(),
      title: `${p.title} copy`.slice(0, 70),
      objects: p.objects.map((o) => ({ ...clone(o), id: ids.get(o.id) })),
      cards: (p.cards || []).map((c) => ({
        ...clone(c),
        id: crypto.randomUUID(),
        target: c.target
          ? { ...clone(c.target), objectId: ids.get(c.target.objectId) }
          : null,
      })),
      updatedAt: new Date().toISOString(),
    };
    setProjects((prev) => [dup, ...prev]);
    notify("Project duplicated. Double the possibilities.");
  }
  function removeProject() {
    setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    if (project?.id === deleteTarget.id) {
      setCurrentId(null);
      setSelectedId(null);
      history.current = { past: [], future: [] };
    }
    setDeleteTarget(null);
    notify("Project removed from this device.");
  }
  async function importProject(event) {
    const f = event.target.files?.[0];
    event.target.value = "";
    if (!f) return;
    try {
      if (f.size > 200000)
        throw new Error("Choose a Wonderlab JSON project smaller than 200 KB.");
      if (projects.length >= 300)
        throw new Error("This demo holds up to 300 scenes.");
      const p = validateProject(JSON.parse(await f.text()));
      p.id = crypto.randomUUID();
      setProjects((prev) => [p, ...prev]);
      openProject(p);
      notify("Project imported. Welcome back to your world.");
    } catch (e) {
      notify(e.message || "This project could not be imported.", "error");
    }
  }
  function updateMini(id, patch) {
    setMinis((list) =>
      list.map((mini) =>
        mini.id === id
          ? { ...mini, ...patch, updatedAt: new Date().toISOString() }
          : mini,
      ),
    );
    // Keep each card's editor marker in sync with the target selected in the mini project.
    if (Object.hasOwn(patch, "sharedTarget") || Object.hasOwn(patch, "mode")) {
      const mini = minis.find((m) => m.id === id);
      if (!mini) return;
      const next = { ...mini, ...patch };
      setProjects((list) =>
        list.map((scene) => {
          const entry = next.entries.find((e) => e.sceneId === scene.id);
          if (!entry) return scene;
          const target =
            next.mode === "shared" ? next.sharedTarget : entry.target;
          if (!entry.marker || !target) return scene;
          const marker = registerCustomMarker({
            id: `custom:${entry.id}`,
            name: entry.title,
            image: entry.marker.ref,
            target: target.ref,
          });
          return marker
            ? { ...scene, markerId: marker.id, marker: marker.definition }
            : scene;
        }),
      );
    }
  }
  function createMini(title, mode) {
    if (minis.length >= MAX_MINIS) {
      notify(`Keep up to ${MAX_MINIS} mini projects on this device.`, "error");
      return;
    }
    const mini = newMiniProject(title, mode);
    setMinis((list) => [mini, ...list]);
    setSelectedMiniId(mini.id);
    setMiniReturnId(null);
    setPage("mini");
  }
  function addMiniEntries(miniId, markerFiles = [null]) {
    const mini = minis.find((m) => m.id === miniId);
    if (
      !mini ||
      mini.entries.length + markerFiles.length > MAX_FLASHCARDS ||
      projects.length + markerFiles.length > 300
    ) {
      notify(
        "This workspace is full. Remove an old card or project first.",
        "error",
      );
      return;
    }
    const entries = [...mini.entries],
      scenes = [];
    for (const file of markerFiles) {
      const scene = newProject("blank");
      const title = file
        ? file.name
            .replace(/\.[^.]+$/, "")
            .replace(/[_-]+/g, " ")
            .slice(0, 70)
        : `Card ${entries.length + 1}`;
      scene.title = title || `Card ${entries.length + 1}`;
      const entry = newMiniEntry(
        scene.id,
        scene.title,
        mini.mode === "individual" ? 0 : nextTargetIndex(entries),
      );
      if (file) entry.marker = file;
      const target = mini.mode === "shared" ? mini.sharedTarget : null;
      if (file && target) {
        const marker = registerCustomMarker({
          id: `custom:${entry.id}`,
          name: entry.title,
          image: file.ref,
          target: target.ref,
        });
        if (marker) {
          scene.markerId = marker.id;
          scene.marker = marker.definition;
        }
      }
      entries.push(entry);
      scenes.push(scene);
    }
    setProjects((list) => [...scenes, ...list]);
    updateMini(miniId, { entries });
    notify(
      `${markerFiles.length} ${markerFiles.length === 1 ? "card" : "cards"} added to your project.`,
    );
  }
  function updateMiniEntry(miniId, entryId, patch) {
    const mini = minis.find((m) => m.id === miniId),
      entry = mini?.entries.find((e) => e.id === entryId);
    if (!mini || !entry) return;
    const next = { ...entry, ...patch };
    let modelObject;
    const currentScene = projects.find((scene) => scene.id === entry.sceneId);
    const previousModel = currentScene?.objects.find(
      (object) => object.id === entry.modelObjectId,
    );
    if (patch.model) {
      if (
        !previousModel &&
        (currentScene?.objects.length || 0) >= MAX_OBJECTS
      ) {
        notify(
          `This scene already has ${MAX_OBJECTS} objects. Remove one in the scene editor before uploading another model.`,
          "error",
        );
        return;
      }
      const model = {
        id: `upload-${patch.model.id}`,
        name: next.title || "Uploaded model",
        category: "Your uploads",
        file: `uploads/${patch.model.id}.glb`,
        height: 1.5,
        rotation: [0, 0, 0],
        animate: true,
      };
      const asset = registerSharedModel(model);
      modelObject = sceneObject(asset.id, [0, 0, 0], 1);
      next.modelObjectId = previousModel?.id || modelObject.id;
    }
    updateMini(miniId, {
      entries: mini.entries.map((e) => (e.id === entryId ? next : e)),
    });
    setProjects((list) =>
      list.map((scene) => {
        if (scene.id !== entry.sceneId) return scene;
        const result = {
          ...scene,
          ...(Object.hasOwn(patch, "title") ? { title: patch.title } : {}),
          updatedAt: new Date().toISOString(),
        };
        const target = mini.mode === "shared" ? mini.sharedTarget : next.target;
        if (next.marker && target) {
          const marker = registerCustomMarker({
            id: `custom:${next.id}`,
            name: next.title,
            image: next.marker.ref,
            target: target.ref,
          });
          if (marker) {
            result.markerId = marker.id;
            result.marker = marker.definition;
          }
        }
        if (modelObject) {
          const existing = scene.objects.find(
            (o) => o.id === entry.modelObjectId,
          );
          result.objects = existing
            ? scene.objects.map((o) =>
                o.id === existing.id
                  ? {
                      ...modelObject,
                      id: existing.id,
                      position: o.position,
                      rotation: o.rotation,
                      scale: o.scale,
                      visible: o.visible,
                    }
                  : o,
              )
            : [...scene.objects, modelObject];
        }
        return result;
      }),
    );
  }
  function editMiniEntry(miniId, entry) {
    const scene = projects.find((p) => p.id === entry.sceneId);
    if (scene) {
      setSelectedMiniId(miniId);
      openProject(scene, miniId);
    }
  }
  function removeMiniEntry(miniId, entry) {
    if (!window.confirm(`Remove “${entry.title}” from this mini project?`))
      return;
    const mini = minis.find((m) => m.id === miniId);
    if (!mini) return;
    updateMini(miniId, {
      entries: mini.entries.filter((e) => e.id !== entry.id),
    });
    setProjects((list) => list.filter((scene) => scene.id !== entry.sceneId));
  }
  function removeMini(mini) {
    if (
      !window.confirm(
        `Delete “${mini.title}” and its ${mini.entries.length} card scenes from this device?`,
      )
    )
      return;
    const ids = new Set(mini.entries.map((e) => e.sceneId));
    setMinis((list) => list.filter((m) => m.id !== mini.id));
    setProjects((list) => list.filter((scene) => !ids.has(scene.id)));
    setSelectedMiniId(null);
    setMiniReturnId(null);
  }
  function saveBeforePreview() {
    const ok = saveMiniProjects(minis) && saveProjects(projects);
    if (!ok)
      notify(
        "Could not save this draft for preview. Check browser storage.",
        "error",
      );
    return ok;
  }
  async function makeMiniFromCurrentScene() {
    if (!project || minis.length >= MAX_MINIS || projects.length >= 300) {
      notify("This workspace is full. Remove an old project first.", "error");
      return;
    }
    const scene = clone(project);
    scene.id = crypto.randomUUID();
    const mini = newMiniProject(scene.title, "individual");
    const entry = newMiniEntry(scene.id, scene.title, 0);
    // Preserve the existing single-marker scene when possible. If a remote host
    // blocks access, the user can upload the same two files in the new project.
    try {
      const marker = getMarker(project.markerId);
      const [imageResponse, targetResponse] = await Promise.all([
        fetch(marker.image),
        fetch(marker.target),
      ]);
      if (!imageResponse.ok || !targetResponse.ok)
        throw new Error("marker unavailable");
      const image = await imageResponse.blob(),
        target = await targetResponse.blob();
      const extension = image.type.includes("png")
        ? "png"
        : image.type.includes("webp")
          ? "webp"
          : "jpg";
      entry.marker = await saveLocalFile(
        new File([image], `marker.${extension}`, { type: image.type }),
        "marker",
      );
      entry.target = await saveLocalFile(
        new File([target], "target.mind", { type: "application/octet-stream" }),
        "target",
      );
    } catch {
      /* upload slots remain available */
    }
    mini.entries = [entry];
    setProjects((list) => [scene, ...list]);
    setMinis((list) => [mini, ...list]);
    setSelectedMiniId(mini.id);
    setMiniReturnId(null);
    setDialog(null);
    setPage("mini");
    notify(
      entry.marker && entry.target
        ? "Your scene and marker are ready in a mini project."
        : "Your scene is in a mini project. Upload its marker and .mind file to finish.",
    );
  }
  function openShare(print = false) {
    setShareProject(clone(project));
    setShareImage(canvas.current?.capture() || "");
    setDialog(print ? "print" : "share");
    saveProjects(latest.current.projects);
  }
  useEffect(() => {
    const key = (e) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement?.tagName,
        ) ||
        latest.current.dialog ||
        deleteTarget
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveNow();
      }
      if (latest.current.page !== "studio") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteObject(latest.current.selectedId);
      }
      if (e.key === "Escape" && latest.current.pickCardId) {
        setPickCardId(null);
        return;
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        setLibraryOpen(false);
        setInspectorOpen(false);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [deleteTarget]);
  const assets = ASSETS.filter(
    (a) =>
      (category === "All" || a.category === category) &&
      `${a.name} ${a.category}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          className="brand-button"
          onClick={() => navigate("studio")}
          aria-label="Wonderlab creation studio"
        >
          <Logo />
          <span className="brand-descriptor">A SPACE TO CREATE</span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          <button
            aria-label="Create"
            className={
              page === "studio" || page === "marker-maker" ? "active" : ""
            }
            onClick={() => navigate("studio")}
          >
            <WandSparkles size={17} />
            <span>Create</span>
          </button>
          <button
            aria-label="Mini projects"
            className={page === "mini" ? "active" : ""}
            onClick={() => navigate("mini")}
          >
            <Layers size={17} />
            <span>Mini projects</span>
            <span className="nav-new">NEW</span>
          </button>
          <button
            aria-label="My projects"
            className={page === "projects" ? "active" : ""}
            onClick={() => navigate("projects")}
          >
            <FolderOpen size={17} />
            <span>My projects</span>
          </button>
          <button
            aria-label="Templates"
            className={page === "templates" ? "active" : ""}
            onClick={() => navigate("templates")}
          >
            <LayoutTemplate size={17} />
            <span>Templates</span>
            <span className="nav-new">NEW</span>
          </button>
        </nav>
        <div className="header-right">
          <IconButton
            label="How Wonderlab works"
            onClick={() => setDialog("help")}
          >
            <CircleHelp size={19} />
          </IconButton>
          <span className="header-divider" />
          <button
            className="creator-profile"
            aria-label="About this demo workspace"
            onClick={() => setDialog("about")}
          >
            <span className="creator-avatar">
              <Smile size={25} />
            </span>
            <span>
              <strong>Creator space</strong>
              <small>
                <span />
                Local demo
              </small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
      </header>
      {page === "studio" && project ? (
        <>
          <section className="project-toolbar">
            <div className="project-info">
              <button
                className="back-button"
                onClick={() => navigate(miniReturnId ? "mini" : "projects")}
                title={
                  miniReturnId ? "Back to mini project" : "Back to my projects"
                }
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <div className="project-breadcrumb">
                  <span>{miniReturnId ? "Mini projects" : "My projects"}</span>
                  <ChevronRight size={11} />
                  <span>3D & AR creation</span>
                </div>
                <div className="project-title-row">
                  <input
                    aria-label="Project title"
                    value={project.title}
                    maxLength={70}
                    onChange={(e) => commit({ title: e.target.value })}
                    onBlur={() => {
                      if (!project.title.trim())
                        commit({ title: "My new creation" });
                    }}
                  />
                  <span className="project-subject">
                    <Orbit size={12} />
                    {getMarker(project.markerId).name}
                  </span>
                </div>
              </div>
            </div>
            <div className="project-actions">
              <div className="history-actions">
                <IconButton
                  label="Undo (Ctrl+Z)"
                  disabled={!history.current.past.length}
                  onClick={undo}
                >
                  <Undo2 size={18} />
                </IconButton>
                <IconButton
                  label="Redo (Ctrl+Shift+Z)"
                  disabled={!history.current.future.length}
                  onClick={redo}
                >
                  <Redo2 size={18} />
                </IconButton>
              </div>
              <span className="toolbar-divider" />
              <button
                className={`button save-button ${saveState === "error" ? "storage-error" : ""}`}
                onClick={
                  saveState === "error"
                    ? () => downloadProject(project)
                    : saveNow
                }
              >
                {saveState === "saving" ? (
                  <LoaderCircle size={15} className="spin" />
                ) : saveState === "error" ? (
                  <CloudOff size={15} />
                ) : (
                  <CheckCheck size={16} />
                )}
                <span>
                  {saveState === "saving"
                    ? "Saving…"
                    : saveState === "error"
                      ? "Export backup"
                      : "Saved"}
                </span>
              </button>
              <button
                className="button secondary preview-button"
                onClick={() => setDialog("preview")}
              >
                <Play size={15} />
                <span>Preview</span>
              </button>
              <button
                className="button primary publish-button"
                onClick={() => (miniReturnId ? navigate("mini") : openShare())}
              >
                <Share2 size={16} />
                <span>
                  {miniReturnId ? "Back to mini project" : "Publish & share"}
                </span>
                <ArrowUpRight size={15} />
              </button>
            </div>
          </section>
          <div
            className={`editor-layout ${libraryOpen ? "library-open" : ""} ${inspectorOpen ? "inspector-open" : ""}`}
          >
            {(libraryOpen || inspectorOpen) && (
              <button
                className="drawer-backdrop"
                aria-label="Close side panel"
                onClick={() => {
                  setLibraryOpen(false);
                  setInspectorOpen(false);
                }}
              />
            )}
            <aside className="library-panel">
              <div className="library-heading">
                <div>
                  <span className="eyebrow">A LITTLE CREATIVE FUEL</span>
                  <h2>
                    Your toolbox<span>✦</span>
                  </h2>
                </div>
                <IconButton
                  className="drawer-close"
                  label="Close object library"
                  onClick={() => setLibraryOpen(false)}
                >
                  <X size={18} />
                </IconButton>
              </div>
              <div className="library-tabs">
                <button
                  className={libraryTab === "objects" ? "active" : ""}
                  onClick={() => setLibraryTab("objects")}
                >
                  <Box size={16} />
                  Objects<span>{ASSETS.length}</span>
                </button>
                <button
                  className={libraryTab === "lesson" ? "active" : ""}
                  onClick={() => setLibraryTab("lesson")}
                >
                  <BookOpen size={16} />
                  Lesson
                  {cards.length > 0 && <span>{cards.length}</span>}
                </button>
                <button
                  className={libraryTab === "markers" ? "active" : ""}
                  onClick={() => setLibraryTab("markers")}
                >
                  <ScanLine size={16} />
                  Markers
                </button>
              </div>
              {libraryTab === "lesson" ? (
                <LessonToolsPanel
                  cards={cards}
                  selectedId={selectedId}
                  onAdd={addCard}
                  onSelect={(id) => {
                    selectCard(id);
                    setLibraryOpen(false);
                    if (window.matchMedia?.("(max-width: 1100px)").matches)
                      setInspectorOpen(true);
                  }}
                  onSignIn={() => setDialog("signin")}
                />
              ) : libraryTab === "objects" ? (
                <>
                  <label className="search-field">
                    <Search size={16} />
                    <input
                      aria-label="Search objects"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Find a little inspiration…"
                    />
                    {search && (
                      <button
                        aria-label="Clear object search"
                        onClick={() => setSearch("")}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </label>
                  <div className="category-tabs" aria-label="Object categories">
                    {[
                      ...new Set(["All", ...ASSETS.map((a) => a.category)]),
                    ].map((c) => (
                      <button
                        key={c}
                        className={category === c ? "active" : ""}
                        onClick={() => setCategory(c)}
                      >
                        {c === "All" ? <Grid2X2 size={12} /> : null}
                        {c}
                      </button>
                    ))}
                  </div>
                  {catalogue.warnings.length > 0 && (
                    <p className="catalogue-notice" role="status">
                      Some library items are unavailable. Refresh the page or
                      ask your library provider for help.
                    </p>
                  )}
                  <div className="library-scroll">
                    <div className="library-section-label">
                      <span>
                        {category === "All"
                          ? "BIG IDEAS START SMALL"
                          : `${category.toUpperCase()} DISCOVERIES`}
                      </span>
                      <span>
                        {assets.length}{" "}
                        {assets.length === 1 ? "object" : "objects"}
                      </span>
                    </div>
                    {assets.length ? (
                      <div className="asset-grid">
                        {assets.map((a) => (
                          <button
                            className="asset-card"
                            key={a.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("wonderlab/asset", a.id);
                              e.dataTransfer.effectAllowed = "copy";
                            }}
                            onClick={() => addObject(a.id)}
                            aria-label={`Add ${a.name} to your scene`}
                            title={`Add ${a.name} to your scene`}
                          >
                            <span
                              className="asset-art"
                              style={{ background: a.bg }}
                            >
                              <AssetImage
                                assetId={a.id}
                                alt=""
                                draggable={false}
                              />
                              {a.kind === "glb" && (
                                <span className="asset-filetype">GLB</span>
                              )}
                              <span className="asset-add">
                                <Plus size={14} />
                              </span>
                            </span>
                            <span className="asset-card-copy">
                              <strong>{a.name}</strong>
                              <span>{a.category}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <EmptyState icon={Search} title="A little hard to find">
                        Try “Earth”, “tree” or a different category.
                      </EmptyState>
                    )}
                    <div className="library-bottom-note">
                      <Sparkles size={15} />
                      <span>
                        Click to add. Drag to place.
                        <br />A whole world is in your hands.
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="library-scroll marker-library">
                  <p className="panel-description">
                    A little picture that brings your creation to life. Choose
                    one, then print it.
                  </p>
                  <button
                    className="button primary full marker-maker-button"
                    onClick={() => navigate("marker-maker")}
                  >
                    <ImagePlus size={15} />
                    Create your own marker
                  </button>
                  {(() => {
                    const current = getMarker(project.markerId);
                    const mine = [
                      ...(current.custom &&
                      !myMarkers.some((m) => m.id === current.id)
                        ? [current.definition]
                        : []),
                      ...myMarkers,
                    ];
                    return mine.length ? (
                      <div className="my-markers" aria-label="My markers">
                        <span className="field-label">MY MARKERS</span>
                        {mine.map((m) => (
                          <div
                            className={`marker-card custom ${m.id === project.markerId ? "active" : ""}`}
                            key={m.id}
                          >
                            <button
                              className="marker-card-main"
                              aria-label={`Use ${m.name} marker`}
                              onClick={() => {
                                registerCustomMarker(m);
                                commit({ markerId: m.id, marker: m });
                                notify(
                                  `${m.name} selected. Print a new sheet when you share.`,
                                );
                              }}
                            >
                              <img
                                src={m.image}
                                alt={`${m.name} tracking image`}
                              />
                              <span className="marker-card-info">
                                <strong>{m.name}</strong>
                                <small>
                                  {m.id === project.markerId
                                    ? "Used in this project"
                                    : "Made by you"}
                                </small>
                              </span>
                              <span className="marker-selected">
                                {m.id === project.markerId ? (
                                  <Check size={14} />
                                ) : (
                                  <Plus size={14} />
                                )}
                              </span>
                            </button>
                            {myMarkers.some((x) => x.id === m.id) ? (
                              <IconButton
                                label={`Remove ${m.name} from my markers`}
                                className="marker-remove"
                                onClick={() => {
                                  setMyMarkers((list) =>
                                    list.filter((x) => x.id !== m.id),
                                  );
                                  notify(
                                    "Removed from your list. Projects and printed sheets that use it keep working.",
                                  );
                                }}
                              >
                                <X size={13} />
                              </IconButton>
                            ) : null}
                          </div>
                        ))}
                        <span className="field-label">BUILT-IN MARKERS</span>
                      </div>
                    ) : null;
                  })()}
                  {MARKERS.map((m) => (
                    <button
                      className={`marker-card ${m.id === project.markerId ? "active" : ""}`}
                      key={m.id}
                      onClick={() => {
                        commit({ markerId: m.id, marker: undefined });
                        notify(
                          `${m.name} selected. Print a new sheet when you share.`,
                        );
                      }}
                    >
                      <img
                        src={m.image}
                        alt={`${m.name} tracking image`}
                        loading="lazy"
                      />
                      <span className="marker-card-info">
                        <strong>{m.name}</strong>
                        <small>{m.subtitle}</small>
                      </span>
                      <span className="marker-selected">
                        {m.id === project.markerId ? (
                          <Check size={14} />
                        ) : (
                          <Plus size={14} />
                        )}
                      </span>
                    </button>
                  ))}
                  <div className="marker-ready">
                    <ShieldCheck size={16} />
                    <span>
                      Real tracking targets.
                      <br />
                      Compiled and ready to explore.
                    </span>
                  </div>
                  <button
                    className="button secondary full"
                    onClick={() => openShare(true)}
                  >
                    <Printer size={15} />
                    Get printable sheet
                  </button>
                </div>
              )}
              <button
                className="inspiration-card"
                onClick={() => navigate("templates")}
              >
                <span className="inspiration-icon">
                  <Lightbulb size={21} />
                </span>
                <span>
                  <strong>A spark to get you started</strong>
                  <small>Explore ready-to-remix worlds</small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            </aside>
            <main className="workspace">
              <div className="workspace-top">
                <div>
                  <span className="workspace-dot" />
                  3D workspace
                  <span className="beta-badge">PLAY. MAKE. WONDER.</span>
                </div>
                <div className="workspace-view-actions">
                  <button
                    className="mobile-panel-button"
                    onClick={() => {
                      setLibraryOpen(!libraryOpen);
                      setInspectorOpen(false);
                    }}
                  >
                    <Box size={15} />
                    Objects
                  </button>
                  <IconButton
                    label={grid ? "Hide ground grid" : "Show ground grid"}
                    className={grid ? "active" : ""}
                    onClick={() => setGrid(!grid)}
                  >
                    <Grid2X2 size={16} />
                  </IconButton>
                  <IconButton
                    label={
                      markerVisible ? "Hide marker guide" : "Show marker guide"
                    }
                    className={markerVisible ? "active" : ""}
                    onClick={() => setMarkerVisible(!markerVisible)}
                  >
                    <ScanLine size={17} />
                  </IconButton>
                  <IconButton
                    label="Reset camera view"
                    onClick={() => canvas.current?.reset()}
                  >
                    <Maximize size={16} />
                  </IconButton>
                  <button
                    className="mobile-panel-button props-panel-button"
                    onClick={() => {
                      setInspectorOpen(!inspectorOpen);
                      setLibraryOpen(false);
                    }}
                  >
                    <SlidersHorizontal size={15} />
                    Edit
                  </button>
                </div>
              </div>
              <div className="canvas-area">
                <StudioCanvas
                  ref={canvas}
                  project={project}
                  selectedId={selectedId}
                  onSelect={selectObject}
                  onTransform={(id, patch) => {
                    const safe = validateProject({
                      ...project,
                      objects: project.objects.map((o) =>
                        o.id === id ? { ...o, ...patch } : o,
                      ),
                    });
                    commit({ objects: safe.objects });
                  }}
                  onDropAsset={addObject}
                  tool={tool}
                  grid={grid}
                  markerVisible={markerVisible}
                  playing={playing}
                  showActions={playing}
                  onSoundError={() =>
                    notify("This sound could not play. Check the file.")
                  }
                  cards={cards}
                  cardMode="edit"
                  onSelectCard={selectCard}
                  onMoveCard={(id, position) => updateCard(id, { position })}
                  pickMode={pickCardId}
                  onPickPoint={pickPoint}
                />
                {pickCardId && (
                  <div className="pick-banner" role="status">
                    <span>
                      Click the part of the model this box should point to.
                    </span>
                    <button onClick={() => setPickCardId(null)}>Cancel</button>
                  </div>
                )}
                <div className="canvas-greeting">
                  <span className="eyebrow">
                    DREAM IT. BUILD IT. BRING IT TO LIFE.
                  </span>
                  <h2>
                    A universe of your own<span>✦</span>
                  </h2>
                  <p>
                    {project.objects.length
                      ? "Big ideas look good in every dimension."
                      : "Pick an object from your toolbox. Your world starts with one idea."}
                  </p>
                </div>
                <button
                  className="canvas-help"
                  onClick={() => setDialog("help")}
                >
                  <CircleHelp size={14} />
                  New here? Find your first spark
                  <ArrowUpRight size={13} />
                </button>
                <div className="marker-widget">
                  <button
                    className="marker-widget-thumb"
                    aria-label="Choose tracking marker"
                    onClick={() => {
                      setLibraryTab("markers");
                      setLibraryOpen(true);
                    }}
                  >
                    <img
                      src={getMarker(project.markerId).image}
                      alt="Selected tracking marker"
                    />
                    <ScanLine size={13} />
                  </button>
                  <div>
                    <span>YOUR AR MARKER</span>
                    <strong>{getMarker(project.markerId).name}</strong>
                    <button onClick={() => openShare(true)}>
                      <Printer size={11} />
                      Ready to print
                      <ChevronRight size={11} />
                    </button>
                  </div>
                </div>
                <span className="canvas-object-count">
                  <Box size={12} />
                  {project.objects.length} little{" "}
                  {project.objects.length === 1 ? "idea" : "ideas"}
                </span>
              </div>
              <div className="canvas-bottom">
                <div className="canvas-tip">
                  <MousePointer2 size={14} />
                  <span>
                    Drag to orbit <i>·</i> Scroll to zoom
                  </span>
                </div>
                <div className="canvas-tools" aria-label="Scene editing tools">
                  {[
                    { id: "select", icon: MousePointer2, label: "Select" },
                    { id: "translate", icon: Move3D, label: "Move" },
                    { id: "rotate", icon: RotateCw, label: "Rotate" },
                    { id: "scale", icon: Maximize, label: "Scale" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      className={tool === t.id ? "active" : ""}
                      onClick={() => {
                        setTool(t.id);
                        setPlaying(false);
                      }}
                      title={t.label}
                      aria-label={`${t.label} tool`}
                    >
                      <t.icon size={17} />
                      <span>{t.label}</span>
                    </button>
                  ))}
                  <span />
                  <button
                    className={playing ? "active playing" : ""}
                    onClick={() => {
                      setPlaying(!playing);
                      setTool("select");
                    }}
                    aria-label={
                      playing ? "Stop scene animation" : "Play scene animation"
                    }
                    title={playing ? "Stop animations" : "Play animations"}
                  >
                    {playing ? (
                      <span className="stop-icon" />
                    ) : (
                      <Play size={16} />
                    )}
                  </button>
                </div>
                <div className="zoom-tools">
                  <IconButton
                    label="Zoom out"
                    onClick={() => canvas.current?.zoom(1.15)}
                  >
                    <Minus size={15} />
                  </IconButton>
                  <button
                    title="Reset zoom"
                    onClick={() => canvas.current?.reset()}
                  >
                    Fit
                  </button>
                  <IconButton
                    label="Zoom in"
                    onClick={() => canvas.current?.zoom(0.87)}
                  >
                    <Plus size={15} />
                  </IconButton>
                </div>
              </div>
            </main>
            <aside className="inspector-panel">
              <div className="inspector-heading">
                <h2>
                  Make it yours<span>✧</span>
                </h2>
                <IconButton
                  className="drawer-close"
                  label="Close object properties"
                  onClick={() => setInspectorOpen(false)}
                >
                  <X size={18} />
                </IconButton>
              </div>
              <div className="inspector-tabs">
                <button
                  className={inspectorTab === "object" ? "active" : ""}
                  onClick={() => setInspectorTab("object")}
                >
                  <SlidersHorizontal size={14} />
                  {selectedCard ? "Lesson box" : "Object"}
                </button>
                <button
                  className={inspectorTab === "scene" ? "active" : ""}
                  onClick={() => setInspectorTab("scene")}
                >
                  <Layers size={14} />
                  Scene<span>{project.objects.length + cards.length}</span>
                </button>
              </div>
              <div className="inspector-scroll">
                {inspectorTab === "object" ? (
                  selectedCard ? (
                    <CardProperties
                      key={selectedCard.id}
                      card={selectedCard}
                      objects={project.objects}
                      update={(patch) => updateCard(selectedCard.id, patch)}
                      onDelete={() => deleteObject(selectedCard.id)}
                      onDuplicate={duplicateCard}
                      picking={pickCardId === selectedCard.id}
                      onPick={() => {
                        const next =
                          pickCardId === selectedCard.id
                            ? null
                            : selectedCard.id;
                        setPickCardId(next);
                        if (next) setInspectorOpen(false);
                      }}
                      onSignIn={() => setDialog("signin")}
                      notify={notify}
                    />
                  ) : selected ? (
                    <ObjectProperties
                      object={selected}
                      update={(patch) => updateObject(selected.id, patch)}
                      onDelete={() => deleteObject()}
                      onDuplicate={duplicateObject}
                      onTestAction={(action) => {
                        const result = canvas.current?.playAction(
                          selected.id,
                          action,
                        );
                        if (result === "loop")
                          notify("Playing on repeat. Tap ▶ again to stop.");
                      }}
                      onSignIn={() => setDialog("signin")}
                      notify={notify}
                    />
                  ) : (
                    <div className="no-selection">
                      <span className="no-selection-art">
                        <MousePointer2 size={31} />
                        <Sparkles size={17} />
                      </span>
                      <h3>Every little detail is yours.</h3>
                      <p>
                        Choose an object in your scene to move it, colour it, or
                        give it a little life.
                      </p>
                      <button
                        className="button secondary full"
                        onClick={() => setInspectorTab("scene")}
                      >
                        <Layers size={15} />
                        See scene objects
                      </button>
                    </div>
                  )
                ) : (
                  <SceneObjects
                    project={project}
                    selectedId={selectedId}
                    onSelectCard={selectCard}
                    updateCard={updateCard}
                    onSelect={selectObject}
                    updateObject={updateObject}
                    onDelete={deleteObject}
                  />
                )}
              </div>
              <div className="inspector-footer">
                <span className="tip-icon">
                  <Sparkles size={18} />
                </span>
                <div>
                  <strong>A little tip</strong>
                  <p>
                    {selectedCard
                      ? "Use Point to a model part, then drag the box to a clear space."
                      : selected?.assetId === "earth"
                        ? "Try a slow spin. Even little worlds love to turn."
                        : "Give an object a float or a spin, then press Play to see it move."}
                  </p>
                </div>
              </div>
            </aside>
          </div>
          <footer className="status-bar">
            <span className={saveState === "error" ? "status-error" : ""}>
              <span className="status-dot" />
              {saveState === "error"
                ? "Storage unavailable — export a backup"
                : "Your ideas, safe on this device"}
            </span>
            <span>
              <ShieldCheck size={12} />
              {teacher
                ? `Teacher: ${teacher.user.email}`
                : cloudEnabled()
                  ? "Sign in only for media uploads"
                  : "No login. Just imagination."}
              <i>·</i>
              <span>Demo workspace</span>
            </span>
            <button onClick={() => setDialog("help")}>
              A little help?
              <ArrowUpRight size={11} />
            </button>
          </footer>
        </>
      ) : page === "mini" ? (
        <MiniProjects
          minis={minis}
          selectedId={selectedMiniId}
          onSelect={setSelectedMiniId}
          onCreate={createMini}
          onUpdate={updateMini}
          onAdd={(id) => addMiniEntries(id)}
          onAddMarkers={(id, files) => addMiniEntries(id, files)}
          onUpdateEntry={updateMiniEntry}
          onEditEntry={editMiniEntry}
          onRemoveEntry={removeMiniEntry}
          onDelete={removeMini}
          projects={projects}
          saveBeforePreview={saveBeforePreview}
          saveState={miniSaveState}
        />
      ) : page === "marker-maker" ? (
        <MarkerMaker
          session={teacher}
          notify={notify}
          onSignIn={() => setDialog("signin")}
          onBack={() => navigate("studio")}
          onSaved={(definition) => {
            const marker = registerCustomMarker(definition);
            if (!marker) return;
            setMyMarkers((list) =>
              [
                marker.definition,
                ...list.filter((m) => m.id !== marker.id),
              ].slice(0, 40),
            );
            if (project)
              commit({ markerId: marker.id, marker: marker.definition });
            setLibraryTab("markers");
            setPage("studio");
            notify(
              `${marker.name} is ready and used in this project. Print a new sheet to try it.`,
            );
          }}
        />
      ) : page === "templates" ? (
        <TemplatesPage
          onCreate={createProject}
          onBack={() => navigate("studio")}
        />
      ) : (
        <ProjectsPage
          projects={projects.filter(
            (p) =>
              !minis.some((mini) =>
                mini.entries.some((entry) => entry.sceneId === p.id),
              ),
          )}
          onOpen={(p) => openProject(p)}
          onNew={() => navigate("templates")}
          onDuplicate={duplicateProject}
          onExport={downloadProject}
          onDelete={setDeleteTarget}
          onImport={() => importRef.current?.click()}
        />
      )}
      <input
        ref={importRef}
        className="visually-hidden"
        type="file"
        accept=".json,application/json"
        onChange={importProject}
        aria-label="Import Wonderlab project JSON"
      />
      {toast && (
        <div
          className={`toast ${toast.type === "error" ? "toast-error" : ""}`}
          role="status"
          key={toast.id}
        >
          <span>
            {toast.type === "error" ? (
              <CircleHelp size={18} />
            ) : (
              <Check size={18} />
            )}
          </span>
          <p>{toast.message}</p>
          <IconButton
            label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={14} />
          </IconButton>
        </div>
      )}
      {(dialog === "share" || dialog === "print") && shareProject && (
        <ShareModal
          project={shareProject}
          screenshot={shareImage}
          onClose={() => setDialog(null)}
          notify={notify}
          printFirst={dialog === "print"}
          onUseInMini={makeMiniFromCurrentScene}
        />
      )}
      {dialog === "signin" && (
        <TeacherSignIn onClose={() => setDialog(null)} notify={notify} />
      )}
      {dialog === "preview" && (
        <Modal
          label="Interactive 3D preview"
          className="preview-modal"
          onClose={() => setDialog(null)}
        >
          <div className="preview-heading">
            <span className="eyebrow">
              <Play size={13} />A LITTLE PREVIEW
            </span>
            <h2>{project.title}</h2>
            <p>Drag to look around. Your animations are playing.</p>
          </div>
          <div className="preview-canvas">
            <StudioCanvas
              project={project}
              viewOnly
              playing
              showActions
              grid={false}
              cards={cards}
              onOpenCard={setPreviewCard}
            />
            {previewCard && (
              <LessonCardSheet
                card={previewCard}
                onClose={() => setPreviewCard(null)}
              />
            )}
          </div>
          <div className="preview-modal-footer">
            <span>
              <Sparkles size={15} />
              Looks even better in the real world.
            </span>
            <button className="button primary" onClick={() => openShare()}>
              <Share2 size={16} />
              Bring it to life
              <ArrowUpRight size={15} />
            </button>
          </div>
        </Modal>
      )}
      {dialog === "help" && (
        <HelpModal
          onClose={() => setDialog(null)}
          onStart={() => {
            setDialog(null);
            setLibraryTab("objects");
            setLibraryOpen(true);
          }}
        />
      )}
      {dialog === "about" && (
        <Modal
          className="about-modal"
          label="About this demo workspace"
          onClose={() => setDialog(null)}
        >
          <span className="about-icon">
            <Smile size={35} />
          </span>
          <span className="eyebrow">WELCOME, LITTLE BIG THINKER</span>
          <h2>A space for your next big idea.</h2>
          <p>
            Wonderlab is a working marker-based WebAR prototype. There’s no
            account to make. Just pick, place, print and explore.
          </p>
          <div className="about-facts">
            <div>
              <CloudOff size={20} />
              <span>
                <strong>Saved on this device</strong>
                <small>
                  Projects live in browser storage, not a cloud account. Export
                  JSON for a backup.
                </small>
              </span>
            </div>
            <div>
              <Share2 size={20} />
              <span>
                <strong>Share a snapshot</strong>
                <small>
                  Your link includes the scene data. Anyone with the link can
                  view it. Edited scenes need a new link.
                </small>
              </span>
            </div>
            <div>
              <ShieldCheck size={20} />
              <span>
                <strong>Camera stays private</strong>
                <small>
                  Image tracking runs on your phone. No camera feed is uploaded.
                </small>
              </span>
            </div>
          </div>
          <p className="small-note">
            Included: 12 built-in models and {catalogue.count} additional
            library {catalogue.count === 1 ? "model" : "models"}, with two
            illustrated tracking markers. Choose from the provided library,
            build a lesson, then publish a snapshot and print its marker.
          </p>
          {project && (
            <button
              className="button primary full"
              onClick={() => {
                downloadProject(project);
                notify("Project exported. Keep this file as a backup.");
              }}
            >
              <Download size={16} />
              Back up current project
            </button>
          )}
        </Modal>
      )}
      {deleteTarget && (
        <Modal
          className="confirm-modal"
          label="Delete project"
          onClose={() => setDeleteTarget(null)}
        >
          <span className="delete-illustration">
            <Trash2 size={27} />
          </span>
          <h2>Let this little world go?</h2>
          <p>
            “{deleteTarget.title}” will be deleted from this device. Export a
            backup first if you want to keep it.
          </p>
          <div className="confirm-actions">
            <button
              className="button secondary"
              onClick={() => setDeleteTarget(null)}
            >
              Keep it
            </button>
            <button className="button danger" onClick={removeProject}>
              <Trash2 size={15} />
              Delete project
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function ObjectProperties({
  object,
  update,
  onDelete,
  onDuplicate,
  onTestAction,
  onSignIn,
  notify,
}) {
  const a = getAsset(object.assetId, object.model);
  function vector(field, i, value) {
    if (value === "") return;
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    const v = [...object[field]];
    const limit = field === "rotation" ? 360 : 4;
    v[i] = Math.max(
      i === 1 && field === "position" ? 0 : -limit,
      Math.min(limit, num),
    );
    update({ [field]: v });
  }
  return (
    <>
      <div className="selected-object-card">
        <span className="selected-object-art" style={{ background: a.bg }}>
          <AssetImage assetId={a.id} model={object.model} alt="" />
        </span>
        <div>
          <span>{a.category.toUpperCase()} OBJECT</span>
          <input
            aria-label="Object name"
            value={object.name}
            onChange={(e) => update({ name: e.target.value.slice(0, 35) })}
          />
          <small>Let’s make it a little more you.</small>
        </div>
      </div>
      <div className="object-action-row">
        <button onClick={onDuplicate}>
          <Copy size={13} />
          Duplicate
        </button>
        <span />
        <button onClick={onDelete}>
          <Trash2 size={13} />
          Remove
        </button>
      </div>
      <section className="property-section">
        <div className="property-section-heading">
          <h3>
            <Move3D size={14} />
            Transform
          </h3>
          <button
            onClick={() =>
              update({ position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 })
            }
            title="Reset object transform"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>
        <label className="field-label">POSITION</label>
        <div className="vector-fields">
          {["X", "Y", "Z"].map((axis, i) => (
            <label key={axis}>
              <span className={`axis-${axis.toLowerCase()}`}>{axis}</span>
              <input
                aria-label={`Position ${axis}`}
                type="number"
                step="0.1"
                min={i === 1 ? 0 : -4}
                max="4"
                value={object.position[i]}
                onChange={(e) => vector("position", i, e.target.value)}
              />
            </label>
          ))}
        </div>
        <label className="field-label">ROTATION</label>
        <div className="vector-fields">
          {["X", "Y", "Z"].map((axis, i) => (
            <label key={axis}>
              <span className={`axis-${axis.toLowerCase()}`}>{axis}</span>
              <input
                aria-label={`Rotation ${axis}`}
                type="number"
                step="5"
                min="-360"
                max="360"
                value={object.rotation[i]}
                onChange={(e) => vector("rotation", i, e.target.value)}
              />
              <small>°</small>
            </label>
          ))}
        </div>
        <div className="scale-label">
          <label className="field-label" htmlFor="object-scale">
            SIZE
          </label>
          <span>{Math.round(object.scale * 100)}%</span>
        </div>
        <div className="scale-slider">
          <Box size={13} />
          <input
            id="object-scale"
            aria-label="Object size"
            type="range"
            min="0.15"
            max="2.5"
            step="0.05"
            value={object.scale}
            onChange={(e) => update({ scale: Number(e.target.value) })}
          />
          <Box size={18} />
        </div>
      </section>
      <section className="property-section color-section">
        <div className="property-section-heading">
          <h3>
            <Palette size={14} />A splash of colour
          </h3>
          <button onClick={() => update({ color: undefined })}>Original</button>
        </div>
        <div className="color-swatches">
          {["#a397dc", "#92c7ae", "#edaa8f", "#edcc7d", "#9dbbdc"].map((c) => (
            <button
              key={c}
              style={{ background: c }}
              className={object.color === c ? "active" : ""}
              aria-label={`Set object colour ${c}`}
              onClick={() => update({ color: c })}
            >
              {object.color === c && <Check size={14} />}
            </button>
          ))}
          <label className="custom-color" title="Choose a custom colour">
            <Plus size={15} />
            <input
              type="color"
              aria-label="Custom object colour"
              value={object.color || a.color}
              onChange={(e) => update({ color: e.target.value })}
            />
          </label>
        </div>
      </section>
      <section className="property-section animation-section">
        <div className="property-section-heading">
          <h3>
            <Sparkles size={14} />A little life
          </h3>
          <span className="tiny-pill">ANIMATE</span>
        </div>
        <div className="animation-options">
          {[
            { id: "none", icon: Box, label: "Still" },
            { id: "float", icon: ArrowUpRight, label: "Float" },
            { id: "spin", icon: RotateCw, label: "Spin" },
          ].map((x) => (
            <button
              key={x.id}
              className={object.animation === x.id ? "active" : ""}
              onClick={() => update({ animation: x.id })}
            >
              <x.icon size={17} />
              <span>{x.label}</span>
            </button>
          ))}
        </div>
        <p className="animation-hint">
          <Play size={10} />
          Hit play below your canvas to see the magic.
        </p>
      </section>
      <ActionEditor
        object={object}
        update={update}
        onTest={onTestAction}
        onSignIn={onSignIn}
        notify={notify}
      />
    </>
  );
}
function SceneObjects({
  project,
  selectedId,
  onSelect,
  onSelectCard,
  updateCard,
  updateObject,
  onDelete,
}) {
  const cards = project.cards || [];
  return (
    <div className="scene-object-panel">
      <div className="scene-list-heading">
        <span>YOUR LITTLE WORLD</span>
        <strong>
          {project.objects.length}/{MAX_OBJECTS}
        </strong>
      </div>
      {project.objects.length ? (
        project.objects.map((o) => (
          <div
            className={`scene-object ${o.id === selectedId ? "active" : ""} ${o.visible === false ? "object-hidden" : ""}`}
            key={o.id}
          >
            <button
              className="scene-object-select"
              onClick={() => onSelect(o.id)}
            >
              <AssetImage
                assetId={o.assetId}
                model={o.model}
                alt=""
                style={{ background: getAsset(o.assetId, o.model).bg }}
              />
              <span>
                <strong>{o.name}</strong>
                <small>
                  {getAsset(o.assetId, o.model).category}
                  {o.animation !== "none" ? ` · ${o.animation}` : ""}
                  {o.actions?.length
                    ? ` · ${o.actions.length} play button${o.actions.length === 1 ? "" : "s"}`
                    : ""}
                </small>
              </span>
            </button>
            <IconButton
              label={`${o.visible === false ? "Show" : "Hide"} ${o.name}`}
              onClick={() =>
                updateObject(o.id, { visible: o.visible === false })
              }
            >
              {o.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
            </IconButton>
            <IconButton
              label={`Remove ${o.name}`}
              onClick={() => onDelete(o.id)}
            >
              <Trash2 size={13} />
            </IconButton>
          </div>
        ))
      ) : (
        <EmptyState icon={Box} title="A world waiting to happen">
          Add your first object from the toolbox.
        </EmptyState>
      )}
      {cards.length > 0 && (
        <>
          <div className="scene-list-heading lesson-list-heading">
            <span>LESSON BOXES</span>
            <strong>
              {cards.length}/{MAX_CARDS}
            </strong>
          </div>
          {cards.map((c) => {
            const Icon = CARD_ICONS[c.type];
            return (
              <div
                className={`scene-object ${c.id === selectedId ? "active" : ""} ${c.visible ? "" : "object-hidden"}`}
                key={c.id}
              >
                <button
                  className="scene-object-select"
                  onClick={() => onSelectCard(c.id)}
                >
                  <span
                    className="scene-card-icon"
                    style={{ "--card-color": c.color }}
                  >
                    <Icon size={15} />
                  </span>
                  <span>
                    <strong>{c.title || "Untitled box"}</strong>
                    <small>{CARD_TYPE_NAMES[c.type]}</small>
                  </span>
                </button>
                <IconButton
                  label={`${c.visible ? "Hide" : "Show"} ${c.title || "box"}`}
                  onClick={() => updateCard(c.id, { visible: !c.visible })}
                >
                  {c.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </IconButton>
                <IconButton
                  label={`Remove ${c.title || "box"}`}
                  onClick={() => onDelete(c.id)}
                >
                  <Trash2 size={13} />
                </IconButton>
              </div>
            );
          })}
        </>
      )}
      <div className="scene-marker-note">
        <img
          src={getMarker(project.markerId).image}
          alt="Scene tracking marker"
        />
        <span>
          <small>ANCHORED TO</small>
          <strong>{getMarker(project.markerId).name}</strong>
        </span>
        <ScanLine size={17} />
      </div>
      <p className="small-note">
        Hidden objects won’t appear in your AR viewer. Keep scenes simple for
        the smoothest mobile experience.
      </p>
    </div>
  );
}
function ProjectArt({ objects, color = "#ede8fa" }) {
  return (
    <div className="project-card-art" style={{ background: color }}>
      <span className="art-orbit orbit-one" />
      <span className="art-orbit orbit-two" />
      <span className="art-spark">✦</span>
      {objects.length ? (
        objects
          .slice(0, 3)
          .map((o, i) => (
            <AssetImage
              className={`art-object art-object-${i}`}
              key={i}
              assetId={o.assetId}
              model={o.model}
              alt=""
            />
          ))
      ) : (
        <span className="blank-project-art">
          <Plus size={34} />
        </span>
      )}
    </div>
  );
}
function ProjectsPage({
  projects,
  onOpen,
  onNew,
  onDuplicate,
  onExport,
  onDelete,
  onImport,
}) {
  const [search, setSearch] = useState(""),
    [menuId, setMenuId] = useState(null);
  const filtered = projects
    .filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return (
    <main className="collection-page" onClick={() => menuId && setMenuId(null)}>
      <div className="collection-heading">
        <div>
          <span className="eyebrow">
            <FolderOpen size={14} />
            YOUR LITTLE WORLDS
          </span>
          <h1>
            Big ideas live here<span>✦</span>
          </h1>
          <p>
            Pick up where your imagination left off. Or start somewhere new.
          </p>
        </div>
        <button className="button primary" onClick={onNew}>
          <Plus size={17} />
          New creation
        </button>
      </div>
      <div className="collection-controls">
        <div>
          <h2>
            My projects <span>{projects.length}</span>
          </h2>
          <span className="local-storage-note">
            <CloudOff size={13} />
            Saved on this device
          </span>
        </div>
        <div>
          <label className="search-field">
            <Search size={15} />
            <input
              aria-label="Search projects"
              placeholder="Find a creation…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button className="button secondary" onClick={onImport}>
            <Upload size={15} />
            Import project
          </button>
        </div>
      </div>
      <div className="project-grid">
        <button className="new-project-card" onClick={onNew}>
          <span>
            <Plus size={28} />
          </span>
          <h3>What’s your next big idea?</h3>
          <p>A fresh canvas is calling.</p>
          <strong>
            Create something wonderful
            <ArrowRight size={15} />
          </strong>
        </button>
        {filtered.map((p, i) => (
          <article className="project-card" key={p.id}>
            <button
              className="project-art-button"
              aria-label={`Open ${p.title}`}
              onClick={() => onOpen(p)}
            >
              <ProjectArt
                objects={p.objects}
                color={["#eee8fa", "#e7f1e8", "#f5eddc"][i % 3]}
              />
              <span className="project-ar-badge">
                <ScanLine size={12} />
                3D + AR
              </span>
            </button>
            <div className="project-card-info">
              <button onClick={() => onOpen(p)}>
                <h3>{p.title}</h3>
              </button>
              <p>
                {p.objects.length} objects<span>·</span>
                {getMarker(p.markerId).name}
              </p>
              <div className="project-card-footer">
                <span>
                  Edited{" "}
                  {new Date(p.updatedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <div className="project-menu-wrap">
                  <IconButton
                    label={`Project options for ${p.title}`}
                    aria-expanded={menuId === p.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuId(menuId === p.id ? null : p.id);
                    }}
                  >
                    <Ellipsis size={20} />
                  </IconButton>
                  {menuId === p.id && (
                    <div
                      className="project-dropdown"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          onDuplicate(p);
                          setMenuId(null);
                        }}
                      >
                        <Copy size={14} />
                        Duplicate
                      </button>
                      <button
                        onClick={() => {
                          onExport(p);
                          setMenuId(null);
                        }}
                      >
                        <FileJson size={14} />
                        Export project
                      </button>
                      <button
                        className="danger-text"
                        onClick={() => {
                          onDelete(p);
                          setMenuId(null);
                        }}
                      >
                        <Trash2 size={14} />
                        Delete project
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && search && (
        <EmptyState icon={Search} title="That world is hiding">
          Try another project name.
        </EmptyState>
      )}
      <div className="collection-bottom-note">
        <ShieldCheck size={18} />
        <p>
          Your projects are stored in this browser.{" "}
          <strong>Export your favourites as JSON</strong> to keep a backup or
          move them to another device.
        </p>
      </div>
    </main>
  );
}
function TemplatesPage({ onCreate, onBack }) {
  return (
    <main className="collection-page templates-page">
      <div className="templates-hero">
        <div>
          <span className="eyebrow">
            <Sparkles size={15} />A LITTLE SPARK GOES A LONG WAY
          </span>
          <h1>
            Start with a spark.
            <br />
            Make it your own<span>✦</span>
          </h1>
          <p>
            Not sure where to begin? Borrow a little inspiration.
            <br />
            Every world is ready for your own wonderful twist.
          </p>
          <span className="hero-tag">
            <Check size={13} />
            No coding. No limits on imagination.
          </span>
        </div>
        <div className="templates-hero-art">
          <span className="hero-circle" />
          <AssetImage assetId="rocket" alt="A playful 3D rocket" />
          <span className="hero-star hero-star-1">✦</span>
          <span className="hero-star hero-star-2">✧</span>
          <span className="hero-orbit" />
        </div>
      </div>
      <div className="templates-section-heading">
        <h2>Little worlds. Big possibilities.</h2>
        <span>4 starting points · All yours to remix</span>
      </div>
      <div className="template-grid">
        {TEMPLATES.map((t, i) => (
          <article className="template-card" key={t.id}>
            <button
              className="template-image-button"
              onClick={() => onCreate(t.id)}
              aria-label={`Use ${t.name} template`}
            >
              <ProjectArt
                objects={
                  t.id === "blank"
                    ? []
                    : [
                        { assetId: t.asset },
                        {
                          assetId:
                            t.id === "space"
                              ? "earth"
                              : t.id === "forest"
                                ? "mushroom"
                                : "atom",
                        },
                        {
                          assetId:
                            t.id === "space"
                              ? "rocket"
                              : t.id === "forest"
                                ? "flower"
                                : "rocket",
                        },
                      ]
                }
                color={t.color}
              />
              <span className="template-use-overlay">
                Make it mine
                <ArrowUpRight size={18} />
              </span>
            </button>
            <div className="template-copy">
              <span className="eyebrow">{t.category.toUpperCase()}</span>
              <h3>{t.id === "blank" ? "Your next big idea" : t.name}</h3>
              <p>{t.description}</p>
              <button onClick={() => onCreate(t.id)}>
                {t.id === "blank" ? "Start from scratch" : "Make it mine"}
                <ArrowRight size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
      <button className="button text-button templates-back" onClick={onBack}>
        <ArrowLeft size={15} />
        Back to my canvas
      </button>
    </main>
  );
}
function HelpModal({ onClose, onStart }) {
  return (
    <Modal
      className="help-modal"
      onClose={onClose}
      label="How to create and view AR"
    >
      <span className="eyebrow">
        <Sparkles size={14} />A LITTLE GUIDE TO A LOT OF WONDER
      </span>
      <h2>
        Your imagination.
        <br />
        Now in the real world.
      </h2>
      <p className="help-intro">
        Four little steps. One pretty wonderful creation.
      </p>
      <div className="help-steps">
        {[
          {
            icon: Box,
            title: "Pick your little pieces",
            text: "Click an object in the toolbox or drag it onto your scene. Choose from space, nature and science.",
          },
          {
            icon: Move3D,
            title: "Make it a world of your own",
            text: "Select an object to move, rotate, resize or recolour it. Add a float or spin, then press Play.",
          },
          {
            icon: Printer,
            title: "Give your world a little paper",
            text: "Publish & share, then download your marker PDF. Print in colour at 100% and keep the image flat.",
          },
          {
            icon: ScanLine,
            title: "Watch a little wonder happen",
            text: "Scan the QR on your phone, start the AR camera and point at the whole illustrated tracking image.",
          },
        ].map((s, i) => (
          <div key={i}>
            <span className={`help-step-icon step-${i}`}>
              <s.icon size={22} />
              <small>{i + 1}</small>
            </span>
            <span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </span>
          </div>
        ))}
      </div>
      <div className="help-note">
        <ShieldCheck size={20} />
        <p>
          <strong>A safe little space to create.</strong>Your camera stays on
          your device. Projects save in this browser. Share links contain a
          scene snapshot; anyone with the link can open it. Use a current mobile
          browser over HTTPS for AR.
        </p>
      </div>
      <button className="button primary full" onClick={onStart}>
        Let’s make something wonderful
        <ArrowRight size={17} />
      </button>
    </Modal>
  );
}
