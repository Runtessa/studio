export type TaskExpectations = {
  mode: "read-only" | "mutate";
  autonomous: boolean;
  backend: boolean;
  models: boolean;
  ui: boolean;
  acl: boolean;
  shared: boolean;
  preview: boolean;
  reasons: string[];
};

const surfaces = {
  backend: /\b(apis?|endpoints?|routes?|backend|handlers?|modules?|server)\b/i,
  models:
    /\b(models?|entities?|databases?|tables?|schemas?|orm|repositories|repository|typeorm)\b/i,
  ui: /\b(ui|ux|pages?|screens?|dashboard|components?|forms?|layout|frontend|preview|styles?|tailwind)\b/i,
  acl: /\b(acl|permissions?|roles?|access|authorize|authorization)\b/i,
  shared: /\b(shared|packages?|library|libraries)\b/i,
};
const mutation =
  /\b(fix|implement|create|update|edit|change|patch|refactor|remove|delete|build|develop|add|write|save|modify|improve|migrate)\b|(?:اصلاح|بساز|تغییر بده|اضافه کن|ویرایش کن)/i;
const inspection =
  /\b(review|audit|analyze|analyse|explain|describe|blueprint|document|summari[sz]e|inspect|test|verify|check)\b|(?:بررسی کن|توضیح بده|تست کن)/i;
const protectedClause =
  /\b(do not|don't|never|preserve|retain)\b|\b(?:keep|leave)\b.*\b(unchanged|untouched|intact|unmodified|as.is)\b|(?:دست نزن|تغییر نده|حفظ کن)/i;

// Mentioning a surface in a preservation rule is not a request to mutate it.
export function inferTaskExpectations(
  objective: string,
  activeFilePath: string,
): TaskExpectations {
  const prompt = String(objective || "");
  const clauses = prompt
    .split(/\n|;|[.!?](?=\s|$)|\b(?:but|while)\b/)
    .map((value) => value.trim())
    .filter(Boolean);
  const protectedText = clauses
    .filter((value) => protectedClause.test(value))
    .join("\n");
  const requestedText = clauses
    .filter((value) => !protectedClause.test(value))
    .join("\n");
  const readOnly =
    /\bread[ -]only\b|فقط بررسی|فقط بخوان/i.test(prompt) ||
    (inspection.test(requestedText) && !mutation.test(requestedText));
  const scopeText = clauses
    .filter(
      (value) =>
        !protectedClause.test(value) &&
        (!mutation.test(requestedText) ||
          !inspection.test(value) ||
          mutation.test(value)),
    )
    .join("\n");
  const named = Object.fromEntries(
    Object.entries(surfaces).map(([key, pattern]) => [
      key,
      pattern.test(scopeText),
    ]),
  ) as Record<keyof typeof surfaces, boolean>;
  const hasNamedSurface = Object.values(named).some(Boolean);
  const path = String(activeFilePath || "").toLowerCase();
  const fallback = !hasNamedSurface && !readOnly;
  const infer = (key: keyof typeof surfaces, matchesPath: boolean) =>
    named[key] ||
    (fallback && matchesPath && !surfaces[key].test(protectedText));
  const backend = infer(
    "backend",
    (path.startsWith("modules/") && !path.startsWith("modules/acl/")) ||
      path.startsWith("shared-modules/"),
  );
  const models = infer("models", path.startsWith("models/"));
  const ui = infer(
    "ui",
    path.startsWith("ui/") || path.startsWith("shared-ui/"),
  );
  // Editing handler logic or a shared backend library does not imply ACL changes.
  const acl = infer("acl", path.startsWith("modules/acl/"));
  const shared = infer("shared", path.startsWith("shared-"));
  const reasons = Object.entries({ backend, models, ui, acl, shared })
    .filter(([, required]) => required)
    .map(([surface]) => `request targets ${surface} changes`);
  if (readOnly) reasons.push("request is read-only by intent");
  const autonomous = !readOnly && !hasNamedSurface;
  if (autonomous)
    reasons.push(
      "request uses the active file or autonomous surface selection",
    );
  const preview =
    /\b(preview|runtime error|exception|console error|browser error)\b/i.test(
      requestedText,
    );
  return {
    mode: readOnly ? "read-only" : "mutate",
    autonomous,
    backend,
    models,
    ui,
    acl,
    shared,
    preview,
    reasons,
  };
}
