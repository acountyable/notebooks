/**
 * @module dump
 * This module provides functionality to stringify JavaScript modules and their contents.
 *
 * @example
 * ```ts
 * // Example of using stringifyModule
 * const myModule: Record<string, any> = {
 *   name: "example",
 *   version: 1.0,
 *   greet: function() { return "Hello, world!"; }
 * };
 *
 * const stringified: Record<string, any> = stringifyModule(myModule);
 * console.log(stringified);
 * // Output: { name: "example", version: "1", greet: "function() { return \"Hello, world!\"; }" }
 * ```
 * @example
 * ```ts
 * // Example of using the Dump interface
 * const dump: IDump = {
 *   module: async (import_path: string): Promise<Record<string, any>> => {
 *     const module = await import(import_path);
 *     return stringifyModule(module);
 *   }
 * };
 *
 * (async () => {
 *   const result: Record<string, any> = await dump.module('./myModule.ts');
 *   console.log(result);
 * })();
 * ```
 */

export function stringifyModule(
  module: Record<string, any>,
): Record<string, any> {
  return Object.keys(module).reduce((acc, key) => {
    const value = module[key];
    // Check if the value is a function and stringify its contents
    if (typeof value === "function") {
      acc[key] = value.toString();
    } // Recursively stringify nested objects
    else if (typeof value === "object" && value !== null) {
      acc[key] = stringifyModule(value);
    } // Otherwise, handle as a string, number, etc.
    else {
      acc[key] = String(value);
    }
    return acc;
  }, {} as Record<string, any>);
}

export interface IDump {
  module: (import_path: string) => Promise<Record<string, any>>;
}

export const Dump: IDump = {
  module: async (import_path: string) => {
    const module = await import(import_path);

    return stringifyModule(module);
  },
};
