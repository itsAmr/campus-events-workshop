import { describe, expect, it } from "vitest";

import { cleanJsonSchema, toOpenAiTools } from "../src/schema.js";

describe("cleanJsonSchema", () => {
  it("recursively removes provider-unsupported schema fields", () => {
    const cleaned = cleanJsonSchema({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        examples: {
          type: "string",
        },
        when: {
          type: "string",
          examples: ["today"],
          items: {
            $id: "nested",
            type: "string",
          },
        },
      },
      allOf: [
        {
          unevaluatedProperties: false,
          type: "object",
        },
      ],
    });

    expect(cleaned).toEqual({
      type: "object",
      properties: {
        examples: {
          type: "string",
        },
        when: {
          type: "string",
          items: {
            type: "string",
          },
        },
      },
      allOf: [{ type: "object" }],
    });
  });

  it("converts MCP tools to Chat Completions functions", () => {
    expect(
      toOpenAiTools([
        {
          name: "lookup",
          description: "Find a record",
          inputSchema: {
            $schema: "ignored",
            type: "object",
            properties: { id: { type: "string" } },
          },
        },
      ]),
    ).toEqual([
      {
        type: "function",
        function: {
          name: "lookup",
          description: "Find a record",
          parameters: {
            type: "object",
            properties: { id: { type: "string" } },
          },
        },
      },
    ]);
  });
});
