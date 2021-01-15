"use strict";
//
// Copyright (c) Flyover Games, LLC
//
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class SystemModule {
    constructor(loader, url) {
        this.loader = loader;
        this.url = url;
        this.dep_modules = new Set(); // dependent modules
        this.load_done = false;
        this.link_done = false;
        this.execute = null;
        this.setters = new Set(); // setters for modules dependent on this module
        this.exports = Object.create(null);
        this.dep_load_done = new Set();
        this.dep_link_done = new Set();
        this.loader.registry.set(this.url, this);
        Object.defineProperty(this.exports, Symbol.toStringTag, { value: "Module" });
    }
    _load() {
        return __awaiter(this, void 0, void 0, function* () {
            const source = yield SystemLoader.__load_text(this.url);
            let registration = { deps: [], declare: () => ({ setters: [], execute: () => { } }) };
            const register = (deps, declare) => { registration = { deps, declare }; };
            const common = { exports: this.exports };
            (0, eval)(`(function (System, module, exports) { ${source}\n})\n//# sourceURL=${this.url}`)({ register }, common, common.exports);
            if (common.exports !== this.exports) {
                this.exports.default = common.exports;
            }
            const { deps, declare } = registration;
            const _import = (id) => this.loader.import(id, this.url);
            const _export = (...args) => {
                if (args.length === 1 && typeof args[0] === "object") {
                    return this._export_object(args[0]);
                }
                if (args.length === 2 && typeof args[0] === "string") {
                    return this._export_property(args[0], args[1]);
                }
                throw new Error(args.toString());
            };
            const resolve = (id) => this.loader.resolve(id, this.url);
            const context = { id: this.url, import: _import, meta: { url: this.url, resolve } };
            const { setters, execute } = declare(_export, context);
            for (const [dep_index, dep_id] of deps.entries()) {
                const dep_url = this.loader.resolve(dep_id, this.url);
                const dep_module = this.loader.registry.get(dep_url) || new SystemModule(this.loader, dep_url);
                this.dep_modules.add(dep_module);
                const dep_setter = setters[dep_index]; // setters match deps order
                if (dep_setter) {
                    dep_module.setters.add(dep_setter);
                    dep_setter(dep_module.exports);
                }
            }
            if (execute) {
                this.execute = execute;
            }
        });
    }
    _link() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.execute !== null) {
                yield this.execute.call(null);
            }
        });
    }
    _export_object(object) {
        if (object.__esModule) {
            Object.defineProperty(this.exports, "__esModule", { enumerable: false, value: object.__esModule });
        }
        let changed = false;
        for (const [key, value] of Object.entries(object)) {
            if (!(key in this.exports) || (this.exports[key] !== value)) {
                this.exports[key] = value;
                changed = true;
            }
        }
        if (changed)
            for (const setter of this.setters) {
                setter(this.exports);
            }
        return this.exports;
    }
    _export_property(key, value) {
        if (!(key in this.exports) || (this.exports[key] !== value)) {
            this.exports[key] = value;
            for (const setter of this.setters) {
                setter(this.exports);
            }
        }
        return value;
    }
    process() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._process_load(this.dep_load_done);
            yield this._process_link(this.dep_link_done);
            return this.exports;
        });
    }
    _process_load(dep_load_done) {
        return __awaiter(this, void 0, void 0, function* () {
            if (dep_load_done.has(this.url)) {
                return;
            }
            dep_load_done.add(this.url);
            if (!this.load_done) {
                this.load_done = true;
                yield this._load();
            } // before dependencies
            for (const dep_module of this.dep_modules) {
                yield dep_module._process_load(dep_load_done);
            }
        });
    }
    _process_link(dep_link_done) {
        return __awaiter(this, void 0, void 0, function* () {
            if (dep_link_done.has(this.url)) {
                return;
            }
            dep_link_done.add(this.url);
            for (const dep_module of this.dep_modules) {
                yield dep_module._process_link(dep_link_done);
            }
            if (!this.link_done) {
                this.link_done = true;
                yield this._link();
            } // after dependencies
        });
    }
}
class SystemLoader {
    constructor() {
        this.init_done = false;
        this.base_url = SystemLoader.__get_root_url();
        this.import_map = { imports: {}, scopes: {} };
        this.registry = new Map();
    }
    config(config) {
        if (config.baseUrl) {
            this.base_url = SystemLoader._try_parse_url_like(config.baseUrl, SystemLoader.__get_root_url()) || this.base_url;
        }
        if (config.map) {
            SystemLoader._parse_import_map(config.map, this.base_url, this.import_map);
        }
    }
    import(id, parent_url = this.base_url) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.init_done) {
                this.init_done = true;
                for (const config of yield SystemLoader.__get_init_configs()) {
                    this.config(config);
                }
                for (const module_id of yield SystemLoader.__get_init_module_ids()) {
                    yield this.import(module_id);
                }
            }
            const url = this.resolve(id, parent_url);
            const module = this.registry.get(url) || new SystemModule(this, url);
            return module.process();
        });
    }
    resolve(id, parent_url = this.base_url) {
        const import_map_url = SystemLoader._resolve_import_map(this.import_map, id, parent_url);
        if (import_map_url) {
            // console.log(`import map resolved "${id}" from "${parent_url}" to "${import_map_url}"`);
            return import_map_url;
        }
        const url = SystemLoader._try_parse_url(id, parent_url);
        if (url) {
            // console.log(`resolved "${id}" from "${parent_url}" to "${url}"`);
            return url;
        }
        throw new Error(`Cannot resolve "${id}" from ${parent_url}`);
    }
    // import maps
    // https://github.com/WICG/import-maps
    // https://github.com/open-wc/open-wc/blob/master/packages/import-maps-resolve/src/utils.js
    static _try_parse_url(id, base_url) {
        try {
            return new URL(id, base_url).href;
        }
        catch (e) {
            return undefined;
        }
    }
    static _try_parse_url_like(id, base_url) {
        const is_path_like = id.startsWith("/") || id.startsWith("./") || id.startsWith("../");
        return is_path_like ? SystemLoader._try_parse_url(id, base_url) : SystemLoader._try_parse_url(id);
    }
    // https://github.com/open-wc/open-wc/blob/master/packages/import-maps-resolve/src/parser.js
    static _parse_import_map(import_map, base_url, out) {
        SystemLoader._parse_scopes(import_map.scopes || {}, base_url, out.scopes);
        SystemLoader._parse_imports(import_map.imports || {}, base_url, out.imports);
        return out;
    }
    static _parse_scopes(scopes, base_url, out) {
        for (const [scope_id, scope_imports] of Object.entries(scopes)) {
            const parsed_id = SystemLoader._try_parse_url(scope_id, base_url) || scope_id;
            const parsed_imports = SystemLoader._parse_imports(scope_imports, base_url, {});
            out[parsed_id] = parsed_imports;
        }
        return out;
    }
    static _parse_imports(imports, base_url, out) {
        for (const [import_id, import_url] of Object.entries(imports)) {
            const parsed_id = SystemLoader._try_parse_url_like(import_id, base_url) || import_id;
            const parsed_url = SystemLoader._try_parse_url_like(import_url, base_url) || import_url;
            out[parsed_id] = parsed_url;
        }
        return out;
    }
    // https://github.com/open-wc/open-wc/blob/master/packages/import-maps-resolve/src/resolver.js
    static _resolve_import_map(map, id, parent_url) {
        const url = SystemLoader._try_parse_url_like(id, parent_url);
        const matched_scope = SystemLoader._resolve_scopes(map.scopes, url || id, parent_url);
        if (matched_scope) {
            return matched_scope;
        }
        const matched_import = SystemLoader._resolve_imports(map.imports, url || id);
        if (matched_import) {
            return matched_import;
        }
        return url;
    }
    static _resolve_scopes(scopes, id, parent_url) {
        for (const [scope_id, scope_imports] of Object.entries(scopes)) {
            if (parent_url.startsWith(scope_id) && scope_id.endsWith("/")) {
                const matched_import = SystemLoader._resolve_imports(scope_imports, id);
                if (matched_import) {
                    return matched_import;
                }
            }
        }
        return undefined;
    }
    static _resolve_imports(imports, id) {
        for (const [import_id, import_url] of Object.entries(imports)) {
            // "@foo" -> {["@foo"]: "./abc/a.js"} -> "./abc/a.js"
            if (import_id === id) {
                return import_url;
            }
            // wildcard (*)
            // "@foo/a/bar/b" -> {["@foo/*/bar/*"]: "./abc/*/xyz/*.js"} -> "./abc/a/xyz/b.js"
            if (import_id.includes("*")) {
                const import_id_regex = new RegExp(import_id.replace(/\./g, "\\.").replace(/\*/g, "(.+)"));
                const match = id.match(import_id_regex);
                if (match !== null) {
                    let index = 1;
                    const url = import_url.replace(/\*/g, () => match[index++]);
                    // console.log(`${id} -> {[${import_id}]: ${import_url}} -> ${url}`);
                    return url;
                }
            }
            // "@foo/a.js" -> {["@foo/"]: "./abc/"} -> "./abc/a.js"
            if (id.startsWith(import_id) && import_id.endsWith("/")) {
                const matched = SystemLoader._try_parse_url(id.substring(import_id.length), import_url);
                if (matched) {
                    return matched;
                }
            }
        }
        return undefined;
    }
    static __get_root_url() {
        switch (SystemLoader.PLATFORM) {
            default: throw new Error(`TODO: ${SystemLoader.PLATFORM} __get_root_url()`);
            case "browser": return new URL(location.pathname, location.origin).href;
            case "command": return require("url").pathToFileURL(`${process.cwd()}/`).href;
        }
    }
    static __load_text(url) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (SystemLoader.PLATFORM) {
                default: throw new Error(`TODO: ${SystemLoader.PLATFORM} __load_text(${url})`);
                case "browser": {
                    const response = yield fetch(url);
                    return yield response.text();
                }
                case "command": {
                    const filename = require("url").fileURLToPath(url);
                    return yield require("fs").promises.readFile(filename, "utf-8");
                }
            }
        });
    }
    static __get_init_configs() {
        return __awaiter(this, void 0, void 0, function* () {
            const configs = new Set();
            switch (SystemLoader.PLATFORM) {
                default: throw new Error(`TODO: ${SystemLoader.PLATFORM} __get_init_configs()`);
                case "browser":
                    for (const script of document.querySelectorAll("script")) {
                        if (["importmap", "systemjs-importmap"].includes(script.type)) {
                            if (script.src) {
                                // <script type="systemjs-importmap" src="import-map.json"></script>
                                const source = yield SystemLoader.__load_text(script.src);
                                configs.add({ map: JSON.parse(source) });
                            }
                            else {
                                // <script type="systemjs-importmap">{ imports: { ... }, scopes: { ... } }</script>
                                configs.add({ map: JSON.parse(script.innerHTML) });
                            }
                        }
                    }
                    break;
                case "command":
                    // System.config({ ... });
                    try {
                        const url = require("path").resolve(process.cwd(), "system.config.js");
                        const source = yield SystemLoader.__load_text(url);
                        const config = (config) => { configs.add(config); };
                        (0, eval)(`(function (System) { ${source}\n})\n//# sourceURL=${url}`)({ config });
                    }
                    catch (err) { }
                    // { imports: { ... }, scopes: { ... } }
                    try {
                        const url = require("path").resolve(process.cwd(), "system.config.json");
                        const source = yield SystemLoader.__load_text(url);
                        configs.add(JSON.parse(source));
                    }
                    catch (err) { }
                    break;
            }
            return configs;
        });
    }
    static __get_init_module_ids() {
        return __awaiter(this, void 0, void 0, function* () {
            const module_ids = new Set();
            switch (SystemLoader.PLATFORM) {
                default: throw new Error(`TODO: ${SystemLoader.PLATFORM} __get_init_module_ids()`);
                case "browser":
                    for (const script of document.querySelectorAll("script")) {
                        if (["module", "systemjs-module"].includes(script.type)) {
                            const match = script.src.match(/^import:(.*)$/);
                            if (match !== null) {
                                // <script type="systemjs-module" src="import:foo"></script>
                                module_ids.add(match[1]);
                            }
                        }
                    }
                    break;
                case "command":
                    break;
            }
            return module_ids;
        });
    }
}
// platform specific
SystemLoader.PLATFORM = (() => {
    if (typeof window !== "undefined") {
        return "browser";
    }
    if (typeof process !== "undefined") {
        return "command";
    }
    throw new Error("TODO: PLATFORM");
})();
// global instance
const System = new SystemLoader();
globalThis["System"] = System;
globalThis["SystemLoader"] = SystemLoader;
//# sourceMappingURL=system.js.map