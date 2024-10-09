import { Dump } from "./mod.ts";
import { assert } from "jsr:@std/assert";
import { TestConstant, TestFunction } from "../test/mock/module/mod.ts";


Deno.bench({
	name: "Dump Performance Test",
	fn: async () => {
		const local = await Dump.module("@pioneer/test/mock/module");
	}
})


Deno.test("Dump", async (t: Deno.TestContext) => {
  await t.step(
    "Local Module Can Be Imported and Dumped as String",
    async () => {
      const local = await Dump.module("@pioneer/test/mock/module");

      assert(Object.keys(local).length > 0, "local should have keys");
      assert(
        Object.values(local).every((value) => typeof value === "string"),
        "local should have string values",
      );
      const callback = eval(local.TestFunctionWithCallback);
      assert(
        typeof callback == "function",
        "TestFunctionWithCallback should be function after eval",
      );
      assert(TestConstant == "test", "TestConstant should be test");
      assert(TestFunction() == "test", "TestFunction should be test");
    },
  );
});
