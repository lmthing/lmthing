import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { corsHeaders } from "./cors.ts";

Deno.test("corsHeaders includes required headers", () => {
  assertEquals(corsHeaders["Access-Control-Allow-Origin"], "*");
  assertEquals(typeof corsHeaders["Access-Control-Allow-Headers"], "string");
  assertEquals(typeof corsHeaders["Access-Control-Allow-Methods"], "string");
});

Deno.test("corsHeaders allows authorization header", () => {
  const allowed = corsHeaders["Access-Control-Allow-Headers"];
  assertEquals(allowed.includes("authorization"), true);
  assertEquals(allowed.includes("content-type"), true);
});

Deno.test("corsHeaders allows POST, GET, DELETE, OPTIONS", () => {
  const methods = corsHeaders["Access-Control-Allow-Methods"];
  assertEquals(methods.includes("POST"), true);
  assertEquals(methods.includes("GET"), true);
  assertEquals(methods.includes("DELETE"), true);
  assertEquals(methods.includes("OPTIONS"), true);
});
