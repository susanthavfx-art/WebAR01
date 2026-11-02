import React, { useMemo, useState } from "react";
import { Plus, Search, Shapes, Sparkles, X } from "lucide-react";
import AssetImage from "./AssetImage";
import { EmptyState } from "./UI";
import { SHAPES, SHAPE_CATEGORIES } from "../lib/shapes";

/**
 * Assemblr-style ready-made object gallery. Tapping a card adds that shape to
 * the scene being edited — no GLB upload and no marker re-export needed.
 */
export default function ShapesLibrary({ onAdd, disabled = false, count = 0 }) {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  const shapes = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return SHAPES.filter((shape) => {
      const inCategory = category === "All" || shape.category === category;
      const inSearch =
        !needle ||
        `${shape.name} ${shape.category}`.toLocaleLowerCase().includes(needle);
      return inCategory && inSearch;
    });
  }, [category, search]);

  return (
    <div className="library-scroll shapes-library">
      <div className="shapes-intro">
        <Sparkles size={14} />
        <span>
          Tap a shape to drop it onto the model. Combine a few to build a whole
          little world on one marker.
        </span>
      </div>

      <label className="search-field shapes-search">
        <Search size={16} />
        <input
          aria-label="Search ready-made shapes"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a shape…"
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
        {["All", ...SHAPE_CATEGORIES].map((name) => (
          <button
            key={name}
            type="button"
            className={category === name ? "active" : ""}
            onClick={() => setCategory(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="library-section-label">
        <span>READY-MADE 3D OBJECTS</span>
        <span>
          {shapes.length} {shapes.length === 1 ? "shape" : "shapes"}
        </span>
      </div>

      {shapes.length ? (
        <div className="asset-grid">
          {shapes.map((shape) => (
            <button
              key={shape.id}
              type="button"
              className="asset-card shape-card"
              disabled={disabled}
              onClick={() => onAdd(shape.id)}
              aria-label={`Add ${shape.name} to the scene`}
              title={`Add ${shape.name}`}
            >
              <span className="asset-art" style={{ background: shape.bg }}>
                <AssetImage assetId={shape.id} alt="" draggable={false} />
                <span className="asset-add">
                  <Plus size={12} />
                </span>
              </span>
              <span className="asset-card-copy">
                <strong>{shape.name}</strong>
                <span>{shape.category}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState icon={Shapes} title="No shape found">
          Try another word, or pick a different category.
        </EmptyState>
      )}

      <div className="library-bottom-note">
        <Sparkles size={15} />
        <span>
          {count > 0
            ? `${count} object${count === 1 ? "" : "s"} in this scene.`
            : "Shapes can be moved, resized, recoloured and animated."}
          <br />
          Upload a marker + .mind in the Markers tab to make it AR.
        </span>
      </div>
    </div>
  );
}
