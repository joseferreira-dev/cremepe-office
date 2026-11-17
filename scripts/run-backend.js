"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// scripts/run-backend.ts
var import_child_process = require("child_process");
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var root = import_path.default.join(__dirname, "..");
var venvPy = process.platform === "win32" ? import_path.default.join(root, "venv", "Scripts", "python.exe") : import_path.default.join(root, "venv", "bin", "python");
var fallback = process.platform === "win32" ? "python" : "python3";
var py = import_fs.default.existsSync(venvPy) ? venvPy : fallback;
console.log(`[start-backend] ${py} backend/app.py`);
var child = (0, import_child_process.spawn)(py, [import_path.default.join(root, "backend", "app.py")], {
  stdio: "inherit",
  cwd: root
});
child.on("error", (err) => {
  console.error(`[start-backend] falha ao iniciar: ${err.message}`);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code == null ? 1 : code));
