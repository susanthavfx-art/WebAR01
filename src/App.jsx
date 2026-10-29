import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Box,
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CloudOff,
  FileImage,
  FileScan,
  Grid2X2,
  Layers,
  LoaderCircle,
  Maximize,
  Minus,
  MousePointer2,
  Move3D,
  Orbit,
  Play,
  Plus,
  Printer,
  Redo2,
  RotateCcw,
  RotateCw,
  ScanLine,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import { currentPage } from "./lib/deployment";
import StudioCanvas from "./components/StudioCanvas";
import CollectionViewer from "./components/CollectionViewer";
import PublishModal from "./components/PublishModal";
import AssetImage from "./components/AssetImage";
import { ObjectProperties, SceneObjects } from "./components/SceneProperties";
import { CardProperties, LessonToolsPanel } from "./components/CardEditor";
import { LessonCardSheet } from "./components/LessonCards";
import { EmptyState, IconButton, Logo, Modal } from "./components/UI";
import {
  getAsset,
  MARKER_PLACEHOLDER,
  registerSharedModel,
  sceneObject,
} from "./lib/assets";
import { MAX_CARDS, newCard, validateCard } from "./lib/lesson-cards";
import { resolveResourceUrl, saveLocalFile } from "./lib/local-files";
import { clone, MAX_OBJECTS, newScene, validateScene } from "./lib/projects";
import {
  createWorkspacePublication,
  draftCollectionUrl,
  entryFileKey,
  entryStatus,
  filenameKey,
  filenameStem,
  loadWorkspaceState,
  MAX_FLASHCARDS,
  newEntry,
  newWorkspace,
  prepareWorkspaceTracker,
  saveWorkspaceState,
  sceneForEntry,
  workspaceProblems,
} from "./lib/workspace";

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

  if (currentPage() === "collection") {
    return <CollectionViewer key={location} />;
  }
  return <CreateStudio />;
}

function getActiveEntry(state) {
  return (
    state.workspace.entries.find(
      (item) => item.id === state.workspace.selectedEntryId,
    ) ||
    state.workspace.entries[0] ||
    null
  );
}

function getActiveScene(state) {
  const entry = getActiveEntry(state);
  return (entry && sceneForEntry(entry, state.scenes)) || state.scratch;
}

