import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Box,
  CheckCheck,
  ChevronRight,
  CloudOff,
  Grid2X2,
  Layers,
  LoaderCircle,
  Maximize,
  Minus,
  MousePointer2,
  Move3D,
  Play,
  Plus,
  QrCode,
  Redo2,
  RotateCw,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  WandSparkles,
  X,
} from "lucide-react";
import StudioCanvas from "./StudioCanvas";
import FlashcardLibrary from "./FlashcardLibrary";
import FlashcardPublish from "./FlashcardPublish";
import { CardProperties, TeacherSignIn } from "./CardEditor";
import { ObjectProperties, SceneObjects } from "./SceneProperties";
import { IconButton, Logo } from "./UI";
import {
  getAsset,
  hasAsset,
  registerSharedModel,
  sceneObject,
} from "../lib/assets";
import { newCard, validateCard, MAX_CARDS } from "../lib/lesson-cards";
import { saveLocalFile, resolveResourceUrl } from "../lib/local-files";
import {
  createPublication,
  draftUrl,
  MAX_FLASHCARDS,
  newMiniEntry,
  newMiniProject,
  saveMiniProjects,
  sceneForEntry,
} from "../lib/mini-projects";
import {
  clone,
  MAX_OBJECTS,
  newProject,
  saveProjects,
  validateProject,
} from "../lib/projects";
import {
  bootstrapFlashcards,
  entryFileKey,
  filenameKey,
  filenameStem,
  FLASH_ACTIVE_KEY,
  flashcardProblems,
  hasIndividualMindFiles,
  prepareFlashcardTracker,
  sourceTrackerSignature,
} from "../lib/flashcards";

function getSet(state) {
  return state.minis.find((item) => item.id === state.activeMiniId);
}
function getEntry(state) {
  return getSet(state)?.entries.find(
    (item) => item.id === state.selectedEntryId,
  );
}
function getScene(state) {
  const entry = getEntry(state);
  return (entry && sceneForEntry(entry, state.projects)) || state.scratch;
}
function persisted(state) {
  const projectSaved = saveProjects(state.projects);
  const miniSaved = saveMiniProjects(state.minis);
  let activeSaved = true;
  try {
    localStorage.setItem(FLASH_ACTIVE_KEY, state.activeMiniId);
  } catch {
    activeSaved = false;
  }
  return projectSaved && miniSaved && activeSaved;
}
function withSet(state, mini) {
  return {
    ...state,
    minis: state.minis.map((item) => (item.id === mini.id ? mini : item)),
  };
}

