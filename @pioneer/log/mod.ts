// logger.ts

import { existsSync } from "@std/fs";
import { yellow, green, blue, red, bold } from "@std/fmt/colors";

/** Log Levels */
enum LogLevels {
  NOTSET = 0,
  DEBUG = 10,
  INFO = 20,
  WARN = 30,
  ERROR = 40,
  CRITICAL = 50,
}

const LogLevelNames: { [key: number]: string } = {
  [LogLevels.NOTSET]: "NOTSET",
  [LogLevels.DEBUG]: "DEBUG",
  [LogLevels.INFO]: "INFO",
  [LogLevels.WARN]: "WARN",
  [LogLevels.ERROR]: "ERROR",
  [LogLevels.CRITICAL]: "CRITICAL",
};

/** Utility Functions for Log Levels */
function getLevelByName(name: string): number {
  const upperName = name.toUpperCase();
  for (const [level, levelName] of Object.entries(LogLevels)) {
    if (levelName === upperName) {
      return Number(level);
    }
  }
  throw new Error(`Cannot get log level: no level named ${name}`);
}

function getLevelName(level: number): string {
  const levelName = LogLevelNames[level];
  if (levelName) {
    return levelName;
  }
  throw new Error(`Cannot get log level: no name for level: ${level}`);
}

/** Log Record */
class LogRecord {
  msg: string;
  args: unknown[];
  level: number;
  levelName: string;
  loggerName: string;
  datetime: Date;

  constructor(options: {
    msg: string;
    args: unknown[];
    level: number;
    loggerName: string;
  }) {
    this.msg = options.msg;
    this.args = [...options.args];
    this.level = options.level;
    this.loggerName = options.loggerName;
    this.datetime = new Date();
    this.levelName = getLevelName(options.level);
  }
}

/** Base Handler */
abstract class BaseHandler {
  private _level: number;
  private _levelName: string;
  formatter: (record: LogRecord) => string;

  constructor(levelName: string, options?: { formatter?: (record: LogRecord) => string }) {
    const { formatter } = options ?? {};
    this.formatter = formatter ?? BaseHandler.defaultFormatter;
    this._levelName = levelName;
    this._level = getLevelByName(levelName);
  }

  get level() {
    return this._level;
  }

  set level(level: number) {
    this._level = level;
    this._levelName = getLevelName(level);
  }

  get levelName() {
    return this._levelName;
  }

  set levelName(levelName: string) {
    this._levelName = levelName;
    this._level = getLevelByName(levelName);
  }

  handle(record: LogRecord) {
    if (this.level > record.level) return;
    const msg = this.format(record);
    this.log(msg, record.level);
  }

  format(record: LogRecord): string {
    return this.formatter(record);
  }

  abstract log(message: string, level: number): void;

  static defaultFormatter(record: LogRecord): string {
    const timestamp = record.datetime.toISOString();
    return `[${timestamp}] [${record.levelName}] [${record.loggerName}] ${record.msg}`;
  }
}

/** Console Handler */
class ConsoleHandler extends BaseHandler {
  private useColors: boolean;

  constructor(levelName: string, options: { useColors?: boolean; formatter?: (record: LogRecord) => string } = {}) {
    super(levelName, options);
    this.useColors = options.useColors ?? true;
  }

  override format(record: LogRecord): string {
    let msg = super.format(record);
    if (this.useColors) {
      msg = this.applyColors(msg, record.level);
    }
    return msg;
  }

  applyColors(msg: string, level: number): string {
    switch (level) {
      case LogLevels.INFO:
        return green(msg);
      case LogLevels.WARN:
        return yellow(msg);
      case LogLevels.ERROR:
        return red(msg);
      case LogLevels.CRITICAL:
        return bold(red(msg));
      case LogLevels.DEBUG:
        return blue(msg);
      default:
        return msg;
    }
  }

  log(message: string, _level: number): void {
    console.log(message);
  }
}

/** Rotating File Handler */
class RotatingFileHandler extends BaseHandler {
  private filename: string;
  private mode: "a" | "w" | "x";
  private maxBytes: number;
  private maxBackupCount: number;
  private file?: Deno.FsFile;
  private encoder = new TextEncoder();
  private currentFileSize: number = 0;