function CreateStudio() {
  const [state, setState] = useState(loadWorkspaceState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const activeEntry = getActiveEntry(state);
  const project = getActiveScene(state);

  const [libraryTab, setLibraryTab] = useState("objects");
  const [inspectorTab, setInspectorTab] = useState("object");
  const [selectedId, setSelectedId] = useState(
    () => getActiveScene(state).objects[0]?.id || null,
  );
  const [search, setSearch] = useState("");
  const [tool, setTool] = useState("select");
  const [grid, setGrid] = useState(true);
  const [markerVisible, setMarkerVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [saveState, setSaveState] = useState("saved");
  const [busyKind, setBusyKind] = useState("");
  const [previewBusy, setPreviewBusy] = useState("");
  const [dialog, setDialog] = useState(null);
  const [previewCard, setPreviewCard] = useState(null);
  const [pickCardId, setPickCardId] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const canvas = useRef(null);
  const toastTimer = useRef(null);
  const historyMap = useRef(new Map());

  const cards = project.cards || [];
  const selectedObject = project.objects.find((o) => o.id === selectedId);
  const selectedCard = cards.find((c) => c.id === selectedId);
  const activeStatus = activeEntry
    ? entryStatus(activeEntry, state.scenes)
    : null;
  const activeMarkerImage = activeEntry?.marker
    ? resolveResourceUrl(activeEntry.marker.ref)
    : "";

  const getHistory = (sceneId) => {
    if (!sceneId) return { past: [], future: [] };
    if (!historyMap.current.has(sceneId)) {
      historyMap.current.set(sceneId, { past: [], future: [] });
    }
    return historyMap.current.get(sceneId);
  };
  const currentHistory = getHistory(activeEntry?.sceneId);

  const notify = useCallback((message, type = "success") => {
    clearTimeout(toastTimer.current);
    setToast({ message, type, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 4600);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const replaceState = useCallback((next) => {
    stateRef.current = next;
    setSaveState("saving");
    setState(next);
  }, []);

  useEffect(() => {
    setSaveState("saving");
    const timer = setTimeout(() => {
      setSaveState(saveWorkspaceState(state) ? "saved" : "error");
    }, 260);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    const save = () => saveWorkspaceState(stateRef.current);
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, []);

  function activateEntry(entry, nextState = stateRef.current) {
    if (!entry) return;
    const updated = {
      ...nextState,
      workspace: {
        ...nextState.workspace,
        selectedEntryId: entry.id,
      },
    };
    replaceState(updated);
    setPickCardId(null);
    setPlaying(false);
    setTool("select");
    setInspectorTab("object");
    const scene = sceneForEntry(entry, updated.scenes);
    setSelectedId(scene?.objects[0]?.id || null);
  }

  function updateWorkspace(patch) {
    const current = stateRef.current;
    replaceState({
      ...current,
      workspace: {
        ...current.workspace,
        ...patch,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  function commitScene(patch, recordHistory = true) {
    const current = stateRef.current;
    const entry = getActiveEntry(current);
    if (!entry) return;
    const oldScene = sceneForEntry(entry, current.scenes);
    if (!oldScene) return;
    if (recordHistory) {
      const h = getHistory(entry.sceneId);
      h.past.push(clone(oldScene));
      if (h.past.length > 50) h.past.shift();
      h.future = [];
    }
    const nextScene = {
      ...oldScene,
      ...(typeof patch === "function" ? patch(clone(oldScene)) : patch),
      updatedAt: new Date().toISOString(),
    };
    replaceState({
      ...current,
      scenes: current.scenes.map((s) =>
        s.id === oldScene.id ? nextScene : s,
      ),
    });
  }

  function undo() {
    const current = stateRef.current;
    const entry = getActiveEntry(current);
    if (!entry) return;
    const h = getHistory(entry.sceneId);
    const prevScene = h.past.pop();
    if (!prevScene) return;
    const curScene = sceneForEntry(entry, current.scenes);
    if (curScene) h.future.push(clone(curScene));
    replaceState({
      ...current,
      scenes: current.scenes.map((s) =>
        s.id === prevScene.id ? prevScene : s,
      ),
    });
    if (
      ![...prevScene.objects, ...(prevScene.cards || [])].some(
        (item) => item.id === selectedId,
      )
    ) {
      setSelectedId(prevScene.objects[0]?.id || null);
    }
  }

  function redo() {
    const current = stateRef.current;
    const entry = getActiveEntry(current);
    if (!entry) return;
    const h = getHistory(entry.sceneId);
    const nextScene = h.future.pop();
    if (!nextScene) return;
    const curScene = sceneForEntry(entry, current.scenes);
    if (curScene) h.past.push(clone(curScene));
    replaceState({
      ...current,
      scenes: current.scenes.map((s) =>
        s.id === nextScene.id ? nextScene : s,
      ),
    });
  }

  function selectObject(id) {
    setSelectedId(id);
    setPickCardId(null);
    setInspectorTab("object");
  }

  function selectCard(id) {
    setSelectedId(id);
    setPickCardId(null);
    setInspectorTab("object");
  }

  function updateObject(id, patch) {
    const p = getActiveScene(stateRef.current);
    const nextObjects = p.objects.map((o) =>
      o.id === id ? { ...o, ...patch } : o,
    );
    commitScene({ objects: nextObjects });
  }

  function updateCard(id, patch) {
    const p = getActiveScene(stateRef.current);
    const ids = new Set(p.objects.map((o) => o.id));
    commitScene({
      cards: (p.cards || []).map((c) =>
        c.id === id ? validateCard({ ...c, ...patch }, ids) || c : c,
      ),
    });
  }

  function addCard(type) {
    const current = stateRef.current;
    const entry = getActiveEntry(current);
    const p = getActiveScene(current);
    if (!entry || !p.objects.length) {
      setLibraryTab("objects");
      notify(
        "Upload a GLB model in the Objects tab first, then add Lesson boxes for it.",
        "error",
      );
      return;
    }
    if ((p.cards || []).length >= MAX_CARDS) {
      notify(`Keep each model scene to ${MAX_CARDS} lesson boxes.`, "error");
      return;
    }
    const card = newCard(type, p, selectedId);
    commitScene({ cards: [...(p.cards || []), card] });
    selectCard(card.id);
    setLibraryOpen(false);
    if (window.matchMedia?.("(max-width: 1100px)").matches) {
      setInspectorOpen(true);
    }
  }

  function duplicateCard() {
    const p = getActiveScene(stateRef.current);
    const card = (p.cards || []).find((c) => c.id === selectedId);
    if (!card || p.cards.length >= MAX_CARDS) {
      notify(`Keep each scene to ${MAX_CARDS} lesson boxes.`, "error");
      return;
    }
    const copy = {
      ...clone(card),
      id: crypto.randomUUID(),
      title: `${card.title} copy`.slice(0, 60),
      position: [
        Math.min(5.5, card.position[0] + 0.5),
        card.position[1] + 0.25,
        card.position[2],
      ],
    };
    commitScene({ cards: [...p.cards, copy] });
    selectCard(copy.id);
  }

  function duplicateObject() {
    const p = getActiveScene(stateRef.current);
    const object = p.objects.find((o) => o.id === selectedId);
    if (!object || p.objects.length >= MAX_OBJECTS) {
      notify(`Keep each scene to ${MAX_OBJECTS} objects.`, "error");
      return;
    }
    const copy = {
      ...clone(object),
      id: crypto.randomUUID(),
      position: [
        Math.min(4, object.position[0] + 0.5),
        object.position[1],
        object.position[2],
      ],
    };
    commitScene({ objects: [...p.objects, copy] });
    selectObject(copy.id);
  }

  function deleteSelection(id = selectedId) {
    const p = getActiveScene(stateRef.current);
    const card = (p.cards || []).find((c) => c.id === id);
    if (card) {
      commitScene({ cards: p.cards.filter((c) => c.id !== id) });
      if (selectedId === id) setSelectedId(p.objects[0]?.id || null);
      if (pickCardId === id) setPickCardId(null);
      notify("Lesson box removed.");
      return;
    }
    if (!p.objects.some((o) => o.id === id)) return;
    commitScene({
      objects: p.objects.filter((o) => o.id !== id),
      cards: (p.cards || []).map((c) =>
        c.target?.objectId === id ? { ...c, target: null } : c,
      ),
    });
    if (selectedId === id) setSelectedId(null);
    setPickCardId(null);
    notify("Object removed from this scene.");
  }

  function pickPoint(objectId, point) {
    if (!pickCardId) return;
    updateCard(pickCardId, { target: { objectId, point } });
    setPickCardId(null);
    notify("Pointer line attached to the model.");
  }

  function removeCardEntry(entryToRemove, event) {
    event?.stopPropagation();
    if (
      !window.confirm(
        `Remove "${entryToRemove.title}" and its scene from this project?`,
      )
    ) {
      return;
    }
    const current = stateRef.current;
    const entries = current.workspace.entries.filter(
      (item) => item.id !== entryToRemove.id,
    );
    const scenes = current.scenes.filter(
      (s) => s.id !== entryToRemove.sceneId,
    );
    historyMap.current.delete(entryToRemove.sceneId);
    const nextSelectedId =
      current.workspace.selectedEntryId === entryToRemove.id
        ? entries[0]?.id || null
        : current.workspace.selectedEntryId;
    const next = {
      ...current,
      scenes,
      workspace: {
        ...current.workspace,
        entries,
        selectedEntryId: nextSelectedId,
        sharedTarget: null,
        trackerSignature: "",
        updatedAt: new Date().toISOString(),
      },
    };
    replaceState(next);
    const nextEntry = entries.find((e) => e.id === nextSelectedId);
    const nextScene = nextEntry && sceneForEntry(nextEntry, scenes);
    setSelectedId(nextScene?.objects[0]?.id || null);
    setPickCardId(null);
    notify(`"${entryToRemove.title}" removed.`);
  }

  function resetAllWorkspace() {
    if (
      !window.confirm(
        "Clear all uploaded models, markers and lesson boxes to start a brand-new project?",
      )
    ) {
      return;
    }
    historyMap.current.clear();
    const fresh = {
      workspace: newWorkspace("My AR Creation"),
      scenes: [],
      scratch: newScene("Empty workspace"),
    };
    replaceState(fresh);
    setSelectedId(null);
    setPickCardId(null);
    setDialog(null);
    notify("Started a clean new workspace.");
  }

  useEffect(() => {
    function onKeyDown(event) {
      if (
        dialog ||
        /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)
      ) {
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedId
      ) {
        event.preventDefault();
        deleteSelection();
      } else if (event.key === "Escape") {
        setPickCardId(null);
        setLibraryOpen(false);
        setInspectorOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  async function handleUploadFiles(kind, event) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length) return;
    if (files.length > MAX_FLASHCARDS) {
      notify(`Select at most ${MAX_FLASHCARDS} files at once.`, "error");
      return;
    }
    const keys = files.map((f) => filenameKey(f.name));
    if (keys.some((k) => !k) || new Set(keys).size !== keys.length) {
      notify(
        "Each file in one upload batch must have a distinct, non-empty filename.",
        "error",
      );
      return;
    }

    setBusyKind(kind);
    const saved = [];
    const errors = [];
    try {
      for (const file of files) {
        try {
          saved.push({
            file,
            record: await saveLocalFile(file, kind),
            key: filenameKey(file.name),
          });
        } catch (err) {
          errors.push(`${file.name}: ${err.message}`);
        }
      }
      if (!saved.length) {
        if (errors.length) notify(errors.join(" "), "error");
        return;
      }

      const current = stateRef.current;
      let entries = current.workspace.entries.map((item) => ({ ...item }));
      let scenes = [...current.scenes];
      let focusEntryId = null;
      let focusObjectId = null;

      for (const { file, record, key } of saved) {
        let item = entries.find((candidate) => entryFileKey(candidate) === key);
        let scene = item && sceneForEntry(item, scenes);

        if (!item) {
          if (entries.length >= MAX_FLASHCARDS) {
            errors.push(
              `${file.name}: workspace supports up to ${MAX_FLASHCARDS} models.`,
            );
            continue;
          }
          const cleanName =
            filenameStem(file.name).replace(/[_-]+/g, " ").slice(0, 70) ||
            `Model ${entries.length + 1}`;
          scene = newScene(cleanName);
          item = newEntry(scene.id, cleanName, key, entries.length);
          entries.push(item);
          scenes.push(scene);
        }

        if (kind === "model") {
          const previous = scene.objects.find(
            (obj) => obj.id === item.modelObjectId,
          );
          if (!previous && scene.objects.length >= MAX_OBJECTS) {
            errors.push(
              `${file.name}: scene already has ${MAX_OBJECTS} objects.`,
            );
            continue;
          }
          const asset = registerSharedModel({
            id: `upload-${record.id}`,
            name: item.title,
            category: "GLB Model",
            file: `uploads/${record.id}.glb`,
            height: 1.5,
            rotation: [0, 0, 0],
            animate: true,
          });
          const object = previous
            ? {
                ...previous,
                assetId: asset.id,
                model: asset.model,
                name: previous.name || item.title,
              }
            : sceneObject(asset.id, [0, 0, 0], 1, { model: asset.model });

          item.model = record;
          item.modelObjectId = object.id;
          scene = {
            ...scene,
            objects: previous
              ? scene.objects.map((o) => (o.id === previous.id ? object : o))
              : [...scene.objects, object],
            updatedAt: new Date().toISOString(),
          };
          scenes = scenes.map((s) => (s.id === scene.id ? scene : s));
          focusEntryId ||= item.id;
          if (focusEntryId === item.id) focusObjectId = object.id;
        } else if (kind === "marker") {
          item.marker = record;
          focusEntryId ||= item.id;
        } else if (kind === "target") {
          item.sourceMind = record;
          item.sourceTargetIndex = 0;
          focusEntryId ||= item.id;
        }
        item.matchKey ||= key;
      }

      const nextSelectedEntryId =
        kind === "model" && focusEntryId
          ? focusEntryId
          : current.workspace.selectedEntryId || focusEntryId;

      const nextState = {
        ...current,
        scenes,
        workspace: {
          ...current.workspace,
          entries,
          selectedEntryId: nextSelectedEntryId,
          sharedTarget: null,
          trackerSignature: "",
          updatedAt: new Date().toISOString(),
        },
      };
      replaceState(nextState);

      if (nextSelectedEntryId !== current.workspace.selectedEntryId) {
        const chosen = entries.find((e) => e.id === nextSelectedEntryId);
        const chosenScene = chosen && sceneForEntry(chosen, scenes);
        setSelectedId(focusObjectId || chosenScene?.objects[0]?.id || null);
        setPickCardId(null);
      } else if (focusObjectId && kind === "model") {
        setSelectedId(focusObjectId);
      }

      if (errors.length) {
        notify(errors.join(" "), "error");
      } else {
        notify(
          `${saved.length} ${saved.length === 1 ? "file" : "files"} uploaded and matched by name.`,
        );
      }
    } catch (err) {
      notify(err?.message || "Could not upload files.", "error");
    } finally {
      setBusyKind("");
    }
  }

  async function prepareTracker(onProgress) {
    const snapshot = stateRef.current;
    const preparedWorkspace = await prepareWorkspaceTracker(
      snapshot.workspace,
      snapshot.scenes,
      onProgress,
    );
    const nextState = {
      ...stateRef.current,
      workspace: preparedWorkspace,
    };
    if (!saveWorkspaceState(nextState)) {
      setSaveState("error");
      throw new Error("Could not save workspace to browser storage.");
    }
    replaceState(nextState);
    return nextState;
  }

  async function openCameraPreview() {
    const issues = workspaceProblems(
      stateRef.current.workspace,
      stateRef.current.scenes,
    );
    if (issues.length) {
      notify(issues[0], "error");
      return;
    }
    setPreviewBusy("Preparing AR camera…");
    try {
      await prepareTracker(setPreviewBusy);
      setDialog(null);
      window.location.href = draftCollectionUrl({ cameraDirect: true });
    } catch (err) {
      notify(err?.message || "Could not prepare AR camera preview.", "error");
    } finally {
      setPreviewBusy("");
    }
  }

  async function publishSet(base, onProgress) {
    const prepared = await prepareTracker(onProgress);
    return createWorkspacePublication(
      prepared.workspace,
      prepared.scenes,
      base,
      onProgress,
    );
  }

  const modelEntries = state.workspace.entries.filter((entry) => {
    const scene = sceneForEntry(entry, state.scenes);
    return !!scene?.objects?.length;
  });

  const filteredModelEntries = modelEntries.filter((entry) =>
    `${entry.title} ${entry.matchKey}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );

  const pendingModelEntries = state.workspace.entries.filter((entry) => {
    const scene = sceneForEntry(entry, state.scenes);
    return !scene?.objects?.length;
  });

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-button" aria-label="WonderLab creation studio">
          <Logo />
          <span className="brand-descriptor">A SPACE TO CREATE</span>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          <button type="button" aria-label="Create" className="active">
            <WandSparkles size={17} />
            <span>Create</span>
          </button>
        </nav>
        <div className="header-right">
          <IconButton
            label="How this workspace works"
            onClick={() => setDialog("help")}
          >
            <CircleHelp size={19} />
          </IconButton>
          <span className="header-divider" />
          <button
            className="creator-profile"
            aria-label="Workspace options"
            onClick={() => setDialog("workspace")}
          >
            <span className="creator-avatar">
              <Smile size={25} />
            </span>
            <span>
              <strong>Creator space</strong>
              <small>
                <span />
                {state.workspace.entries.length}{" "}
                {state.workspace.entries.length === 1 ? "card" : "cards"}
              </small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
      </header>

      <section className="project-toolbar">
        <div className="project-info">
          <div>
            <div className="project-breadcrumb">
              <span>Single QR AR Set</span>
              <ChevronRight size={11} />
              <span>
                {activeEntry
                  ? `Editing: ${activeEntry.title}`
                  : "3D & AR creation"}
              </span>
            </div>
            <div className="project-title-row">
              <input
                aria-label="Project title"
                value={state.workspace.title}
                maxLength={70}
                onChange={(e) => updateWorkspace({ title: e.target.value })}
                onBlur={() => {
                  if (!state.workspace.title.trim()) {
                    updateWorkspace({ title: "My AR Creation" });
                  }
                }}
              />
              <span className="project-subject">
                <Orbit size={12} />
                {activeEntry ? activeEntry.title : "Upload GLB to begin"}
              </span>
            </div>
          </div>
        </div>

        <div className="project-actions">
          <div className="history-actions">
            <IconButton
              label="Undo (Ctrl+Z)"
              disabled={!currentHistory.past.length}
              onClick={undo}
            >
              <Undo2 size={18} />
            </IconButton>
            <IconButton
              label="Redo (Ctrl+Shift+Z)"
              disabled={!currentHistory.future.length}
              onClick={redo}
            >
              <Redo2 size={18} />
            </IconButton>
          </div>
          <span className="toolbar-divider" />
          <button
            type="button"
            className={`button save-button ${saveState === "error" ? "storage-error" : ""}`}
            onClick={() => {
              const ok = saveWorkspaceState(stateRef.current);
              setSaveState(ok ? "saved" : "error");
              if (ok) notify("All models and lesson boxes saved on this device.");
            }}
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
                  ? "Storage full"
                  : "Saved"}
            </span>
          </button>
          <button
            type="button"
            className="button secondary preview-button"
            disabled={!!previewBusy}
            onClick={() => {
              if (!activeEntry || !project.objects.length) {
                notify("Upload a GLB model first to preview.", "error");
                return;
              }
              setDialog("preview");
            }}
          >
            {previewBusy ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <Play size={15} />
            )}
            <span>{previewBusy || "Preview"}</span>
          </button>
          <button
            type="button"
            className="button primary publish-button"
            onClick={() => setDialog("publish")}
          >
            <Share2 size={16} />
            <span>Publish &amp; share</span>
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
              label="Close toolbox"
              onClick={() => setLibraryOpen(false)}
            >
              <X size={18} />
            </IconButton>
          </div>

          <div className="library-tabs">
            <button
              type="button"
              className={libraryTab === "objects" ? "active" : ""}
              onClick={() => setLibraryTab("objects")}
            >
              <Box size={16} />
              Objects
              {modelEntries.length > 0 && <span>{modelEntries.length}</span>}
            </button>
            <button
              type="button"
              className={libraryTab === "lesson" ? "active" : ""}
              onClick={() => setLibraryTab("lesson")}
            >
              <BookOpen size={16} />
              Lesson
              {cards.length > 0 && <span>{cards.length}</span>}
            </button>
            <button
              type="button"
              className={libraryTab === "markers" ? "active" : ""}
              onClick={() => setLibraryTab("markers")}
            >
              <ScanLine size={16} />
              Markers
              {state.workspace.entries.length > 0 && (
                <span>{state.workspace.entries.length}</span>
              )}
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
                if (window.matchMedia?.("(max-width: 1100px)").matches) {
                  setInspectorOpen(true);
                }
              }}
            />
          ) : libraryTab === "objects" ? (
            <>
              <div className="toolbox-upload-box">
                <label
                  className={`button primary full toolbox-upload-btn ${busyKind ? "disabled" : ""}`}
                >
                  {busyKind === "model" ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <Upload size={15} />
                  )}
                  <span>
                    {busyKind === "model"
                      ? "Uploading GLB…"
                      : "Upload GLB models"}
                  </span>
                  <input
                    type="file"
                    className="visually-hidden"
                    aria-label="Upload GLB models"
                    accept=".glb,model/gltf-binary"
                    multiple
                    disabled={!!busyKind}
                    onChange={(e) => handleUploadFiles("model", e)}
                  />
                </label>
              </div>

              <label className="search-field">
                <Search size={16} />
                <input
                  aria-label="Search uploaded models"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find your GLB model…"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Clear model search"
                    onClick={() => setSearch("")}
                  >
                    <X size={13} />
                  </button>
                )}
              </label>

              {pendingModelEntries.length > 0 && (
                <div className="pending-match-banner">
                  <strong>Waiting for matching GLB:</strong>
                  <span>
                    {pendingModelEntries
                      .map((e) => `${e.matchKey}.glb`)
                      .join(", ")}
                  </span>
                </div>
              )}

              <div className="library-scroll">
                <div className="library-section-label">
                  <span>YOUR UPLOADED MODELS</span>
                  <span>
                    {filteredModelEntries.length}{" "}
                    {filteredModelEntries.length === 1 ? "model" : "models"}
                  </span>
                </div>

                {filteredModelEntries.length ? (
                  <div className="asset-grid">
                    {filteredModelEntries.map((item) => {
                      const itemScene = sceneForEntry(item, state.scenes);
                      const primaryObj = itemScene?.objects[0];
                      const status = entryStatus(item, state.scenes);
                      const isActive = activeEntry?.id === item.id;
                      const boxCount = itemScene?.cards?.length || 0;
                      return (
                        <div
                          key={item.id}
                          className={`asset-card-wrapper ${isActive ? "is-active" : ""}`}
                        >
                          <button
                            type="button"
                            className={`asset-card ${isActive ? "active-model-card" : ""}`}
                            onClick={() => {
                              activateEntry(item);
                              setLibraryOpen(false);
                            }}
                            aria-label={`Edit ${item.title} scene`}
                            title={`Click to edit ${item.title}`}
                          >
                            <span
                              className="asset-art"
                              style={{
                                background: primaryObj
                                  ? getAsset(
                                      primaryObj.assetId,
                                      primaryObj.model,
                                    ).bg
                                  : "#edf4ef",
                              }}
                            >
                              {primaryObj && (
                                <AssetImage
                                  assetId={primaryObj.assetId}
                                  model={primaryObj.model}
                                  alt=""
                                  draggable={false}
                                />
                              )}
                              <span className="asset-filetype">GLB</span>
                              <span
                                className={`asset-match-dot ${status.ready ? "ready" : "pending"}`}
                                title={
                                  status.ready
                                    ? "Model, marker & .mind matched"
                                    : "Upload matching marker & .mind in Markers tab"
                                }
                              >
                                {status.ready ? <Check size={11} /> : "!"}
                              </span>
                            </span>
                            <span className="asset-card-copy">
                              <strong>{item.title}</strong>
                              <span>
                                {status.ready ? "Ready" : "Needs marker/.mind"}
                                {boxCount > 0
                                  ? ` · ${boxCount} ${boxCount === 1 ? "box" : "boxes"}`
                                  : ""}
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            className="asset-card-delete"
                            aria-label={`Remove ${item.title}`}
                            title={`Remove ${item.title}`}
                            onClick={(e) => removeCardEntry(item, e)}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={Upload}
                    title={
                      search ? "No matching model" : "Upload your GLB models"
                    }
                  >
                    {search
                      ? "Try a different model name."
                      : "Upload one or more .glb files above. Each model gets its own scene and lesson boxes."}
                  </EmptyState>
                )}

                <div className="library-bottom-note">
                  <Sparkles size={15} />
                  <span>
                    Click a model to edit its scene.
                    <br />
                    Each model saves its own Lesson boxes.
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="library-scroll marker-library">
              <p className="panel-description">
                Upload marker images and compiled <code>.mind</code> files using
                the <strong>same filename</strong> as each GLB model.
              </p>

              <div className="marker-upload-stack">
                <label
                  className={`button primary full marker-maker-button ${busyKind ? "disabled" : ""}`}
                >
                  {busyKind === "marker" ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <FileImage size={15} />
                  )}
                  <span>
                    {busyKind === "marker"
                      ? "Uploading markers…"
                      : "Upload marker images"}
                  </span>
                  <input
                    type="file"
                    className="visually-hidden"
                    aria-label="Upload marker images"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    multiple
                    disabled={!!busyKind}
                    onChange={(e) => handleUploadFiles("marker", e)}
                  />
                </label>

                <label
                  className={`button secondary full marker-mind-button ${busyKind ? "disabled" : ""}`}
                >
                  {busyKind === "target" ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <FileScan size={15} />
                  )}
                  <span>
                    {busyKind === "target"
                      ? "Reading .mind files…"
                      : "Upload .mind files"}
                  </span>
                  <input
                    type="file"
                    className="visually-hidden"
                    aria-label="Upload mind files"
                    accept=".mind,application/octet-stream"
                    multiple
                    disabled={!!busyKind}
                    onChange={(e) => handleUploadFiles("target", e)}
                  />
                </label>
              </div>

              <div className="same-name-hint">
                <strong>Auto-matched by filename</strong>
                <small>e.g. stegosaurus.glb + stegosaurus.jpg + stegosaurus.mind</small>
              </div>

              {state.workspace.entries.length > 0 ? (
                <div className="my-markers" aria-label="Uploaded markers and targets">
                  <span className="field-label">
                    MATCHED CARDS ({state.workspace.entries.length})
                  </span>
                  {state.workspace.entries.map((item) => {
                    const status = entryStatus(item, state.scenes);
                    const img = item.marker
                      ? resolveResourceUrl(item.marker.ref)
                      : "";
                    const isActive = activeEntry?.id === item.id;
                    return (
                      <div
                        className={`marker-card custom ${isActive ? "active" : ""}`}
                        key={item.id}
                      >
                        <button
                          type="button"
                          className="marker-card-main"
                          aria-label={`Select ${item.title}`}
                          onClick={() => {
                            activateEntry(item);
                            setLibraryOpen(false);
                          }}
                        >
                          <img
                            src={img || MARKER_PLACEHOLDER}
                            alt={`${item.title} marker`}
                          />
                          <span className="marker-card-info">
                            <strong>{item.title}</strong>
                            <span className="match-pills">
                              <i className={status.modelReady ? "ok" : ""}>
                                GLB {status.modelReady ? "✓" : "○"}
                              </i>
                              <i className={status.markerReady ? "ok" : ""}>
                                Img {status.markerReady ? "✓" : "○"}
                              </i>
                              <i className={status.mindReady ? "ok" : ""}>
                                .mind {status.mindReady ? "✓" : "○"}
                              </i>
                            </span>
                          </span>
                          <span className="marker-selected">
                            {status.ready ? (
                              <Check size={14} />
                            ) : (
                              <Upload size={13} />
                            )}
                          </span>
                        </button>
                        <IconButton
                          label={`Remove ${item.title}`}
                          className="marker-remove"
                          onClick={(e) => removeCardEntry(item, e)}
                        >
                          <X size={13} />
                        </IconButton>
                        {status.targetCount > 1 && (
                          <div className="marker-target-select">
                            <label htmlFor={`mind-idx-${item.id}`}>
                              Target in .mind ({status.targetCount}):
                            </label>
                            <select
                              id={`mind-idx-${item.id}`}
                              value={item.sourceTargetIndex ?? 0}
                              onChange={(e) => {
                                const idx = Number(e.target.value);
                                updateWorkspace({
                                  sharedTarget: null,
                                  trackerSignature: "",
                                  entries: state.workspace.entries.map((en) =>
                                    en.id === item.id
                                      ? { ...en, sourceTargetIndex: idx }
                                      : en,
                                  ),
                                });
                              }}
                            >
                              {Array.from(
                                { length: status.targetCount },
                                (_, idx) => (
                                  <option key={idx} value={idx}>
                                    Target #{idx + 1} (index {idx})
                                  </option>
                                ),
                              )}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon={ScanLine} title="No markers uploaded yet">
                  Upload your marker images (.jpg / .png) and compiled .mind
                  files above.
                </EmptyState>
              )}

              <div className="marker-ready">
                <ShieldCheck size={16} />
                <span>
                  All .mind targets combine automatically into{" "}
                  <strong>one single QR camera</strong>.
                </span>
              </div>
              <button
                type="button"
                className="button secondary full"
                onClick={() => setDialog("publish")}
              >
                <Printer size={15} />
                Get printable sheet &amp; QR
              </button>
            </div>
          )}
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
                type="button"
                className="mobile-panel-button"
                onClick={() => {
                  setLibraryOpen(!libraryOpen);
                  setInspectorOpen(false);
                }}
              >
                <Box size={15} />
                Toolbox
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
                type="button"
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
                const safe = validateScene({
                  ...project,
                  objects: project.objects.map((o) =>
                    o.id === id ? { ...o, ...patch } : o,
                  ),
                });
                commitScene({ objects: safe.objects });
              }}
              tool={tool}
              grid={grid}
              markerVisible={markerVisible}
              markerImage={activeMarkerImage}
              playing={playing}
              showActions={playing}
              onSoundError={() =>
                notify("This sound could not play. Check the audio file.", "error")
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
                <button type="button" onClick={() => setPickCardId(null)}>
                  Cancel
                </button>
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
                  : "Upload your .glb models in Objects, then match markers & .mind files."}
              </p>
            </div>

            <button
              type="button"
              className="canvas-help"
              onClick={() => setDialog("help")}
            >
              <CircleHelp size={14} />
              How same-name matching works
              <ArrowUpRight size={13} />
            </button>

            <div className="marker-widget">
              <button
                type="button"
                className="marker-widget-thumb"
                aria-label="Open Markers tab"
                onClick={() => {
                  setLibraryTab("markers");
                  setLibraryOpen(true);
                }}
              >
                <img
                  src={activeMarkerImage || MARKER_PLACEHOLDER}
                  alt="Active tracking marker"
                />
                <ScanLine size={13} />
              </button>
              <div>
                <span>YOUR AR MARKER</span>
                <strong>
                  {activeEntry ? activeEntry.title : "No marker yet"}
                </strong>
                <button
                  type="button"
                  onClick={() => {
                    if (activeStatus?.ready) {
                      setDialog("publish");
                    } else {
                      setLibraryTab("markers");
                      setLibraryOpen(true);
                    }
                  }}
                >
                  <Printer size={11} />
                  {activeStatus?.ready
                    ? "Ready to publish"
                    : "Upload marker & .mind"}
                  <ChevronRight size={11} />
                </button>
              </div>
            </div>

            <span className="canvas-object-count">
              <Box size={12} />
              {modelEntries.length}{" "}
              {modelEntries.length === 1 ? "model in set" : "models in set"}
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
                  type="button"
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
                type="button"
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
                {playing ? <span className="stop-icon" /> : <Play size={16} />}
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
                type="button"
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
              label="Close inspector"
              onClick={() => setInspectorOpen(false)}
            >
              <X size={18} />
            </IconButton>
          </div>
          <div className="inspector-tabs">
            <button
              type="button"
              className={inspectorTab === "object" ? "active" : ""}
              onClick={() => setInspectorTab("object")}
            >
              <SlidersHorizontal size={14} />
              {selectedCard ? "Lesson box" : "Object"}
            </button>
            <button
              type="button"
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
                  onDelete={() => deleteSelection(selectedCard.id)}
                  onDuplicate={duplicateCard}
                  picking={pickCardId === selectedCard.id}
                  onPick={() => {
                    const next =
                      pickCardId === selectedCard.id ? null : selectedCard.id;
                    setPickCardId(next);
                    if (next) setInspectorOpen(false);
                  }}
                  notify={notify}
                />
              ) : selectedObject ? (
                <ObjectProperties
                  object={selectedObject}
                  update={(patch) => updateObject(selectedObject.id, patch)}
                  onDelete={() => deleteSelection(selectedObject.id)}
                  onDuplicate={duplicateObject}
                  onTestAction={(action) => {
                    const res = canvas.current?.playAction(
                      selectedObject.id,
                      action,
                    );
                    if (res === "loop") {
                      notify("Playing on repeat. Tap ▶ again to stop.");
                    }
                  }}
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
                    {project.objects.length
                      ? "Click the model or a Lesson box in the scene to customise it."
                      : "Upload a .glb model in the Objects tab to start customizing."}
                  </p>
                  {project.objects.length > 0 && (
                    <button
                      type="button"
                      className="button secondary full"
                      onClick={() => setInspectorTab("scene")}
                    >
                      <Layers size={15} />
                      See scene objects
                    </button>
                  )}
                </div>
              )
            ) : (
              <SceneObjects
                project={project}
                selectedId={selectedId}
                markerImage={activeMarkerImage}
                markerName={activeEntry?.title}
                onSelectCard={selectCard}
                updateCard={updateCard}
                onSelect={selectObject}
                updateObject={updateObject}
                onDelete={deleteSelection}
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
            ? "Browser storage full — remove unused files"
            : "Your ideas, safe on this device"}
        </span>
        <span>
          <ShieldCheck size={12} />
          <span>No login. One QR for all your models.</span>
        </span>
        <button type="button" onClick={() => setDialog("help")}>
          A little help?
          <ArrowUpRight size={11} />
        </button>
      </footer>

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

      {dialog === "publish" && (
        <PublishModal
          workspace={state.workspace}
          scenes={state.scenes}
          onClose={() => setDialog(null)}
          onPublish={publishSet}
          onTestCamera={openCameraPreview}
        />
      )}

      {dialog === "preview" && activeEntry && (
        <Modal
          label="Interactive 3D preview"
          className="preview-modal"
          onClose={() => {
            setPreviewCard(null);
            setDialog(null);
          }}
        >
          <div className="preview-heading">
            <span className="eyebrow">
              <Play size={13} /> INTERACTIVE PREVIEW
            </span>
            <h2>{activeEntry.title}</h2>
            <p>
              Drag to orbit and tap any Lesson box to test text, audio, video,
              images or links.
            </p>
          </div>
          <div className="preview-canvas">
            <StudioCanvas
              key={activeEntry.id}
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
            {modelEntries.length > 1 && (
              <div className="preview-switcher">
                {modelEntries.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={item.id === activeEntry.id ? "active" : ""}
                    onClick={() => {
                      setPreviewCard(null);
                      activateEntry(item);
                    }}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            )}
            <div className="preview-footer-buttons">
              <button
                type="button"
                className="button secondary"
                disabled={!!previewBusy}
                onClick={openCameraPreview}
              >
                <Camera size={15} />
                {previewBusy || "Test AR Camera (All Models)"}
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  setPreviewCard(null);
                  setDialog("publish");
                }}
              >
                <Share2 size={15} />
                Publish &amp; share
              </button>
            </div>
          </div>
        </Modal>
      )}

      {dialog === "help" && (
        <Modal
          label="How to build your single-QR AR set"
          onClose={() => setDialog(null)}
        >
          <div className="modal-heading">
            <span className="eyebrow">
              <Sparkles size={14} /> QUICK GUIDE
            </span>
            <h2>One workspace. One QR code.</h2>
            <p>
              Match your models, markers, and <code>.mind</code> files
              automatically by filename.
            </p>
          </div>
          <ol className="help-steps-list">
            <li>
              <strong>1. Objects tab — Upload GLB models:</strong> Upload your{" "}
              <code>.glb</code> models (for example{" "}
              <code>stegosaurus.glb</code>, <code>velociraptor.glb</code>).
              Click any model to open its own scene.
            </li>
            <li>
              <strong>2. Lesson tab — Add details per model:</strong> Add Text,
              Audio (record or upload), Video, Image, or Link boxes and point
              them to parts of that model. Every model keeps its own separate
              boxes!
            </li>
            <li>
              <strong>3. Markers tab — Upload markers &amp; .mind files:</strong>{" "}
              Upload marker images (<code>stegosaurus.jpg</code>) and compiled{" "}
              <code>.mind</code> files (<code>stegosaurus.mind</code>) with the
              exact same base name. They pair automatically!
            </li>
            <li>
              <strong>4. Publish &amp; share — Single QR Code:</strong> Click{" "}
              <strong>Publish &amp; share</strong> to generate one QR code and
              download the publish ZIP. Extract and drag the{" "}
              <code>public</code> folder into your GitHub repository — scanning
              that one QR opens the AR camera directly and recognizes all your
              markers!
            </li>
          </ol>
          <button
            type="button"
            className="button primary full"
            onClick={() => setDialog(null)}
          >
            Got it
          </button>
        </Modal>
      )}

      {dialog === "workspace" && (
        <Modal
          label="Workspace settings"
          onClose={() => setDialog(null)}
        >
          <div className="modal-heading">
            <span className="eyebrow">
              <Sparkles size={14} /> CREATOR SPACE
            </span>
            <h2>{state.workspace.title}</h2>
            <p>
              Currently holding{" "}
              <strong>{state.workspace.entries.length}</strong>{" "}
              {state.workspace.entries.length === 1 ? "AR card" : "AR cards"}{" "}
              saved in your browser on this device.
            </p>
          </div>
          <div className="workspace-modal-actions">
            <button
              type="button"
              className="button secondary full"
              onClick={resetAllWorkspace}
            >
              <RotateCcw size={15} /> Clear all &amp; start a new set
            </button>
            <button
              type="button"
              className="button primary full"
              onClick={() => setDialog(null)}
            >
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
