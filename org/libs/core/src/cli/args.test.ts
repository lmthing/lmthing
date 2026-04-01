import { describe, it, expect } from "vitest";
import { parseArgs } from "./args";

describe("cli/args", () => {
  it("parses file path", () => {
    const args = parseArgs(["tools.ts"]);
    expect(args.file).toBe("tools.ts");
  });

  it("parses port", () => {
    const args = parseArgs(["tools.ts", "--port", "4000"]);
    expect(args.port).toBe(4000);
  });

  it("parses short port flag", () => {
    const args = parseArgs(["tools.ts", "-p", "4000"]);
    expect(args.port).toBe(4000);
  });

  it("parses instruct flags", () => {
    const args = parseArgs([
      "tools.ts",
      "--instruct",
      "Be concise.",
      "--instruct",
      "Use TypeScript.",
    ]);
    expect(args.instruct).toEqual(["Be concise.", "Use TypeScript."]);
  });

  it("parses catalog", () => {
    const args = parseArgs(["--catalog", "fs,fetch,json"]);
    expect(args.catalog).toBe("fs,fetch,json");
    expect(args.file).toBeUndefined();
  });

  it('parses catalog "all"', () => {
    const args = parseArgs(["tools.ts", "--catalog", "all"]);
    expect(args.catalog).toBe("all");
  });

  it("parses model", () => {
    const args = parseArgs(["tools.ts", "--model", "anthropic/claude-sonnet-4-20250514"]);
    expect(args.model).toBe("anthropic/claude-sonnet-4-20250514");
  });

  it("parses timeout", () => {
    const args = parseArgs(["tools.ts", "--timeout", "300"]);
    expect(args.timeout).toBe(300);
  });

  it("has default port", () => {
    const args = parseArgs(["tools.ts"]);
    expect(args.port).toBe(3010);
  });

  it("has default timeout", () => {
    const args = parseArgs(["tools.ts"]);
    expect(args.timeout).toBe(600);
  });

  it("throws without file or catalog", () => {
    expect(() => parseArgs([])).toThrow("Either a file path");
  });

  it("accepts catalog without file", () => {
    const args = parseArgs(["--catalog", "all"]);
    expect(args.file).toBeUndefined();
    expect(args.catalog).toBe("all");
  });

  it("defaults command to run", () => {
    const args = parseArgs(["tools.ts"]);
    expect(args.command).toBe("run");
  });
});

describe("cli/args — test subcommand", () => {
  it("sets command to test", () => {
    const args = parseArgs(["test", "--space", "./my-space"]);
    expect(args.command).toBe("test");
  });

  it("parses space path", () => {
    const args = parseArgs(["test", "--space", "./my-space"]);
    expect(args.spaces).toEqual(["./my-space"]);
  });

  it("parses multiple spaces", () => {
    const args = parseArgs(["test", "--space", "./a", "--space", "./b"]);
    expect(args.spaces).toEqual(["./a", "./b"]);
  });

  it("parses --model alongside test", () => {
    const args = parseArgs(["test", "--space", "./my-space", "--model", "small"]);
    expect(args.model).toBe("small");
  });

  it("parses --pattern", () => {
    const args = parseArgs(["test", "--space", "./my-space", "--pattern", "**/*.test.ts"]);
    expect(args.testPattern).toBe("**/*.test.ts");
  });

  it("throws when no --space given to test", () => {
    expect(() => parseArgs(["test"])).toThrow("lmthing test requires at least one --space");
  });

  it("does not require --model for test", () => {
    const args = parseArgs(["test", "--space", "./my-space"]);
    expect(args.model).toBeUndefined();
  });
});