  constructor(levelName: string, options: {
    filename: string;
    mode?: "a" | "w" | "x";
    maxBytes: number;
    maxBackupCount: number;
    formatter?: (record: LogRecord) => string;
  }) {
    super(levelName, options);
    this.filename = options.filename;
    this.mode = options.mode ?? "a";
    this.maxBytes = options.maxBytes;
    this.maxBackupCount = options.maxBackupCount;
    this.setup();
    // Ensure the file is closed on unload
    addEventListener("unload", () => this.destroy());
  }

  setup() {
    if (this.maxBytes < 1) {
      throw new Error(`"maxBytes" must be >= 1: received ${this.maxBytes}`);
    }
    if (this.maxBackupCount < 1) {
      throw new Error(`"maxBackupCount" must be >= 1: received ${this.maxBackupCount}`);
    }

    const openOptions: Deno.OpenOptions = {
      create: this.mode !== "x",
      createNew: this.mode === "x",
      append: this.mode === "a",
      truncate: this.mode !== "a",
      write: true,
    };

    this.file = Deno.openSync(this.filename, openOptions);

    if (this.mode === "w") {
      // Remove old backups
      for (let i = 1; i <= this.maxBackupCount; i++) {
        const backup = `${this.filename}.${i}`;
        if (existsSync(backup)) {
          Deno.removeSync(backup);
        }
      }
    } else if (this.mode === "x") {
      // Throw if any backups exist
      for (let i = 1; i <= this.maxBackupCount; i++) {
        const backup = `${this.filename}.${i}`;
        if (existsSync(backup)) {
          this.destroy();
          throw new Deno.errors.AlreadyExists(`Backup log file ${backup} already exists`);
        }
      }
    } else {
      // Get current file size
      const fileInfo = Deno.statSync(this.filename);
      this.currentFileSize = fileInfo.size;
    }
  }

  log(message: string, _level: number): void {
    if (!this.file) return;
    const bytes = this.encoder.encode(message + "\n");
    if (this.currentFileSize + bytes.length > this.maxBytes) {
      this.rotateLogFiles();
      this.currentFileSize = 0;
    }
    this.file.writeSync(bytes);
    this.currentFileSize += bytes.length;
  }

  rotateLogFiles() {
    if (this.file) {
      this.file.close();
    }

    for (let i = this.maxBackupCount - 1; i >= 0; i--) {
      const source = i === 0 ? this.filename : `${this.filename}.${i}`;
      const dest = `${this.filename}.${i + 1}`;
      if (existsSync(source)) {
        Deno.renameSync(source, dest);
      }
    }

    this.file = Deno.openSync(this.filename, { create: true, write: true, append: false });
  }

  flush() {
    // Since we're writing synchronously, nothing is needed here
  }

  destroy() {
    this.flush();
    this.file?.close();
  }
}

/** Logger */
class Logger {
  private level: number;
  private handlers: BaseHandler[];
  private loggerName: string;

  constructor(loggerName: string, levelName: string, handlers: BaseHandler[] = []) {
    this.loggerName = loggerName;
    this.level = getLevelByName(levelName);
    this.handlers = handlers;
  }

  /** Set the log level */
  setLevel(levelName: string | number) {
    if (typeof levelName === "string") {
      this.level = getLevelByName(levelName);
    } else {
      this.level = levelName;
      this.level = getLevelByName(getLevelName(this.level));
    }
  }

  /** Log a message */
  private log(level: number, msg: unknown, ...args: unknown[]): unknown {
    if (this.level > level) {
      return typeof msg === "function" ? undefined : msg;
    }

    let logMessage: string;
    let fnResult: unknown;

    if (typeof msg === "function") {
      fnResult = msg();
      logMessage = this.asString(fnResult);
    } else {
      logMessage = this.asString(msg);
    }

    const record = new LogRecord({
      msg: logMessage,
      args,
      level,
      loggerName: this.loggerName,
    });

    for (const handler of this.handlers) {
      handler.handle(record);
    }

    return typeof msg === "function" ? fnResult : msg;
  }

  /** Convert data to string */
  private asString(data: unknown, isProperty = false): string {
    if (typeof data === "string") {
      return isProperty ? `"${data}"` : data;
    } else if (
      data === null ||
      typeof data === "number" ||
      typeof data === "bigint" ||
      typeof data === "boolean" ||
      typeof data === "undefined" ||
      typeof data === "symbol"
    ) {
      return String(data);
    } else if (data instanceof Error) {
      return data.stack ?? String(data);
    } else if (typeof data === "object") {
      return `{${Object.entries(data)
        .map(([k, v]) => `"${k}":${this.asString(v, true)}`)
        .join(",")}}`;
    }
    return "undefined";
  }