export default function FlashcardStudio() {
  const [state, setState] = useState(bootstrapFlashcards);
  const stateRef = useRef(state);
  stateRef.current = state;
  const mini = getSet(state);
  const entry = getEntry(state);
  const project = getScene(state);
  const [selectedId, setSelectedId] = useState(
    () => getScene(state).objects[0]?.id || null,
  );
  const [inspectorTab, setInspectorTab] = useState("object");
  const [tool, setTool] = useState("select");
  const [grid, setGrid] = useState(true);
  const [markerVisible, setMarkerVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [pickCardId, setPickCardId] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [dialog, setDialog] = useState("");
  const [busy, setBusy] = useState("");
  const [previewProgress, setPreviewProgress] = useState("");
  const [saveState, setSaveState] = useState("saving");
  const [toast, setToast] = useState(null);
  const canvas = useRef(null);
  const history = useRef({ past: [], future: [] });
  const cards = project.cards || [];
  const selected = project.objects.find((object) => object.id === selectedId);
  const selectedCard = cards.find((card) => card.id === selectedId);
  const problems = flashcardProblems(mini, state.projects);
  const markerImage = entry?.marker ? resolveResourceUrl(entry.marker.ref) : "";

  function replaceState(next) {
    stateRef.current = next;
    setSaveState("saving");
    setState(next);
  }
  function notify(message, kind = "success") {
    setToast({ message, kind });
  }
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setSaveState("saving");
    const timer = setTimeout(
      () => setSaveState(persisted(state) ? "saved" : "error"),
      280,
    );
    return () => clearTimeout(timer);
  }, [state]);
  useEffect(() => {
    const save = () => persisted(stateRef.current);
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, []);

  function resetSelection(next, selectedEntryId) {
    history.current = { past: [], future: [] };
    setPickCardId(null);
    setPlaying(false);
    setTool("select");
    setInspectorTab("object");
    const selectedEntry = getSet(next)?.entries.find(
      (item) => item.id === selectedEntryId,
    );
    setSelectedId(
      (selectedEntry &&
        sceneForEntry(selectedEntry, next.projects)?.objects[0]?.id) ||
        null,
    );
  }
  function selectEntry(nextEntry) {
    const current = stateRef.current;
    const next = { ...current, selectedEntryId: nextEntry.id };
    replaceState(next);
    resetSelection(next, nextEntry.id);
    setLibraryOpen(false);
  }
  function switchSet(id) {
    const current = stateRef.current;
    const set = current.minis.find(
      (item) => item.id === id && item.mode === "shared",
    );
    if (!set) return;
    const selectedEntry = set.entries.find((item) =>
      sceneForEntry(item, current.projects),
    );
    const next = {
      ...current,
      activeMiniId: id,
      selectedEntryId: selectedEntry?.id || null,
    };
    replaceState(next);
    resetSelection(next, next.selectedEntryId);
  }
  function startSet() {
    if (
      !window.confirm(
        "Start a new flashcard set? Your current set remains saved on this device.",
      )
    )
      return;
    const current = stateRef.current;
    const nextMini = newMiniProject("My flashcard set", "shared");
    const next = {
      ...current,
      minis: [nextMini, ...current.minis],
      activeMiniId: nextMini.id,
      selectedEntryId: null,
    };
    replaceState(next);
    resetSelection(next, null);
    notify("New set ready. Your previous sets remain on this device.");
  }
  function updateSet(patch) {
    const current = stateRef.current;
    const nextMini = {
      ...getSet(current),
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    replaceState(withSet(current, nextMini));
  }
  function updateEntry(id, patch) {
    const current = stateRef.current;
    const set = getSet(current);
    updateSet({
      entries: set.entries.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  }
  function renameEntry(item, title) {
    const current = stateRef.current;
    const set = getSet(current);
    const nextMini = {
      ...set,
      entries: set.entries.map((entry) =>
        entry.id === item.id
          ? { ...entry, matchKey: entry.matchKey || entryFileKey(entry), title }
          : entry,
      ),
      updatedAt: new Date().toISOString(),
    };
    replaceState({
      ...withSet(current, nextMini),
      projects: current.projects.map((scene) =>
        scene.id === item.sceneId
          ? { ...scene, title, updatedAt: new Date().toISOString() }
          : scene,
      ),
    });
  }
  function removeEntry(item) {
    if (
      !window.confirm(
        `Remove “${item.title}” from this set? Its scene will remain saved on this device.`,
      )
    )
      return;
    const current = stateRef.current;
    const set = getSet(current);
    const entries = set.entries.filter((candidate) => candidate.id !== item.id);
    const nextMini = { ...set, entries, updatedAt: new Date().toISOString() };
    const nextId =
      current.selectedEntryId === item.id
        ? entries[0]?.id || null
        : current.selectedEntryId;
    const next = { ...withSet(current, nextMini), selectedEntryId: nextId };
    replaceState(next);
    if (current.selectedEntryId === item.id) resetSelection(next, nextId);
    notify("Card removed from this set. Its saved scene was not deleted.");
  }
  function commit(patch, addHistory = true) {
    const current = stateRef.current;
    const selectedEntry = getEntry(current);
    if (!selectedEntry) return;
    const old = sceneForEntry(selectedEntry, current.projects);
    if (!old) return;
    if (addHistory) {
      history.current.past.push(clone(old));
      if (history.current.past.length > 50) history.current.past.shift();
      history.current.future = [];
    }
    const nextProject = {
      ...old,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    replaceState({
      ...current,
      projects: current.projects.map((item) =>
        item.id === old.id ? nextProject : item,
      ),
    });
  }
  function updateObject(id, patch) {
    const p = getScene(stateRef.current);
    commit({
      objects: p.objects.map((object) =>
        object.id === id ? { ...object, ...patch } : object,
      ),
    });
  }
  function updateCard(id, patch) {
    const p = getScene(stateRef.current);
    commit({
      cards: (p.cards || []).map((card) =>
        card.id === id
          ? validateCard(
              { ...card, ...patch },
              new Set(p.objects.map((o) => o.id)),
            ) || card
          : card,
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
  function addObject(id, position) {
    if (!getEntry(stateRef.current))
      return notify("Upload or select a card first.", "error");
    const p = getScene(stateRef.current);
    if (p.objects.length >= MAX_OBJECTS)
      return notify(`Keep a scene to ${MAX_OBJECTS} objects.`, "error");
    if (!hasAsset(id)) return;
    const object = sceneObject(
      id,
      position || [(Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2],
      1,
    );
    commit({ objects: [...p.objects, object] });
    selectObject(object.id);
    setLibraryOpen(false);
    notify(`${getAsset(id).name} added to this card.`);
  }
  function deleteSelection(id = selectedId) {
    const p = getScene(stateRef.current);
    const card = (p.cards || []).find((item) => item.id === id);
    if (card) {
      commit({ cards: p.cards.filter((item) => item.id !== id) });
      if (selectedId === id) setSelectedId(p.objects[0]?.id || null);
      if (pickCardId === id) setPickCardId(null);
      notify("Lesson box removed.");
      return;
    }
    if (!p.objects.some((object) => object.id === id)) return;
    commit({
      objects: p.objects.filter((object) => object.id !== id),
      cards: (p.cards || []).map((item) =>
        item.target?.objectId === id ? { ...item, target: null } : item,
      ),
    });
    if (selectedId === id) setSelectedId(null);
    setPickCardId(null);
    notify("Object removed from this scene.");
  }
  function duplicateObject() {
    const p = getScene(stateRef.current);
    const object = p.objects.find((item) => item.id === selectedId);
    if (!object || p.objects.length >= MAX_OBJECTS)
      return notify(`Keep a scene to ${MAX_OBJECTS} objects.`, "error");
    const copy = {
      ...clone(object),
      id: crypto.randomUUID(),
      position: [
        Math.min(4, object.position[0] + 0.5),
        object.position[1],
        object.position[2],
      ],
    };
    commit({ objects: [...p.objects, copy] });
    selectObject(copy.id);
  }
  function addCard(type) {
    const p = getScene(stateRef.current);
    if (!getEntry(stateRef.current))
      return notify("Select a card first.", "error");
    if ((p.cards || []).length >= MAX_CARDS)
      return notify(`Keep a scene to ${MAX_CARDS} lesson boxes.`, "error");
    const card = newCard(type, p, selectedId);
    commit({ cards: [...(p.cards || []), card] });
    selectCard(card.id);
    setInspectorOpen(true);
    setLibraryOpen(false);
  }
  function duplicateCard() {
    const p = getScene(stateRef.current);
    const card = (p.cards || []).find((item) => item.id === selectedId);
    if (!card || p.cards.length >= MAX_CARDS)
      return notify(`Keep a scene to ${MAX_CARDS} lesson boxes.`, "error");
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
    commit({ cards: [...p.cards, copy] });
    selectCard(copy.id);
  }
  function undo() {
    const previous = history.current.past.pop();
    if (!previous) return;
    const current = stateRef.current;
    history.current.future.push(clone(getScene(current)));
    replaceState({
      ...current,
      projects: current.projects.map((item) =>
        item.id === previous.id ? previous : item,
      ),
    });
    if (
      ![...previous.objects, ...(previous.cards || [])].some(
        (item) => item.id === selectedId,
      )
    )
      setSelectedId(previous.objects[0]?.id || null);
  }
  function redo() {
    const nextProject = history.current.future.pop();
    if (!nextProject) return;
    const current = stateRef.current;
    history.current.past.push(clone(getScene(current)));
    replaceState({
      ...current,
      projects: current.projects.map((item) =>
        item.id === nextProject.id ? nextProject : item,
      ),
    });
  }
  useEffect(() => {
    function key(event) {
      if (
        dialog ||
        /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)
      )
        return;
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
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  async function uploadFiles(kind, event) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length) return;
    const original = stateRef.current;
    const originalSet = getSet(original);
    if (
      kind === "target" &&
      originalSet.sharedTarget &&
      !hasIndividualMindFiles(originalSet) &&
      !window.confirm(
        "This set uses an existing combined .mind file. To rebuild it from individual files, every card will need its matching .mind file. Continue?",
      )
    )
      return;
    if (files.length > MAX_FLASHCARDS)
      return notify(
        `Select at most ${MAX_FLASHCARDS} files at a time.`,
        "error",
      );
    const keys = files.map((file) => filenameKey(file.name));
    if (keys.some((key) => !key) || new Set(keys).size !== keys.length)
      return notify(
        "Choose files with different, non-empty names. Names are matched without case or extension.",
        "error",
      );
    const existingCounts = new Map();
    for (const item of originalSet.entries) {
      const key = entryFileKey(item);
      existingCounts.set(key, (existingCounts.get(key) || 0) + 1);
    }
    if (keys.some((key) => (existingCounts.get(key) || 0) > 1))
      return notify(
        "More than one existing card has that filename. Remove the duplicate before uploading.",
        "error",
      );
    const newCards = keys.filter((key) => !existingCounts.has(key)).length;
    if (originalSet.entries.length + newCards > MAX_FLASHCARDS)
      return notify(
        `This set can contain at most ${MAX_FLASHCARDS} cards. Select fewer new files.`,
        "error",
      );
    setBusy(kind);
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
        } catch (error) {
          errors.push(`${file.name}: ${error.message}`);
        }
      }
      if (!saved.length) {
        if (errors.length) notify(errors.join(" "), "error");
        return;
      }
      const current = stateRef.current;
      const set = current.minis.find((item) => item.id === originalSet.id);
      if (!set) throw new Error("The active set is no longer available.");
      let entries = set.entries.map((item) => ({ ...item }));
      let projects = [...current.projects];
      let firstAdded = null;
      const addedModels = new Map();
      for (const { file, record, key } of saved) {
        const matching = entries.filter((item) => entryFileKey(item) === key);
        if (matching.length > 1) {
          errors.push(
            `${file.name}: more than one existing card has this name; remove the duplicate first.`,
          );
          continue;
        }
        let item = matching[0];
        let scene = item && sceneForEntry(item, projects);
        if (item && !scene) {
          errors.push(`${file.name}: its saved scene is missing.`);
          continue;
        }
        if (!item) {
          if (entries.length >= MAX_FLASHCARDS) {
            errors.push(
              `${file.name}: a set can have at most ${MAX_FLASHCARDS} cards.`,
            );
            continue;
          }
          scene = newProject("blank");
          scene.title =
            filenameStem(file.name).replace(/[_-]+/g, " ").slice(0, 70) ||
            `Card ${entries.length + 1}`;
          item = {
            ...newMiniEntry(scene.id, scene.title, entries.length),
            matchKey: key,
            ...(set.sharedTarget && !hasIndividualMindFiles(set)
              ? { requiresLegacyIndex: true }
              : {}),
          };
          entries.push(item);
          projects.unshift(scene);
          firstAdded ||= item.id;
        }
        if (kind === "model") {
          const previous = scene.objects.find(
            (object) => object.id === item.modelObjectId,
          );
          if (!previous && scene.objects.length >= MAX_OBJECTS) {
            errors.push(
              `${file.name}: this scene already has ${MAX_OBJECTS} objects.`,
            );
            continue;
          }
          const asset = registerSharedModel({
            id: `upload-${record.id}`,
            name: item.title,
            category: "Your uploads",
            file: `uploads/${record.id}.glb`,
            height: 1.5,
            rotation: [0, 0, 0],
            animate: true,
          });
          const object = previous
            ? { ...previous, assetId: asset.id, model: asset.model }
            : sceneObject(asset.id, [0, 0, 0], 1);
          item.model = record;
          item.modelObjectId = object.id;
          scene = {
            ...scene,
            objects: previous
              ? scene.objects.map((old) =>
                  old.id === previous.id ? object : old,
                )
              : [...scene.objects, object],
            updatedAt: new Date().toISOString(),
          };
          projects = projects.map((old) => (old.id === scene.id ? scene : old));
          addedModels.set(item.id, object.id);
        } else if (kind === "marker") item.marker = record;
        else {
          item.sourceMind = record;
          item.sourceTargetIndex = record.targetCount === 1 ? 0 : null;
        }
        item.matchKey ||= key;
      }
      const nextMini = { ...set, entries, updatedAt: new Date().toISOString() };
      const selectedEntryId =
        current.activeMiniId === set.id
          ? current.selectedEntryId || firstAdded
          : current.selectedEntryId;
      const next = { ...withSet(current, nextMini), projects, selectedEntryId };
      replaceState(next);
      if (!current.selectedEntryId && selectedEntryId)
        resetSelection(next, selectedEntryId);
      const activeModel = addedModels.get(selectedEntryId);
      if (activeModel && (!selectedId || selectedId === activeModel))
        selectObject(activeModel);
      if (errors.length) notify(errors.join(" "), "error");
      else
        notify(
          `${saved.length} ${saved.length === 1 ? "file" : "files"} added and matched by name.`,
        );
    } catch (error) {
      notify(error.message || "Could not add these files.", "error");
    } finally {
      setBusy("");
    }
  }

  async function prepare(onProgress) {
    const snapshot = stateRef.current;
    const original = getSet(snapshot);
    const before = hasIndividualMindFiles(original)
      ? sourceTrackerSignature(original.entries)
      : JSON.stringify([
          original.sharedTarget?.ref,
          original.entries.map((item) => [item.id, item.targetIndex]),
        ]);
    const prepared = await prepareFlashcardTracker(
      original,
      snapshot.projects,
      onProgress,
    );
    const current = stateRef.current;
    const latest = current.minis.find((item) => item.id === original.id);
    const after =
      latest &&
      (hasIndividualMindFiles(latest)
        ? sourceTrackerSignature(latest.entries)
        : JSON.stringify([
            latest.sharedTarget?.ref,
            latest.entries.map((item) => [item.id, item.targetIndex]),
          ]));
    if (!latest || before !== after)
      throw new Error(
        "Files changed while the tracker was being prepared. Please try again.",
      );
    const indices = new Map(
      prepared.entries.map((item) => [item.id, item.targetIndex]),
    );
    const merged = {
      ...latest,
      sharedTarget: prepared.sharedTarget,
      ...(prepared.trackerSignature
        ? { trackerSignature: prepared.trackerSignature }
        : {}),
      entries: latest.entries.map((item) => ({
        ...item,
        targetIndex: indices.get(item.id),
      })),
      updatedAt: prepared.updatedAt,
    };
    const next = withSet(current, merged);
    if (!persisted(next)) {
      setSaveState("error");
      throw new Error(
        "Could not save the set on this device. Check browser storage before publishing.",
      );
    }
    replaceState(next);
    return { mini: merged, projects: next.projects };
  }
  async function preview() {
    if (problems.length) return notify(problems[0], "error");
    setPreviewProgress("Preparing preview…");
    try {
      const prepared = await prepare(setPreviewProgress);
      window.location.href = draftUrl(prepared.mini);
    } catch (error) {
      notify(error.message || "Could not prepare the preview.", "error");
    } finally {
      setPreviewProgress("");
    }
  }
  async function publish(base, onProgress) {
    const prepared = await prepare(onProgress);
    return createPublication(
      prepared.mini,
      prepared.projects,
      base,
      onProgress,
      { cameraDirect: true },
    );
  }

  return (
    <div className="app-shell flash-studio">
      <header className="app-header flash-header">
        <div className="flash-brand">
          <Logo />
          <span>FLASHCARD STUDIO</span>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          <span className="flash-active-nav">
            <WandSparkles size={16} /> Create
          </span>
        </nav>
        <div className="flash-header-right">
          <span>
            <ShieldCheck size={15} /> Private on this device
          </span>
          <button onClick={startSet} disabled={!!busy || !!previewProgress}>
            <Plus size={15} /> New set
          </button>
        </div>
      </header>
      <section className="project-toolbar flash-toolbar">
        <div className="project-info">
          <div>
            <div className="project-breadcrumb">
              <span>FLASHCARD WORKSPACE</span>
              <ChevronRight size={11} />
              <span>One set · one QR</span>
            </div>
            <div className="project-title-row">
              <input
                aria-label="Flashcard set name"
                value={mini.title}
                maxLength={70}
                onChange={(event) => updateSet({ title: event.target.value })}
                onBlur={() => {
                  if (!mini.title.trim())
                    updateSet({ title: "My flashcard set" });
                }}
              />
              <span className="project-subject">
                <QrCode size={12} /> Shared set
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
          <div
            className={`flash-save-state ${saveState === "error" ? "status-error" : ""}`}
          >
            {saveState === "saving" ? (
              <LoaderCircle size={15} className="spin" />
            ) : saveState === "error" ? (
              <CloudOff size={15} />
            ) : (
              <CheckCheck size={15} />
            )}
            <span>
              {saveState === "saving"
                ? "Saving…"
                : saveState === "error"
                  ? "Storage error"
                  : "Saved locally"}
            </span>
          </div>
          <button
            className="button secondary preview-button"
            onClick={preview}
            disabled={!!busy || !!previewProgress}
          >
            {previewProgress ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <Play size={15} />
            )}
            <span>Preview set</span>
          </button>
          <button
            className="button primary publish-button"
            onClick={() => setDialog("publish")}
            disabled={!!busy || !!previewProgress}
          >
            <QrCode size={16} />
            <span>Publish one QR</span>
            <ArrowUpRight size={14} />
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
        <FlashcardLibrary
          mini={mini}
          projects={state.projects}
          activeEntry={entry}
          selectedId={selectedId}
          cards={cards}
          busy={busy}
          onFiles={uploadFiles}
          onSelectEntry={selectEntry}
          onRemoveEntry={removeEntry}
          onRenameEntry={renameEntry}
          onLegacyIndex={(item, index) =>
            updateEntry(item.id, {
              targetIndex: index,
              requiresLegacyIndex: false,
            })
          }
          onSourceIndex={(item, index) =>
            updateEntry(item.id, { sourceTargetIndex: index })
          }
          onAddCard={addCard}
          onSelectCard={selectCard}
          onAddObject={addObject}
          onSignIn={() => setDialog("signin")}
          onClose={() => setLibraryOpen(false)}
        />
        <main className="workspace flash-workspace">
          <div className="workspace-top">
            <div>
              <span className="workspace-dot" /> 3D SCENE{" "}
              <span className="beta-badge">EDITING ONE CARD AT A TIME</span>
            </div>
            <div className="workspace-view-actions">
              <button
                className="mobile-panel-button"
                onClick={() => {
                  setLibraryOpen(!libraryOpen);
                  setInspectorOpen(false);
                }}
              >
                <Box size={15} /> Library
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
                disabled={!markerImage}
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
                <SlidersHorizontal size={15} /> Edit
              </button>
            </div>
          </div>
          <div className="canvas-area">
            <StudioCanvas
              key={project.id}
              ref={canvas}
              project={project}
              selectedId={selectedId}
              onSelect={selectObject}
              onTransform={(id, patch) => {
                const p = getScene(stateRef.current);
                const safe = validateProject({
                  ...p,
                  objects: p.objects.map((object) =>
                    object.id === id ? { ...object, ...patch } : object,
                  ),
                });
                commit({ objects: safe.objects });
              }}
              onDropAsset={addObject}
              tool={tool}
              grid={grid}
              markerImage={markerImage}
              markerVisible={markerVisible && !!markerImage}
              playing={playing}
              showActions={playing}
              onSoundError={() =>
                notify("This sound could not play. Check the file.", "error")
              }
              cards={cards}
              cardMode="edit"
              onSelectCard={selectCard}
              onMoveCard={(id, position) => updateCard(id, { position })}
              pickMode={pickCardId}
              onPickPoint={(objectId, point) => {
                if (pickCardId)
                  updateCard(pickCardId, { target: { objectId, point } });
                setPickCardId(null);
                setInspectorOpen(true);
              }}
            />
            {pickCardId && (
              <div className="pick-banner" role="status">
                <span>
                  Click the part of the model this box should point to.
                </span>
                <button onClick={() => setPickCardId(null)}>Cancel</button>
              </div>
            )}
            <div className="flash-canvas-title">
              <span className="eyebrow">
                {entry ? "CURRENTLY EDITING" : "YOUR FLASHCARD WORKSPACE"}
              </span>
              <h2>
                {entry ? entry.title : "Create your first card"}
                <span> ✦</span>
              </h2>
              <p>
                {entry
                  ? "Changes here belong only to this card."
                  : "Upload matching GLB, marker and .mind files to get started."}
              </p>
            </div>
            {entry && (
              <div className="flash-marker-widget">
                <span className="flash-marker-art">
                  {markerImage ? (
                    <img src={markerImage} alt="Selected tracking marker" />
                  ) : (
                    <ScanLine size={19} />
                  )}
                </span>
                <span>
                  <small>TRACKING MARKER</small>
                  <strong>{entry.marker?.name || "No image yet"}</strong>
                  <em>
                    {entry.sourceMind?.name ||
                      (mini.sharedTarget
                        ? "Existing combined target"
                        : "Upload matching .mind")}
                  </em>
                </span>
              </div>
            )}
            <span className="canvas-object-count">
              <Box size={12} /> {project.objects.length}{" "}
              {project.objects.length === 1 ? "object" : "objects"} ·{" "}
              {cards.length} boxes
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
              ].map((item) => (
                <button
                  key={item.id}
                  className={tool === item.id ? "active" : ""}
                  onClick={() => {
                    setTool(item.id);
                    setPlaying(false);
                  }}
                  title={item.label}
                  aria-label={`${item.label} tool`}
                >
                  <item.icon size={17} />
                  <span>{item.label}</span>
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
        <aside className="inspector-panel flash-inspector">
          <div className="inspector-heading">
            <h2>
              Scene details <span>✧</span>
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
              <SlidersHorizontal size={14} /> Properties
            </button>
            <button
              className={inspectorTab === "scene" ? "active" : ""}
              onClick={() => setInspectorTab("scene")}
            >
              <Layers size={14} /> Scene{" "}
              <span>{project.objects.length + cards.length}</span>
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
                  onSignIn={() => setDialog("signin")}
                  notify={notify}
                />
              ) : selected ? (
                <ObjectProperties
                  object={selected}
                  update={(patch) => updateObject(selected.id, patch)}
                  onDelete={() => deleteSelection()}
                  onDuplicate={duplicateObject}
                  onTestAction={(action) => {
                    const result = canvas.current?.playAction(
                      selected.id,
                      action,
                    );
                    if (result === "loop")
                      notify("Playing on repeat. Tap play again to stop.");
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
                  <h3>Select an object</h3>
                  <p>Choose a model or lesson box to edit its properties.</p>
                  <button
                    className="button secondary full"
                    onClick={() => setInspectorTab("scene")}
                  >
                    <Layers size={15} /> See scene objects
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
                onDelete={deleteSelection}
              />
            )}
          </div>
          <div className="inspector-footer">
            <span className="tip-icon">
              <Sparkles size={18} />
            </span>
            <div>
              <strong>Per-card editing</strong>
              <p>Each model keeps its own objects, text, media and settings.</p>
            </div>
          </div>
        </aside>
      </div>
      <footer className="status-bar flash-status">
        <span className={saveState === "error" ? "status-error" : ""}>
          <span className="status-dot" />
          {saveState === "error"
            ? "Storage unavailable — changes may not be saved"
            : "Your files and edits are saved on this device"}
        </span>
        <span>
          <ShieldCheck size={12} /> Publish the ZIP to share on another device
        </span>
        {state.minis.filter((item) => item.mode === "shared").length > 1 && (
          <label>
            Current set{" "}
            <select
              aria-label="Active flashcard set"
              value={mini.id}
              onChange={(event) => switchSet(event.target.value)}
              disabled={!!busy || !!previewProgress}
            >
              {state.minis
                .filter((item) => item.mode === "shared")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
            </select>
          </label>
        )}
      </footer>
      {dialog === "publish" && (
        <FlashcardPublish
          mini={mini}
          projects={state.projects}
          onClose={() => setDialog("")}
          onPublish={publish}
        />
      )}
      {dialog === "signin" && (
        <TeacherSignIn onClose={() => setDialog("")} notify={notify} />
      )}
      {toast && (
        <div
          className={`toast ${toast.kind === "error" ? "error" : ""}`}
          role={toast.kind === "error" ? "alert" : "status"}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
