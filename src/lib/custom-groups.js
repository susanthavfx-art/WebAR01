export const GROUPS_KEY = "wonderlab.custom-shape-groups.v1";
export const MAX_GROUPS = 30;

export function validateGroups(input) {
  if (!Array.isArray(input)) return [];
  const names = new Set(["all", "basics", "nature", "space", "fun"]);
  const ids = new Set();
  return input.slice(0, MAX_GROUPS).flatMap((group) => {
    if (
      !group ||
      typeof group.id !== "string" ||
      !/^[a-z0-9-]{1,80}$/i.test(group.id) ||
      ids.has(group.id) ||
      typeof group.name !== "string"
    )
      return [];
    const name = group.name.trim().slice(0, 30);
    const nameKey = name.toLocaleLowerCase();
    if (!name || names.has(nameKey)) return [];
    ids.add(group.id);
    names.add(nameKey);
    const models = Array.isArray(group.models)
      ? group.models
          .filter(
            (model) =>
              model &&
              typeof model.id === "string" &&
              /^upload-[a-f0-9-]+$/i.test(model.id) &&
              model.file === `uploads/${model.id.slice(7)}.glb` &&
              typeof model.name === "string",
          )
          .slice(0, 100)
          .map((model) => ({
            id: model.id,
            file: model.file,
            name: model.name.slice(0, 45),
            category: "GLB Model",
            height: 1.5,
            rotation: [0, 0, 0],
            animate: true,
          }))
      : [];
    return [
      {
        id: group.id,
        name,
        models: [...new Map(models.map((model) => [model.id, model])).values()],
      },
    ];
  });
}

export function loadGroups() {
  try {
    return validateGroups(JSON.parse(localStorage.getItem(GROUPS_KEY) || "[]"));
  } catch {
    return [];
  }
}
