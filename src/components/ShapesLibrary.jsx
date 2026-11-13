import React, { useMemo, useState } from "react";
import { Plus, Search, Shapes, Sparkles, Trash2, X } from "lucide-react";
import AssetImage from "./AssetImage";
import { EmptyState } from "./UI";
import { SHAPES, SHAPE_CATEGORIES } from "../lib/shapes";
import {
  GROUPS_KEY,
  MAX_GROUPS,
  loadGroups,
  validateGroups,
} from "../lib/custom-groups";
import { localRecord } from "../lib/local-files";

export default function ShapesLibrary({
  onAdd,
  uploadedModels = [],
  disabled = false,
  count = 0,
}) {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState(loadGroups);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const group = groups.find((g) => g.id === category);

  function save(next) {
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
      setGroups(next);
      setError("");
      return true;
    } catch {
      setError(
        "Could not save groups in this browser. Check storage permissions or free up space.",
      );
      return false;
    }
  }
  function createGroup(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 30) {
      setError("Enter a group name (up to 30 characters).");
      return;
    }
    if (
      ["All", ...SHAPE_CATEGORIES, ...groups.map((g) => g.name)].some(
        (n) => n.toLocaleLowerCase() === trimmed.toLocaleLowerCase(),
      )
    ) {
      setError("A group with that name already exists.");
      return;
    }
    if (groups.length >= MAX_GROUPS) {
      setError(`You can create up to ${MAX_GROUPS} groups.`);
      return;
    }
    const next = { id: crypto.randomUUID(), name: trimmed, models: [] };
    if (save([...groups, next])) {
      setCategory(next.id);
      setName("");
      setCreating(false);
      setEditing(true);
      setSearch("");
    }
  }
  function toggleModel(model) {
    if (!group) return;
    const exists = group.models.some((m) => m.id === model.id);
    if (!exists && group.models.length >= 100) {
      setError("A group can contain up to 100 models.");
      return;
    }
    const updated = groups.map((g) =>
      g.id !== group.id
        ? g
        : {
            ...g,
            models: exists
              ? g.models.filter((m) => m.id !== model.id)
              : [...g.models, model],
          },
    );
    save(validateGroups(updated));
  }
  function deleteGroup() {
    if (
      !group ||
      !window.confirm(
        `Delete the group “${group.name}”? Uploaded models and scenes will not be deleted.`,
      )
    )
      return;
    if (save(groups.filter((g) => g.id !== group.id))) {
      setCategory("All");
      setEditing(false);
    }
  }

  const items = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    const shapes =
      category === "All"
        ? SHAPES
        : group
          ? []
          : SHAPES.filter((shape) => shape.category === category);
    const models =
      category === "All"
        ? [
            ...new Map(
              groups.flatMap((g) => g.models).map((m) => [m.id, m]),
            ).values(),
          ]
        : group?.models || [];
    return [
      ...shapes.map((shape) => ({ ...shape, type: "shape" })),
      ...models.map((model) => ({
        id: `model:${model.id}`,
        name: model.name,
        category: "GLB model",
        bg: "#edf4ef",
        type: "model",
        model,
      })),
    ].filter(
      (item) =>
        !needle ||
        `${item.name} ${item.category}`.toLocaleLowerCase().includes(needle),
    );
  }, [category, search, group, groups]);

  return (
    <div className="library-scroll shapes-library">
      <div className="shapes-intro">
        <Sparkles size={14} />
        <span>Tap an object to add it to the current scene.</span>
      </div>
      <label className="search-field shapes-search">
        <Search size={16} />
        <input
          aria-label="Search ready-made shapes"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find an object…"
        />
        {search && (
          <button
            type="button"
            aria-label="Clear shape search"
            onClick={() => setSearch("")}
          >
            <X size={13} />
          </button>
        )}
      </label>
      <div className="category-tabs shapes-categories">
        {["All", ...SHAPE_CATEGORIES].map((label) => (
          <button
            key={label}
            type="button"
            className={category === label ? "active" : ""}
            onClick={() => {
              setCategory(label);
              setEditing(false);
            }}
          >
            {label}
          </button>
        ))}
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            className={category === g.id ? "active" : ""}
            onClick={() => {
              setCategory(g.id);
              setEditing(false);
            }}
          >
            {g.name}
          </button>
        ))}
        <button
          type="button"
          className="group-create-button"
          onClick={() => {
            setCreating(!creating);
            setError("");
          }}
        >
          <Plus size={12} /> New group
        </button>
      </div>
      {creating && (
        <form className="group-create-form" onSubmit={createGroup}>
          <label htmlFor="group-name">New group name</label>
          <div>
            <input
              id="group-name"
              autoFocus
              maxLength={30}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Animals"
            />
            <button type="submit">Create</button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setError("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="group-error" role="alert">
          {error}
        </p>
      )}
      {group && (
        <div className="group-toolbar">
          <button type="button" onClick={() => setEditing(!editing)}>
            <Plus size={13} /> {editing ? "Done" : "Manage models"}
          </button>
          <button
            type="button"
            onClick={deleteGroup}
            aria-label={`Delete group ${group.name}`}
          >
            <Trash2 size={13} /> Delete group
          </button>
        </div>
      )}
      {group && editing && (
        <div className="group-model-picker">
          <strong>Add uploaded GLB models</strong>
          <p>
            Choose models from the Objects tab. Check or uncheck to manage this
            group.
          </p>
          {uploadedModels.length ? (
            uploadedModels.map((model) => (
              <label key={model.id}>
                <input
                  type="checkbox"
                  checked={group.models.some((m) => m.id === model.id)}
                  onChange={() => toggleModel(model)}
                />{" "}
                <span>{model.name}</span>
              </label>
            ))
          ) : (
            <p>
              No uploaded GLB models yet. Upload one in the Objects tab first.
            </p>
          )}
          {group.models
            .filter((m) => !uploadedModels.some((u) => u.id === m.id))
            .map((model) => (
              <label key={model.id}>
                <input
                  type="checkbox"
                  checked
                  onChange={() => toggleModel(model)}
                />
                <span>{model.name} (not in Objects)</span>
              </label>
            ))}
        </div>
      )}
      <div className="library-section-label">
        <span>{group ? group.name : "READY-MADE 3D OBJECTS"}</span>
        <span>
          {items.length} {items.length === 1 ? "object" : "objects"}
        </span>
      </div>
      {items.length ? (
        <div className="asset-grid">
          {items.map((item) => {
            const missing = item.model && !localRecord(item.model.file);
            return (
              <button
                key={item.id}
                type="button"
                className="asset-card shape-card"
                disabled={disabled || missing}
                onClick={() => onAdd(item.id, item.model)}
                aria-label={`Add ${item.name} to the scene`}
                title={
                  missing
                    ? "Local model file is missing; upload it again."
                    : `Add ${item.name}`
                }
              >
                <span className="asset-art" style={{ background: item.bg }}>
                  <AssetImage
                    assetId={item.id}
                    model={item.model}
                    alt=""
                    draggable={false}
                  />
                  <span className="asset-add">
                    <Plus size={12} />
                  </span>
                </span>
                <span className="asset-card-copy">
                  <strong>{item.name}</strong>
                  <span>
                    {missing ? "File missing — upload again" : item.category}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Shapes}
          title={group && !search ? "This group is empty" : "No object found"}
        >
          {group && !search
            ? "Choose Manage models to add uploaded GLBs."
            : "Try another word, or pick a different category."}
        </EmptyState>
      )}
      <div className="library-bottom-note">
        <Sparkles size={15} />
        <span>
          {count > 0
            ? `${count} object${count === 1 ? "" : "s"} in this scene.`
            : "Objects can be moved, resized and animated."}
          <br />
          Custom groups and uploads are saved in this browser on this device.
        </span>
      </div>
    </div>
  );
}
