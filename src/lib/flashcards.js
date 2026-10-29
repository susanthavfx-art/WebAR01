import { loadProjects, newProject, STORAGE_KEY } from "./projects";
import {
  loadMiniProjects,
  miniProblems,
  newMiniProject,
  sceneForEntry,
} from "./mini-projects";
import {
  combineCardMindTargets,
  isLocalReference,
  localModelId,
  localRecord,
} from "./local-files";

export const FLASH_ACTIVE_KEY = "wonderlab.flashcards.active.v1";

// A filename is a stable identity even when the display name is later edited.
// Case, surrounding spaces and Unicode representation do not affect matching.
export function filenameStem(name) {
  return String(name || "")
    .replace(/\.(glb|mind|jpe?g|png|webp)$/i, "")
    .trim()
    .normalize("NFKC");
}
export function filenameKey(name) {
  return filenameStem(name).toLocaleLowerCase("en-US");
}
export function entryFileKey(entry) {
  return filenameKey(
    entry.matchKey || entry.marker?.name || entry.model?.name || entry.title,
  );
}
export function sourceTrackerSignature(entries) {
  return JSON.stringify(
    entries.map((entry) => [
      entry.id,
      entry.sourceMind?.id || "",
      entry.sourceTargetIndex ?? null,
    ]),
  );
}

// Existing shared mini projects and all their scenes are preserved. Only the
// active set is shown in the new editor; other sets can be reopened later.
export function bootstrapFlashcards() {
  let hasProjects = false;
  let rememberedId = "";
  try {
    hasProjects = localStorage.getItem(STORAGE_KEY) !== null;
    rememberedId = localStorage.getItem(FLASH_ACTIVE_KEY) || "";
  } catch {
    // Storage errors are reported by the save indicator in the workspace.
  }
  const projects = hasProjects ? loadProjects() : [];
  let minis = loadMiniProjects();
  const shared = minis.filter((mini) => mini.mode === "shared");
  let mini =
    shared.find((item) => item.id === rememberedId) ||
    [...shared].sort(
      (a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0),
    )[0];
  if (!mini) {
    mini = newMiniProject("My flashcard set", "shared");
    // Existing individual-card projects stay intact even if the old dashboard
    // had already reached its creation limit.
    minis = [mini, ...minis];
  }
  const first = mini.entries.find((entry) => sceneForEntry(entry, projects));
  return {
    projects,
    minis,
    activeMiniId: mini.id,
    selectedEntryId: first?.id || null,
    scratch: newProject("blank"),
  };
}

export function hasIndividualMindFiles(mini) {
  return mini.entries.some((entry) => !!entry.sourceMind);
}
export function flashcardProblems(mini, projects) {
  if (!mini?.entries?.length) return ["Upload at least one card's files."];
  if (!hasIndividualMindFiles(mini) && mini.sharedTarget) {
    const issues = miniProblems(mini, projects);
    for (const entry of mini.entries) {
      if (entry.requiresLegacyIndex)
        issues.push(
          `${entry.title}: choose its existing combined target index or upload matching .mind files for the whole set.`,
        );
    }
    return [...new Set(issues)];
  }
  const issues = [];
  for (const entry of mini.entries) {
    const scene = sceneForEntry(entry, projects);
    if (!scene) {
      issues.push(`${entry.title}: the editing scene is missing.`);
      continue;
    }
    if (!entry.marker || !localRecord(entry.marker.ref))
      issues.push(`${entry.title}: upload the matching marker image.`);
    if (!scene.objects.length)
      issues.push(`${entry.title}: upload a GLB model or add an object.`);
    const target = entry.sourceMind && localRecord(entry.sourceMind.ref);
    if (!target || target.kind !== "target")
      issues.push(`${entry.title}: upload its matching .mind file.`);
    else if (
      !Number.isInteger(entry.sourceTargetIndex) ||
      entry.sourceTargetIndex < 0 ||
      entry.sourceTargetIndex >= target.targetCount
    )
      issues.push(
        `${entry.title}: choose the matching target inside its .mind file.`,
      );
    for (const object of scene.objects) {
      if (localModelId(object.model?.file) && !localRecord(object.model.file))
        issues.push(
          `${entry.title}: an uploaded model is missing on this device.`,
        );
      for (const action of object.actions || [])
        if (
          isLocalReference(action.sound?.url) &&
          !localRecord(action.sound.url)
        )
          issues.push(
            `${entry.title}: an uploaded sound is missing on this device.`,
          );
    }
    for (const box of scene.cards || [])
      if (isLocalReference(box.media?.url) && !localRecord(box.media.url))
        issues.push(
          `${entry.title}: an uploaded media file is missing on this device.`,
        );
  }
  return [...new Set(issues)];
}

export async function prepareFlashcardTracker(
  mini,
  projects,
  onProgress = () => {},
) {
  const issues = flashcardProblems(mini, projects);
  if (issues.length) throw new Error(issues[0]);
  // Older sets may already have a manually combined target. Keep their exact
  // indices rather than guessing or changing the user's existing work.
  if (!hasIndividualMindFiles(mini) && mini.sharedTarget) return mini;
  const signature = sourceTrackerSignature(mini.entries);
  if (
    mini.trackerSignature === signature &&
    mini.sharedTarget &&
    localRecord(mini.sharedTarget.ref)
  )
    return mini;
  const sharedTarget = await combineCardMindTargets(mini.entries, onProgress);
  return {
    ...mini,
    sharedTarget,
    trackerSignature: signature,
    entries: mini.entries.map((entry, index) => ({
      ...entry,
      targetIndex: index,
    })),
    updatedAt: new Date().toISOString(),
  };
}