  debug(msg: unknown, ...args: unknown[]) {
    return this.log(LogLevels.DEBUG, msg, ...args);
  }

  info(msg: unknown, ...args: unknown[]) {
    return this.log(LogLevels.INFO, msg, ...args);
  }

  warn(msg: unknown, ...args: unknown[]) {
    return this.log(LogLevels.WARN, msg, ...args);
  }

  error(msg: unknown, ...args: unknown[]) {
    return this.log(LogLevels.ERROR, msg, ...args);
  }

  critical(msg: unknown, ...args: unknown[]) {
    return this.log(LogLevels.CRITICAL, msg, ...args);
  }
}

/** Logger Manager */
class LoggerManager {
  private loggers: Map<string, Logger> = new Map();
  private handlers: Map<string, BaseHandler> = new Map();

  /** Get or create a logger */
  getLogger(name: string): Logger {
    if (this.loggers.has(name)) {
      return this.loggers.get(name)!;
    }
    // Default to NOTSET level with no handlers
    const logger = new Logger(name, "NOTSET", []);
    this.loggers.set(name, logger);
    return logger;
  }

  /** Add a handler */
  addHandler(name: string, handler: BaseHandler) {
    this.handlers.set(name, handler);
  }

  /** Get a handler */
  getHandler(name: string): BaseHandler | undefined {
    return this.handlers.get(name);
  }

  /** Configure loggers */
  configure(config: {
    loggers: {
      [name: string]: {
        level: string;
        handlers: string[];
      };
    };
    handlers: {
      [name: string]: BaseHandler;
    };
  }) {
    // Add handlers
    for (const [name, handler] of Object.entries(config.handlers)) {
      this.addHandler(name, handler);
    }

    // Configure loggers
    for (const [loggerName, loggerConfig] of Object.entries(config.loggers)) {
      const handlers: BaseHandler[] = [];
      for (const handlerName of loggerConfig.handlers) {
        const handler = this.getHandler(handlerName);
        if (handler) {
          handlers.push(handler);
        } else {
          throw new Error(`Handler "${handlerName}" not found for logger "${loggerName}"`);
        }
      }
      const logger = new Logger(loggerName, loggerConfig.level, handlers);
      this.loggers.set(loggerName, logger);
    }
  }
}

/** Singleton Logger Manager */
const loggerManager = new LoggerManager();

/** Utility Functions for Logging */
function debug(msg: unknown, ...args: unknown[]): unknown {
  return getLogger("default").debug(msg, ...args);
}

function info(msg: unknown, ...args: unknown[]): unknown {
  return getLogger("default").info(msg, ...args);
}

function warn(msg: unknown, ...args: unknown[]): unknown {
  return getLogger("default").warn(msg, ...args);
}

function error(msg: unknown, ...args: unknown[]): unknown {
  return getLogger("default").error(msg, ...args);
}

function critical(msg: unknown, ...args: unknown[]): unknown {
  return getLogger("default").critical(msg, ...args);
}

/** Get Logger */
function getLogger(name: string): Logger {
  return loggerManager.getLogger(name);
}

/** Setup Function */
function setup(config: {
  loggers: {
    [name: string]: {
      level: string;
      handlers: string[];
    };
  };
  handlers: {
    [name: string]: BaseHandler;
  };
}) {
  loggerManager.configure(config);
}

/** Example Setup */
if (import.meta.main) {
  // Example configuration
  setup({
    handlers: {
      console: new ConsoleHandler("DEBUG", {
        useColors: true,
      }),
      file: new RotatingFileHandler("INFO", {
        filename: "app.log",
        mode: "a",
        maxBytes: 1024 * 10, // 10 KB for demonstration
        maxBackupCount: 3,
      }),
    },
    loggers: {
      default: {
        level: "INFO",
        handlers: ["console", "file"],
      },
    },
  });

  // Example usage
  const logger = getLogger("default");
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
}

export {
  LogLevels,
  LogRecord,
  BaseHandler,
  ConsoleHandler,
  RotatingFileHandler,
  Logger,
  LoggerManager,
  getLogger,
  setup,
  debug,
  info,
  warn,
  error,
  critical,
};
