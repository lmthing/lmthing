window.__ModuleLoader__.load({
  id: "@lmthing/dsh-client-space-components",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var __create = Object.create;
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __getProtoOf = Object.getPrototypeOf;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name2 in all)
        __defProp(target, name2, { get: all[name2], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
      // If the importer is in node compatibility mode or this is not an ESM
      // file that has been converted to a CommonJS file using a Babel-
      // compatible transform (i.e. "__esModule" has not been set), then set
      // "default" to the CommonJS "module.exports" for node compatibility.
      isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
      mod
    ));
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
    
    // src/client.jsx
    var client_exports = {};
    __export(client_exports, {
      apply: () => apply,
      inject: () => inject,
      name: () => name
    });
    module.exports = __toCommonJS(client_exports);
    var import_jsx_runtime = require("react/jsx-runtime");
    var React = __toESM(require("react"), 1);
    var import_react = require("react");
    if (typeof globalThis !== "undefined") globalThis.__LMTHING_REACT__ = React;
    function isSettled(block) {
      return "kind" in block;
    }
    function argsRawOf(block) {
      return (isSettled(block) ? block.call?.argsRaw : block.argsRaw) ?? "";
    }
    function optimisticComponentName(argsRaw) {
      try {
        const parsed = JSON.parse(argsRaw);
        return typeof parsed === "object" && parsed !== null && typeof parsed.component === "string" ? parsed.component : null;
      } catch {
        return null;
      }
    }
    var DisplayErrorBoundary = class extends import_react.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }
      static getDerivedStateFromError(error) {
        return { error };
      }
      render() {
        if (this.state.error) {
          return (0, import_jsx_runtime.jsx)("div", {
            "data-lmthing-display-error": true,
            style: { border: "1px solid #c00", borderRadius: 6, padding: 8, color: "#c00", fontSize: 13 },
            children: `display "${this.props.component}" failed to render: ${this.state.error instanceof Error ? this.state.error.message : String(this.state.error)}`
          });
        }
        return this.props.children;
      }
    };
    function LiveComponent({ code, componentProps }) {
      const [state, setState] = (0, import_react.useState)({ Comp: null, error: null });
      (0, import_react.useEffect)(() => {
        let cancelled = false;
        import(
          /* webpackIgnore: true */
          `data:text/javascript;base64,${code}`
        ).then((mod) => {
          if (cancelled) return;
          const Comp2 = mod.default ?? mod;
          if (typeof Comp2 !== "function") throw new Error("bundle has no usable default export");
          setState({ Comp: Comp2, error: null });
        }).catch((error) => {
          if (!cancelled) setState({ Comp: null, error });
        });
        return () => {
          cancelled = true;
        };
      }, [code]);
      if (state.error) {
        return (0, import_jsx_runtime.jsx)("div", {
          style: { fontSize: 13, opacity: 0.75 },
          children: `component failed to load: ${state.error instanceof Error ? state.error.message : String(state.error)}`
        });
      }
      if (!state.Comp) {
        return (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 13, opacity: 0.6 }, children: "loading component\u2026" });
      }
      const Comp = state.Comp;
      return (0, import_jsx_runtime.jsx)(Comp, { ...componentProps });
    }
    function FallbackCard({ component, props, note }) {
      return (0, import_jsx_runtime.jsxs)("div", {
        style: { border: "1px solid var(--dsw-alias-border-l2, #ddd)", borderRadius: 8, padding: 8, fontSize: 13 },
        children: [
          (0, import_jsx_runtime.jsx)("div", { style: { fontWeight: 600 }, children: `display ${component ?? ""}` }),
          note ? (0, import_jsx_runtime.jsx)("div", { style: { opacity: 0.7, marginTop: 2 }, children: note }) : null,
          props ? (0, import_jsx_runtime.jsx)("pre", { style: { margin: "4px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }, children: JSON.stringify(props, null, 2) }) : null
        ]
      });
    }
    function DisplayToolView({ block }) {
      const settled = isSettled(block);
      if (!settled) {
        const component = optimisticComponentName(argsRawOf(block));
        return (0, import_jsx_runtime.jsx)(FallbackCard, { component, props: null, note: "running\u2026" });
      }
      const meta = block.meta;
      const hasCode = meta && typeof meta === "object" && typeof meta.code === "string";
      if (!hasCode) {
        const fallbackProps = meta && typeof meta === "object" ? meta.props : void 0;
        const fallbackComponent = meta && typeof meta === "object" ? meta.component : optimisticComponentName(argsRawOf(block));
        return (0, import_jsx_runtime.jsx)(FallbackCard, { component: fallbackComponent, props: fallbackProps ?? null, note: null });
      }
      return (0, import_jsx_runtime.jsx)(DisplayErrorBoundary, {
        component: meta.component,
        children: (0, import_jsx_runtime.jsx)(LiveComponent, { code: meta.code, componentProps: meta.props ?? {} })
      });
    }
    var name = "lmthing-client-space-components";
    var inject = ["slots"];
    function apply(ctx) {
      ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({ name: "tool.call.toolview", key: "display" }, DisplayToolView));
    }
    
    return module.exports;
  }
});
