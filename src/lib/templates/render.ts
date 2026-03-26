/**
 * Extract variable names from template content.
 * Variables use {{variableName}} syntax.
 */
export function extractVariables(content: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    variables.add(match[1]);
  }
  return Array.from(variables);
}

/**
 * Render a template by substituting variables.
 */
export function renderTemplate(
  content: string,
  variables: Record<string, string>
): string {
  return content.replace(
    /\{\{(\w+)\}\}/g,
    (_, name) => variables[name] ?? `{{${name}}}`
  );
}

/**
 * Built-in variables that are automatically available.
 */
export const BUILTIN_VARIABLES: Record<string, () => string> = {
  date: () => new Date().toLocaleDateString("ja-JP"),
  time: () =>
    new Date().toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  year: () => String(new Date().getFullYear()),
  month: () => String(new Date().getMonth() + 1),
  day: () => String(new Date().getDate()),
  weekday: () =>
    ["日", "月", "火", "水", "木", "金", "土"][new Date().getDay()],
};

/**
 * Get all built-in variable values resolved for the current time.
 */
export function getBuiltinVariableValues(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, fn] of Object.entries(BUILTIN_VARIABLES)) {
    result[key] = fn();
  }
  return result;
}
