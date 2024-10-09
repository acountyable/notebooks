import {
	LogRecord,
	ConsoleHandler,
	RotatingFileHandler,
	Logger,
	getLogger,
	setup,
	debug,
	info,
	warn,
	error,
	critical,
} from "./mod.ts";

import { assert } from "@std/assert";


// mock logger

  // Example configuration
  setup({
    handlers: {
      console: new ConsoleHandler("DEBUG", { useColors: true }),
      file: new RotatingFileHandler("INFO", {
        filename: "test.log",
        mode: "a",
        maxBytes: 1024 * 10, // 10 KB for demonstration
        maxBackupCount: 3,
		formatter: (record: LogRecord) => {
			return `[${new Date().toISOString()}] [${record.level}] [${record.loggerName}] ${record.msg}`;
		}
      }),
	},
	loggers: {
		test: {
			level: "DEBUG",
			handlers: ["console", "file"],
		},
	},
});

// Example usage
const logger = getLogger("test");
logger.debug("This is a debug message");
logger.info("This is an info message");
logger.warn("This is a warning");
logger.error("This is an error");
logger.critical("This is critical");

// Using utility functions
debug("Debug via utility function");
info("Info via utility function");
warn("Warn via utility function");
error("Error via utility function");
critical("Critical via utility function");


Deno.test("Log", async (t: Deno.TestContext) => {
	await t.step("Logger Can Be Created", async () => {
		const logger = getLogger("test");

		assert(logger instanceof Logger, "logger should be an instance of Logger");
	});

	await t.step("Logger File Handler Can Be Created", async () => {
		// check if file exists
		const file = await Deno.stat("./test.log");
		assert(file.isFile, "log file exists");
	});

	await t.step("Logger Can Log Messages", async () => {
		const logger = getLogger("test");
		logger.info("an informative message", {
			foo: "bar",
		});

		const log = await Deno.readTextFile("./test.log");

		assert(log.includes("an informative message"), "log should include info message");
	});

	Deno.removeSync("./test.log");

	// Example usage
	const logger = getLogger("test");
	logger.debug("This is a debug message");
	logger.info("This is an info message");
	logger.warn("This is a warning");
	logger.critical("This is critical");

	// Using utility functions
	debug("Debug via utility function");
	info("Info via utility function");
	warn("Warn via utility function");
	error("Error via utility function");
	critical("Critical via utility function");
});
