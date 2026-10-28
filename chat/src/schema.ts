import type { JsonObject, McpTool, OpenAiToolDefinition } from "./types.js";

const UNSUPPORTED_SCHEMA_FIELDS = new Set([
  "$schema",
  "$id",
  "$anchor",
  "$dynamicAnchor",
  "$dynamicRef",
  "contentEncoding",
  "contentMediaType",
  "contentSchema",
  "deprecated",
  "examples",
  "readOnly",
  "unevaluatedItems",
  "unevaluatedProperties",
  "writeOnly",
]);

const SCHEMA_MAP_FIELDS = new Set([
  "$defs",
  "definitions",
  "dependentSchemas",
  "patternProperties",
  "properties",
]);

function cleanSchemaMap(value: unknown): unknown {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    return cleanJsonSchema(value);
  }
  return Object.fromEntries(
    Object.entries(value as JsonObject).map(([name, schema]) => [
      name,
      cleanJsonSchema(schema),
    ]),
  );
}

export function cleanJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cleanJsonSchema);
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as JsonObject)
      .filter(([key]) => !UNSUPPORTED_SCHEMA_FIELDS.has(key))
      .map(([key, child]) => [
        key,
        SCHEMA_MAP_FIELDS.has(key)
          ? cleanSchemaMap(child)
          : cleanJsonSchema(child),
      ]),
  );
}

export function toOpenAiTools(tools: McpTool[]): OpenAiToolDefinition[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description ?? "",
      parameters: (cleanJsonSchema(
        tool.inputSchema ?? { type: "object", properties: {} },
      ) ?? { type: "object", properties: {} }) as JsonObject,
    },
  }));
}
