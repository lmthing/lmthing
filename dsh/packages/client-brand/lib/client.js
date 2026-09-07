window.__ModuleLoader__.load({
  id: "@lmthing/dsh-client-brand",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
    
    // src/client.jsx
    var client_exports = {};
    __export(client_exports, {
      apply: () => apply,
      inject: () => inject
    });
    module.exports = __toCommonJS(client_exports);
    var import_jsx_runtime = require("react/jsx-runtime");
    var LOGO_COLORS = ["#f5c815", "#f9a94a", "#f38358", "#ed92a1", "#d59ec8"];
    var LETTERS = ["l", "m", "t", "h", "i", "n", "g"];
    var LM_PREFIX_COLOR = "var(--lmthing-muted-foreground, #5c636b)";
    function LmthingBrandMark({ size, className }) {
      const px = typeof size === "number" ? size : 20;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: px, height: px, viewBox: "0 0 24 24", className, "aria-hidden": "true", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { width: "24", height: "24", rx: "6", fill: "#15505c" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", { x: "12", y: "17", textAnchor: "middle", fontSize: "13", fontWeight: "700", fontFamily: "system-ui, sans-serif", fill: "#ffffff", children: "lm" })
      ] });
    }
    function LmthingWordmark() {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontWeight: 600 }, children: LETTERS.map((letter, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: i < 2 ? LM_PREFIX_COLOR : LOGO_COLORS[i - 2] }, children: letter }, i)) });
    }
    var BRAND_STYLE_ID = "lmthing-brand-colors";
    function injectBrandColors() {
      if (document.getElementById(BRAND_STYLE_ID)) return;
      const style = document.createElement("style");
      style.id = BRAND_STYLE_ID;
      style.textContent = `
        body {
          --dsw-alias-brand-primary: #15505c;
          --dsw-alias-brand-primary-invert: #ffffff;
          --lmthing-muted-foreground: #5c636b;
        }
        body[data-ds-dark-theme] {
          --dsw-alias-brand-primary: #6aa8b4;
          --dsw-alias-brand-primary-invert: #101214;
          --lmthing-muted-foreground: #98a0a9;
        }
      `;
      document.head.appendChild(style);
    }
    var inject = ["slots"];
    function apply(ctx) {
      injectBrandColors();
      ctx.slots.inject(
        "sidebar.brand.mark",
        () => ctx.slots.inject(
          "sidebar.brand.name",
          () => ctx.slots.inject("conversation.hero.brand.mark", function* () {
            yield ctx.slots.register({ name: "sidebar.brand.mark", priority: -1 }, LmthingBrandMark);
            yield ctx.slots.register({ name: "sidebar.brand.name", priority: -1 }, LmthingWordmark);
            yield ctx.slots.register({ name: "conversation.hero.brand.mark", priority: -1 }, LmthingBrandMark);
          })
        )
      );
    }
    
    return module.exports;
  }
});
