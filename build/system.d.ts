interface SystemConfiguration {
    readonly baseUrl?: string;
    readonly map?: Partial<SystemImportMap>;
}
declare type SystemConfigure = (config: Readonly<SystemConfiguration>) => void;
interface SystemImportMap {
    scopes: SystemScopes;
    imports: SystemImports;
}
declare type SystemScopes = Record<string, SystemImports>;
declare type SystemImports = Record<string, string>;
interface SystemExports extends Record<string, any> {
    default?: any;
}
declare type SystemRegister = (deps: string[], declare: SystemDeclare) => void;
interface SystemRegistration {
    deps: string[];
    declare: SystemDeclare;
}
declare type SystemDeclare = (_export: SystemExport, context?: SystemContext) => SystemDeclaration;
interface SystemDeclaration {
    setters: (SystemSetter | undefined)[];
    execute: SystemExecute | undefined;
}
declare type SystemSetter = (exports: SystemExports) => void;
declare type SystemExecute = () => void | Promise<void>;
interface SystemContext {
    id: string;
    import: SystemImport;
    meta?: SystemMeta;
}
declare type SystemImport = (id: string) => Promise<SystemExports>;
declare type SystemExport = SystemExportObject | SystemExportProperty;
declare type SystemExportObject = (exports: Record<string, any>) => SystemExports;
declare type SystemExportProperty = <T>(key: string, value: T) => typeof value;
interface SystemMeta {
    url: string;
    resolve: SystemResolve;
}
declare type SystemResolve = (id: string) => string;
declare class SystemModule {
    readonly loader: SystemLoader;
    readonly url: string;
    private readonly dep_modules;
    private load_done;
    private link_done;
    private execute;
    private readonly setters;
    private readonly exports;
    private readonly dep_load_done;
    private readonly dep_link_done;
    constructor(loader: SystemLoader, url: string);
    private _load;
    _link(): Promise<void>;
    private _export_object;
    private _export_property;
    process(): Promise<SystemExports>;
    private _process_load;
    private _process_link;
}
declare class SystemLoader {
    private init_done;
    private base_url;
    private readonly import_map;
    readonly registry: Map<string, SystemModule>;
    config(config: Readonly<SystemConfiguration>): void;
    import(id: string, parent_url?: string): Promise<SystemExports>;
    resolve(id: string, parent_url?: string): string;
    private static _try_parse_url;
    private static _try_parse_url_like;
    private static _parse_import_map;
    private static _parse_scopes;
    private static _parse_imports;
    private static _resolve_import_map;
    private static _resolve_scopes;
    private static _resolve_imports;
    static readonly PLATFORM: "browser" | "command";
    static __get_root_url(): string;
    static __load_text(url: string): Promise<string>;
    static __get_init_configs(): Promise<Set<Readonly<SystemConfiguration>>>;
    static __get_init_module_ids(): Promise<Set<string>>;
}
declare const System: SystemLoader;
interface global {
    readonly System: SystemLoader;
}
interface global {
    readonly SystemLoader: typeof SystemLoader;
}
