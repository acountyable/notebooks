import * as MockFetch from "@pioneer/test/mock/fetch";
import * as MockCommand from "@pioneer/test/mock/command";
import { assertEquals } from "jsr:@std/assert";


const { mockCommand, resetCommand } = MockCommand;

Deno.test({
  name: "should mock a shell command made with Deno.Command",
  async fn() {
    mockCommand({
      command: "deno",
      args: ["run", "example.ts"],
    }, {
      stdout: new TextEncoder().encode("example output"),
    });
    const cmd = new Deno.Command("deno", {
      args: ["run", "example.ts"],
    });
    const output = await cmd.output();
    assertEquals(output, {
      stdout: new TextEncoder().encode("example output"),
      stderr: new Uint8Array(),
      code: 0,
      success: true,
      signal: null,
    });
    resetCommand();
  },
});

Deno.test("Mock Fetch Works", async () => {
		MockFetch.mockFetch("https://example.com", {
		body: "Hello, world!",
	});

	const resp = await fetch("https://example.com");

	assertEquals(resp.status, 200);
	assertEquals(await resp.text(), "Hello, world!");
});
