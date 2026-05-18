import { describe, expect, it } from "vitest";
import { CliError } from "../../src/errors.js";
import { parseAndValidatePattern, parseFlatYaml } from "../../src/patterns/schema.js";

const VALID = `---
name: pr-explainer
description: Explain a PR
triggers:
  - explain this pr
  - summarize this diff
brand_sensing: true
---

# PR explainer

## When to use

When the human asks…
`;

describe("parseFlatYaml", () => {
  it("parses scalars + booleans + quoted strings", () => {
    const fm = parseFlatYaml(
      [
        "name: pr-explainer",
        'description: "Quoted value"',
        "brand_sensing: true",
        "another: false",
      ].join("\n")
    );
    expect(fm).toEqual({
      name: "pr-explainer",
      description: "Quoted value",
      brand_sensing: true,
      another: false,
    });
  });

  it("parses a list under a key with empty value", () => {
    const fm = parseFlatYaml(
      [
        "triggers:",
        "  - one",
        "  - two",
        "  - 'three with spaces'",
      ].join("\n")
    );
    expect(fm).toEqual({ triggers: ["one", "two", "three with spaces"] });
  });

  it("skips trailing comments after whitespace", () => {
    const fm = parseFlatYaml("name: pr-explainer  # comment\n");
    expect(fm).toEqual({ name: "pr-explainer" });
  });

  it("errors on garbage lines", () => {
    expect(() => parseFlatYaml("this is not yaml")).toThrow(CliError);
  });
});

describe("parseAndValidatePattern", () => {
  it("accepts a well-formed pattern", () => {
    const p = parseAndValidatePattern(VALID);
    expect(p.frontmatter.name).toBe("pr-explainer");
    expect(p.frontmatter.triggers).toEqual([
      "explain this pr",
      "summarize this diff",
    ]);
    expect(p.frontmatter.brand_sensing).toBe(true);
    expect(p.frontmatter.description).toBe("Explain a PR");
    expect(p.body).toMatch(/^\n# PR explainer/);
  });

  it("defaults brand_sensing to true when absent", () => {
    const minimal = `---
name: x
triggers:
  - a
---

## Heading
body
`;
    expect(parseAndValidatePattern(minimal).frontmatter.brand_sensing).toBe(true);
  });

  it("rejects missing frontmatter", () => {
    expect(() => parseAndValidatePattern("# Just a heading\n## sub\n")).toThrow(CliError);
  });

  it("rejects malformed (no closing fence)", () => {
    expect(() => parseAndValidatePattern("---\nname: x\n\nbody\n")).toThrow(CliError);
  });

  it("rejects missing name", () => {
    const bad = `---
triggers:
  - go
---

## hi
body
`;
    expect(() => parseAndValidatePattern(bad)).toThrow(CliError);
  });

  it("rejects non-kebab-case name", () => {
    const bad = `---
name: PRExplainer
triggers:
  - go
---

## hi
body
`;
    expect(() => parseAndValidatePattern(bad)).toThrow(CliError);
  });

  it("rejects empty triggers list", () => {
    const bad = `---
name: x
triggers:
---

## hi
body
`;
    expect(() => parseAndValidatePattern(bad)).toThrow(CliError);
  });

  it("rejects body with no ## heading", () => {
    const bad = `---
name: x
triggers:
  - go
---

# Just an h1, no h2.
`;
    expect(() => parseAndValidatePattern(bad)).toThrow(CliError);
  });

  it("rejects mismatched expected name", () => {
    expect(() => parseAndValidatePattern(VALID, "summary-roundup")).toThrow(CliError);
  });
});
