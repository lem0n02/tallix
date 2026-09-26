var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../root/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// ../../root/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// ../../root/.npm/_npx/32026684e21afda6/node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
if (!("__unenv__" in performance)) {
  const proto = Performance.prototype;
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key !== "constructor" && !(key in performance)) {
      const desc = Object.getOwnPropertyDescriptor(proto, key);
      if (desc) {
        Object.defineProperty(performance, key, desc);
      }
    }
  }
}
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// ../../root/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// ../../root/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// ../../root/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// ../../root/.npm/_npx/32026684e21afda6/node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// ../../root/.npm/_npx/32026684e21afda6/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// ../../root/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// ../../root/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// ../../root/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// ../../root/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str, encoding, cb) {
    if (str instanceof Uint8Array) {
      str = new TextDecoder().decode(str);
    }
    try {
      console.log(str);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};

// ../../root/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// ../../root/.npm/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process extends EventEmitter {
  static {
    __name(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};

// ../../root/.npm/_npx/32026684e21afda6/node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var workerdProcess = getBuiltinModule("node:process");
var unenvProcess = new Process({
  env: globalProcess.env,
  hrtime,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
var { exit, features, platform } = workerdProcess;
var {
  _channel,
  _debugEnd,
  _debugProcess,
  _disconnect,
  _events,
  _eventsCount,
  _exiting,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _handleQueue,
  _kill,
  _linkedBinding,
  _maxListeners,
  _pendingMessage,
  _preload_modules,
  _rawDebug,
  _send,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  assert: assert2,
  availableMemory,
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  disconnect,
  dlopen,
  domain,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  hrtime: hrtime3,
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  mainModule,
  memoryUsage,
  moduleLoadList,
  nextTick,
  off,
  on,
  once,
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions
} = unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// ../../root/.npm/_npx/32026684e21afda6/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// worker/index.ts
var workerOtps = /* @__PURE__ */ new Map();
function buildVerificationEmailHtml(otp) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tallix Email Verification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #fafafa;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #09090b; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 36px 28px; text-align: left;">
          <tr>
            <td>
              <div style="margin-bottom: 24px;">
                <span style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">TALLIX</span>
                <span style="font-size: 11px; font-weight: 700; color: #10b981; background-color: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); padding: 2px 8px; border-radius: 12px; margin-left: 8px; vertical-align: middle;">VERIFICATION</span>
              </div>
              
              <h1 style="font-size: 18px; font-weight: 700; color: #ffffff; margin: 0 0 12px 0;">Verify Your Email Address</h1>
              <p style="font-size: 14px; line-height: 22px; color: #a1a1aa; margin: 0 0 24px 0;">
                Thank you for signing up with Tallix! Please use the following 6-digit One-Time Passcode (OTP) to complete your account registration:
              </p>

              <div style="background-color: #09090b; border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <span style="font-family: 'SF Mono', Consolas, Menlo, Monaco, monospace; font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #10b981; display: inline-block; margin-left: 10px;">${otp}</span>
              </div>

              <p style="font-size: 12px; line-height: 20px; color: #71717a; margin: 0 0 8px 0;">
                \u2022 This code is valid for <strong>10 minutes</strong>.<br/>
                \u2022 This code is single-use and strictly for completing your Tallix account registration.<br/>
                \u2022 Never share this verification code with anyone.
              </p>

              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #27272a; font-size: 11px; color: #52525b; line-height: 18px;">
                If you did not request this verification, you can safely ignore this email. No account will be created without this code.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
__name(buildVerificationEmailHtml, "buildVerificationEmailHtml");
function buildVerificationEmailText(otp) {
  return `Tallix Email Verification

Your 6-digit verification code is: ${otp}

Please enter this code on the registration page to complete your Tallix account registration.
This code is valid for 10 minutes and can only be used once.

If you did not request this verification, you can safely ignore this email.`;
}
__name(buildVerificationEmailText, "buildVerificationEmailText");
async function sendWorkerEmail(to, otp, env2) {
  const subject = "Tallix Email Verification";
  const html = buildVerificationEmailHtml(otp);
  const text = buildVerificationEmailText(otp);
  const resendKey = env2.RESEND_API_KEY ? env2.RESEND_API_KEY.trim() : "";
  if (resendKey) {
    try {
      const fromEmail = (env2.RESEND_FROM_EMAIL ? env2.RESEND_FROM_EMAIL.trim() : "") || "Tallix <onboarding@resend.dev>";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          html,
          text
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || `Resend HTTP ${res.status}`);
      }
      return { success: true, provider: "resend" };
    } catch (err) {
      return { success: false, provider: "resend", error: err.message };
    }
  }
  if (env2.BREVO_API_KEY) {
    try {
      const senderEmail = env2.BREVO_SENDER_EMAIL || "noreply@tallix.app";
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": env2.BREVO_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sender: { name: "Tallix", email: senderEmail },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || `Brevo HTTP ${res.status}`);
      }
      return { success: true, provider: "brevo" };
    } catch (err) {
      return { success: false, provider: "brevo", error: err.message };
    }
  }
  if (env2.SENDGRID_API_KEY) {
    try {
      const fromEmail = env2.SENDGRID_FROM_EMAIL || "noreply@tallix.app";
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env2.SENDGRID_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: fromEmail, name: "Tallix" },
          subject,
          content: [
            { type: "text/plain", value: text },
            { type: "text/html", value: html }
          ]
        })
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`SendGrid HTTP ${res.status}: ${errText}`);
      }
      return { success: true, provider: "sendgrid" };
    } catch (err) {
      return { success: false, provider: "sendgrid", error: err.message };
    }
  }
  if (env2.POSTMARK_SERVER_TOKEN) {
    try {
      const fromEmail = env2.POSTMARK_FROM_EMAIL || "noreply@tallix.app";
      const res = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "X-Postmark-Server-Token": env2.POSTMARK_SERVER_TOKEN,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          From: fromEmail,
          To: to,
          Subject: subject,
          HtmlBody: html,
          TextBody: text
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.Message || `Postmark HTTP ${res.status}`);
      }
      return { success: true, provider: "postmark" };
    } catch (err) {
      return { success: false, provider: "postmark", error: err.message };
    }
  }
  return {
    success: false,
    error: "No transactional email provider is configured. Please configure RESEND_API_KEY in environment variables."
  };
}
__name(sendWorkerEmail, "sendWorkerEmail");
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Device-Id, X-Admin-Email, X-User-Id, X-User-Email"
};
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS
    }
  });
}
__name(jsonResponse, "jsonResponse");
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPassword, "hashPassword");
var index_default = {
  async fetch(request, env2) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    try {
      if (url.pathname === "/api/health") {
        let dbOk = false;
        let dbError = null;
        try {
          if (env2.DB) {
            const queryRes = await env2.DB.prepare("SELECT 1 as alive").first();
            dbOk = queryRes?.alive === 1;
          }
        } catch (err) {
          dbOk = false;
          dbError = err?.message || "Failed to query D1 database";
        }
        return jsonResponse(
          {
            status: dbOk ? "operational" : "degraded",
            engine: "Cloudflare Workers + D1",
            environment: env2.ENVIRONMENT || "production",
            databaseConnected: dbOk,
            ...dbError ? { databaseError: dbError } : {},
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          },
          dbOk ? 200 : 503
        );
      }
      if (url.pathname === "/" || url.pathname === "") {
        if (env2.ASSETS) {
          return await env2.ASSETS.fetch(request);
        }
        let dbOk = false;
        try {
          if (env2.DB) {
            const queryRes = await env2.DB.prepare("SELECT 1 as alive").first();
            dbOk = queryRes?.alive === 1;
          }
        } catch {
          dbOk = false;
        }
        return jsonResponse({
          status: dbOk ? "operational" : "degraded",
          engine: "Cloudflare Workers + D1",
          environment: env2.ENVIRONMENT || "production",
          databaseConnected: dbOk,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      if (url.pathname === "/api/auth/send-verification" && request.method === "POST") {
        try {
          const body = await request.json();
          const { email } = body || {};
          if (!email || typeof email !== "string" || !email.trim()) {
            return jsonResponse({ success: false, error: "Email address is required." }, 400);
          }
          const cleanEmail = email.trim().toLowerCase();
          if (!/\S+@\S+\.\S+/.test(cleanEmail)) {
            return jsonResponse({ success: false, error: "A valid email address is required." }, 400);
          }
          const existingUser = await env2.DB.prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1").bind(cleanEmail).first();
          if (existingUser) {
            return jsonResponse({
              success: false,
              error: "This email is already registered. Please sign in instead."
            }, 409);
          }
          const existingOtp = workerOtps.get(cleanEmail);
          if (existingOtp && Date.now() - existingOtp.createdAt < 3e4) {
            const remaining = Math.ceil((3e4 - (Date.now() - existingOtp.createdAt)) / 1e3);
            return jsonResponse({
              success: false,
              error: `Please wait ${remaining}s before requesting a new verification code.`
            }, 429);
          }
          const randomArray = new Uint32Array(1);
          crypto.getRandomValues(randomArray);
          const otp = (1e5 + randomArray[0] % 9e5).toString();
          const expiresAt = Date.now() + 10 * 60 * 1e3;
          const emailResult = await sendWorkerEmail(cleanEmail, otp, env2);
          if (!emailResult.success) {
            return jsonResponse({
              success: false,
              error: emailResult.error || "Failed to deliver verification email. Please check your email configuration."
            }, 503);
          }
          workerOtps.set(cleanEmail, {
            code: otp,
            expiresAt,
            attempts: 0,
            createdAt: Date.now()
          });
          return jsonResponse({
            success: true,
            message: "Verification code sent to your email."
          });
        } catch (err) {
          return jsonResponse({ success: false, error: err?.message || "Internal server error." }, 500);
        }
      }
      if (url.pathname === "/api/auth/verify-code" && request.method === "POST") {
        try {
          const body = await request.json();
          const { email, code } = body || {};
          if (!email || !code) {
            return jsonResponse({ success: false, error: "Email and verification code are required." }, 400);
          }
          const cleanEmail = email.toString().trim().toLowerCase();
          const cleanCode = code.toString().trim();
          const record = workerOtps.get(cleanEmail);
          if (!record) {
            return jsonResponse({
              success: false,
              error: "No active verification code found for this email. Please request a new code."
            }, 400);
          }
          if (Date.now() > record.expiresAt) {
            workerOtps.delete(cleanEmail);
            return jsonResponse({
              success: false,
              error: "Verification code has expired. Please request a new code."
            }, 400);
          }
          if (record.attempts >= 5) {
            workerOtps.delete(cleanEmail);
            return jsonResponse({
              success: false,
              error: "Too many failed attempts. Please request a new code."
            }, 400);
          }
          if (record.code !== cleanCode) {
            record.attempts += 1;
            return jsonResponse({
              success: false,
              error: "Invalid verification code. Please check the code and try again."
            }, 400);
          }
          workerOtps.delete(cleanEmail);
          return jsonResponse({
            success: true,
            message: "Email verified successfully."
          });
        } catch (err) {
          return jsonResponse({ success: false, error: err?.message || "Internal server error." }, 500);
        }
      }
      if (url.pathname === "/api/auth/register" && request.method === "POST") {
        try {
          const body = await request.json();
          const { name, email, password, roleTitle, department, avatarGradient, systemRole, status, id } = body || {};
          if (!name || typeof name !== "string" || !name.trim()) {
            return jsonResponse({ success: false, error: "Full name is required." }, 400);
          }
          if (!email || typeof email !== "string" || !email.trim()) {
            return jsonResponse({ success: false, error: "Email address is required." }, 400);
          }
          const cleanEmail = email.trim().toLowerCase();
          if (!/\S+@\S+\.\S+/.test(cleanEmail)) {
            return jsonResponse({ success: false, error: "A valid email address is required." }, 400);
          }
          const existingUser = await env2.DB.prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1").bind(cleanEmail).first();
          if (existingUser) {
            return jsonResponse({
              success: false,
              error: "This email is already registered. Please sign in instead."
            }, 409);
          }
          const now = (/* @__PURE__ */ new Date()).toISOString();
          const userId = id && typeof id === "string" && id.trim() ? id.trim() : `usr_reg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const passwordHash = password ? await hashPassword(password) : null;
          const userStatus = status === "Disabled" ? "Disabled" : "Active";
          const userRoleTitle = roleTitle || "Financial Member";
          const userDept = department || "Personal Workspace";
          const userGradient = avatarGradient || "from-blue-600 to-indigo-600";
          const userSystemRole = systemRole === "Admin" ? "Admin" : "User";
          try {
            await env2.DB.prepare(`
              INSERT INTO users (
                id, name, email, password_hash, system_role, role,
                title, role_title, department, avatar_gradient, status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                email = excluded.email,
                system_role = excluded.system_role,
                role = excluded.role,
                title = excluded.title,
                role_title = excluded.role_title,
                department = excluded.department,
                avatar_gradient = excluded.avatar_gradient,
                status = excluded.status,
                updated_at = excluded.updated_at
            `).bind(
              userId,
              name.trim(),
              cleanEmail,
              passwordHash,
              userSystemRole,
              "User Member",
              userRoleTitle,
              userRoleTitle,
              userDept,
              userGradient,
              userStatus,
              now,
              now
            ).run();
          } catch (insertErr) {
            console.warn("[D1 Register Fallback]", insertErr?.message);
            await env2.DB.prepare(`
              INSERT INTO users (
                id, name, email, password_hash, system_role, role,
                title, department, avatar_gradient, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                email = excluded.email,
                system_role = excluded.system_role,
                role = excluded.role,
                title = excluded.title,
                department = excluded.department,
                avatar_gradient = excluded.avatar_gradient,
                updated_at = excluded.updated_at
            `).bind(
              userId,
              name.trim(),
              cleanEmail,
              passwordHash,
              userSystemRole,
              "User Member",
              userRoleTitle,
              userDept,
              userGradient,
              now,
              now
            ).run();
          }
          return jsonResponse({
            success: true,
            user: {
              id: userId,
              name: name.trim(),
              email: cleanEmail,
              systemRole: userSystemRole,
              role: "User Member",
              roleTitle: userRoleTitle,
              title: userRoleTitle,
              department: userDept,
              avatarGradient: userGradient,
              status: userStatus,
              createdAt: now,
              updatedAt: now
            }
          }, 201);
        } catch (err) {
          console.error("[Register API Error]", err);
          return jsonResponse({ success: false, error: err?.message || "Failed to complete registration." }, 500);
        }
      }
      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        try {
          const body = await request.json();
          const { email, password } = body || {};
          if (!email || typeof email !== "string" || !email.trim()) {
            return jsonResponse({ success: false, error: "Email address is required." }, 400);
          }
          if (!password || typeof password !== "string") {
            return jsonResponse({ success: false, error: "Password is required." }, 400);
          }
          const cleanEmail = email.trim().toLowerCase();
          let user = null;
          try {
            user = await env2.DB.prepare(`
              SELECT id, name, email, password_hash, system_role, role, title,
                     role_title, department, avatar_gradient, avatar_url, monthly_budget,
                     status, created_at, updated_at
              FROM users
              WHERE LOWER(email) = LOWER(?)
              LIMIT 1
            `).bind(cleanEmail).first();
          } catch (queryErr) {
            console.warn("[D1 Login Query Fallback]", queryErr?.message);
            user = await env2.DB.prepare(`
              SELECT id, name, email, password_hash, system_role, role, title,
                     department, avatar_gradient, created_at, updated_at
              FROM users
              WHERE LOWER(email) = LOWER(?)
              LIMIT 1
            `).bind(cleanEmail).first();
          }
          if (!user) {
            return jsonResponse({
              success: false,
              error: "No account found with this email address."
            }, 404);
          }
          if (user.status === "Disabled") {
            return jsonResponse({
              success: false,
              error: "This user account has been disabled. Please contact the administrator."
            }, 403);
          }
          const submittedHash = await hashPassword(password);
          if (user.password_hash && user.password_hash !== submittedHash) {
            return jsonResponse({
              success: false,
              error: "Invalid email or password. Please try again."
            }, 401);
          }
          const userSystemRole = user.system_role === "Admin" ? "Admin" : "User";
          const userRoleTitle = user.role_title || user.title || (userSystemRole === "Admin" ? "Super Administrator" : "Financial Member");
          const userBudget = user.monthly_budget !== null && user.monthly_budget !== void 0 ? Number(user.monthly_budget) : 25e3;
          return jsonResponse({
            success: true,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              systemRole: userSystemRole,
              role: userSystemRole === "Admin" ? userRoleTitle : "User Member",
              title: userRoleTitle,
              roleTitle: userRoleTitle,
              department: user.department || (userSystemRole === "Admin" ? "Management" : "Personal Workspace"),
              avatarGradient: user.avatar_gradient || "from-emerald-500 to-teal-500",
              avatarUrl: user.avatar_url || null,
              status: user.status || "Active",
              createdAt: user.created_at,
              updatedAt: user.updated_at,
              monthlyBudget: userBudget,
              liquidityLimit: userBudget,
              currentLiquidity: 0,
              monthlyBurnRate: 0
            }
          }, 200);
        } catch (err) {
          console.error("[Login API Error]", err);
          return jsonResponse({ success: false, error: err?.message || "Authentication failed." }, 500);
        }
      }
      if (url.pathname === "/api/auth/profile" && request.method === "GET") {
        try {
          const authHeader = request.headers.get("Authorization") || "";
          const headerUserId = request.headers.get("X-User-Id") || "";
          const headerUserEmail = (request.headers.get("X-User-Email") || "").trim().toLowerCase();
          const queryUserId = url.searchParams.get("userId") || "";
          const queryEmail = (url.searchParams.get("email") || "").trim().toLowerCase();
          let targetUserId = headerUserId || queryUserId;
          let targetEmail = headerUserEmail || queryEmail;
          if (!targetUserId && authHeader.startsWith("Bearer ")) {
            const tokenVal = authHeader.substring(7).trim();
            if (tokenVal.startsWith("usr_")) {
              targetUserId = tokenVal;
            }
          }
          if (!targetUserId && !targetEmail) {
            return jsonResponse({ success: false, error: "Unauthorized: User identifier required." }, 401);
          }
          let user = null;
          try {
            if (targetUserId) {
              user = await env2.DB.prepare(`
                SELECT id, name, email, system_role, role, title, role_title, department,
                       avatar_gradient, avatar_url, monthly_budget, status, created_at, updated_at
                FROM users WHERE id = ? LIMIT 1
              `).bind(targetUserId).first();
            } else {
              user = await env2.DB.prepare(`
                SELECT id, name, email, system_role, role, title, role_title, department,
                       avatar_gradient, avatar_url, monthly_budget, status, created_at, updated_at
                FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1
              `).bind(targetEmail).first();
            }
          } catch (queryErr) {
            if (targetUserId) {
              user = await env2.DB.prepare(`
                SELECT id, name, email, system_role, role, title, department,
                       avatar_gradient, created_at, updated_at
                FROM users WHERE id = ? LIMIT 1
              `).bind(targetUserId).first();
            } else {
              user = await env2.DB.prepare(`
                SELECT id, name, email, system_role, role, title, department,
                       avatar_gradient, created_at, updated_at
                FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1
              `).bind(targetEmail).first();
            }
          }
          if (!user) {
            return jsonResponse({ success: false, error: "User profile not found." }, 404);
          }
          const userSystemRole = user.system_role === "Admin" ? "Admin" : "User";
          const userRoleTitle = user.role_title || user.title || (userSystemRole === "Admin" ? "Super Administrator" : "Financial Member");
          const budget = user.monthly_budget !== null && user.monthly_budget !== void 0 ? Number(user.monthly_budget) : 25e3;
          return jsonResponse({
            success: true,
            source: "Cloudflare D1",
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              systemRole: userSystemRole,
              role: userSystemRole === "Admin" ? userRoleTitle : "User Member",
              title: userRoleTitle,
              roleTitle: userRoleTitle,
              department: user.department || (userSystemRole === "Admin" ? "Management" : "Personal Workspace"),
              avatarGradient: user.avatar_gradient || "from-emerald-500 to-teal-500",
              avatarUrl: user.avatar_url || null,
              monthlyBudget: budget,
              liquidityLimit: budget,
              status: user.status || "Active",
              createdAt: user.created_at,
              updatedAt: user.updated_at,
              currentLiquidity: 0,
              monthlyBurnRate: 0
            }
          });
        } catch (err) {
          console.error("[Profile GET API Error]", err);
          return jsonResponse({ success: false, error: err?.message || "Failed to retrieve profile." }, 500);
        }
      }
      if (url.pathname === "/api/auth/profile" && request.method === "PATCH") {
        try {
          const authHeader = request.headers.get("Authorization") || "";
          const headerUserId = request.headers.get("X-User-Id") || "";
          const headerUserEmail = (request.headers.get("X-User-Email") || "").trim().toLowerCase();
          const body = await request.json();
          const { userId: bodyUserId, email: bodyEmail, avatarUrl, monthlyBudget, liquidityLimit } = body || {};
          let targetUserId = headerUserId || bodyUserId || "";
          let targetEmail = headerUserEmail || bodyEmail || "";
          if (!targetUserId && authHeader.startsWith("Bearer ")) {
            const tokenVal = authHeader.substring(7).trim();
            if (tokenVal.startsWith("usr_")) {
              targetUserId = tokenVal;
            }
          }
          if (!targetUserId && !targetEmail) {
            return jsonResponse({ success: false, error: "Unauthorized: User authentication required." }, 401);
          }
          if (headerUserId && bodyUserId && headerUserId !== bodyUserId) {
            return jsonResponse({ success: false, error: "Forbidden: Cannot modify another user profile." }, 403);
          }
          let existingUser = null;
          try {
            if (targetUserId) {
              existingUser = await env2.DB.prepare("SELECT * FROM users WHERE id = ? LIMIT 1").bind(targetUserId).first();
            } else {
              existingUser = await env2.DB.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1").bind(targetEmail).first();
            }
          } catch (e) {
            console.warn("[D1 Existing User Query Error]", e?.message);
          }
          if (!existingUser) {
            return jsonResponse({ success: false, error: "User account not found." }, 404);
          }
          if (existingUser.status === "Disabled") {
            return jsonResponse({ success: false, error: "This user account has been disabled." }, 403);
          }
          const resolvedUserId = existingUser.id;
          const now = (/* @__PURE__ */ new Date()).toISOString();
          let newAvatarUrl = existingUser.avatar_url || null;
          if (avatarUrl !== void 0) {
            newAvatarUrl = avatarUrl && typeof avatarUrl === "string" && avatarUrl.trim() ? avatarUrl.trim() : null;
          }
          let newMonthlyBudget = existingUser.monthly_budget !== null && existingUser.monthly_budget !== void 0 ? Number(existingUser.monthly_budget) : 25e3;
          const budgetCandidate = monthlyBudget !== void 0 ? monthlyBudget : liquidityLimit;
          if (budgetCandidate !== void 0 && budgetCandidate !== null) {
            const parsed = Number(budgetCandidate);
            if (!isNaN(parsed) && parsed >= 0) {
              newMonthlyBudget = Math.round(parsed);
            }
          }
          try {
            await env2.DB.prepare(`
              UPDATE users
              SET avatar_url = ?,
                  monthly_budget = ?,
                  updated_at = ?
              WHERE id = ?
            `).bind(newAvatarUrl, newMonthlyBudget, now, resolvedUserId).run();
          } catch (updateErr) {
            console.warn("[D1 Profile Update Fallback]", updateErr?.message);
            try {
              await env2.DB.prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT").run();
            } catch {
            }
            try {
              await env2.DB.prepare("ALTER TABLE users ADD COLUMN monthly_budget REAL DEFAULT 25000").run();
            } catch {
            }
            await env2.DB.prepare(`
              UPDATE users
              SET avatar_url = ?,
                  monthly_budget = ?,
                  updated_at = ?
              WHERE id = ?
            `).bind(newAvatarUrl, newMonthlyBudget, now, resolvedUserId).run();
          }
          let updatedUser = null;
          try {
            updatedUser = await env2.DB.prepare(`
              SELECT id, name, email, system_role, role, title, role_title, department,
                     avatar_gradient, avatar_url, monthly_budget, status, created_at, updated_at
              FROM users WHERE id = ? LIMIT 1
            `).bind(resolvedUserId).first();
          } catch {
          }
          if (!updatedUser) {
            updatedUser = {
              ...existingUser,
              avatar_url: newAvatarUrl,
              monthly_budget: newMonthlyBudget,
              updated_at: now
            };
          }
          const userSystemRole = updatedUser.system_role === "Admin" ? "Admin" : "User";
          const userRoleTitle = updatedUser.role_title || updatedUser.title || (userSystemRole === "Admin" ? "Super Administrator" : "Financial Member");
          const finalBudget = updatedUser.monthly_budget !== null && updatedUser.monthly_budget !== void 0 ? Number(updatedUser.monthly_budget) : newMonthlyBudget;
          return jsonResponse({
            success: true,
            source: "Cloudflare D1",
            message: "Profile updated successfully in Cloudflare D1.",
            user: {
              id: updatedUser.id,
              name: updatedUser.name,
              // Protected: preserved from authoritative record
              email: updatedUser.email,
              // Protected: preserved from authoritative record
              systemRole: userSystemRole,
              // Protected: preserved
              role: userSystemRole === "Admin" ? userRoleTitle : "User Member",
              title: userRoleTitle,
              roleTitle: userRoleTitle,
              department: updatedUser.department || (userSystemRole === "Admin" ? "Management" : "Personal Workspace"),
              avatarGradient: updatedUser.avatar_gradient || "from-emerald-500 to-teal-500",
              avatarUrl: updatedUser.avatar_url || newAvatarUrl,
              monthlyBudget: finalBudget,
              liquidityLimit: finalBudget,
              status: updatedUser.status || "Active",
              createdAt: updatedUser.created_at,
              updatedAt: updatedUser.updated_at,
              currentLiquidity: 0,
              monthlyBurnRate: 0
            }
          }, 200);
        } catch (err) {
          console.error("[Profile PATCH API Error]", err);
          return jsonResponse({ success: false, error: err?.message || "Failed to update profile." }, 500);
        }
      }
      if (url.pathname === "/api/admin/users" && request.method === "GET") {
        try {
          const authHeader = request.headers.get("Authorization") || "";
          const adminEmail = (request.headers.get("X-Admin-Email") || "").trim().toLowerCase();
          const isFixedAdmin = authHeader === "Bearer Admin@Tallix2026!" || authHeader.includes("Admin@Tallix2026!") || adminEmail === "abdulatiflemon@gmail.com" && authHeader.length > 5;
          if (!isFixedAdmin) {
            return jsonResponse({ success: false, error: "Unauthorized: Administrative credentials required." }, 401);
          }
          let usersRes;
          try {
            usersRes = await env2.DB.prepare(`
              SELECT id, name, email, system_role, role, title, role_title, department, avatar_gradient, status, created_at, updated_at
              FROM users
              ORDER BY created_at DESC
            `).all();
          } catch {
            usersRes = await env2.DB.prepare(`
              SELECT id, name, email, system_role, role, title, department, avatar_gradient, created_at, updated_at
              FROM users
              ORDER BY created_at DESC
            `).all();
          }
          const sanitizedUsers = (usersRes.results || []).map((row) => ({
            id: row.id,
            name: row.name,
            email: row.email,
            systemRole: row.system_role || "User",
            role: row.role || "User Member",
            roleTitle: row.role_title || row.title || "Financial Member",
            title: row.title || row.role_title || "Financial Member",
            department: row.department || "Personal Workspace",
            avatarGradient: row.avatar_gradient || "from-blue-600 to-indigo-600",
            avatarUrl: row.avatar_url || void 0,
            monthlyBudget: row.monthly_budget !== null && row.monthly_budget !== void 0 ? Number(row.monthly_budget) : 25e3,
            liquidityLimit: row.monthly_budget !== null && row.monthly_budget !== void 0 ? Number(row.monthly_budget) : 25e3,
            status: row.status || "Active",
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }));
          return jsonResponse({
            success: true,
            source: "Cloudflare D1",
            count: sanitizedUsers.length,
            users: sanitizedUsers
          });
        } catch (err) {
          console.error("[Admin Users API Error]", err);
          return jsonResponse({ success: false, error: err?.message || "Failed to retrieve admin users." }, 500);
        }
      }
      if (url.pathname === "/api/admin/db-verify" && request.method === "GET") {
        try {
          const countRes = await env2.DB.prepare("SELECT COUNT(*) as total FROM users").first();
          const recentUsers = await env2.DB.prepare("SELECT id, name, email, status, created_at FROM users ORDER BY created_at DESC LIMIT 5").all();
          return jsonResponse({
            success: true,
            database: "Cloudflare D1 (tallix-db)",
            totalUsers: countRes?.total ?? 0,
            recentUsers: recentUsers?.results || [],
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        } catch (err) {
          return jsonResponse({ success: false, error: err?.message }, 500);
        }
      }
      if (url.pathname === "/api/sync/push" && request.method === "POST") {
        const body = await request.json();
        if (!body || !Array.isArray(body.mutations)) {
          return jsonResponse({ success: false, error: "Invalid payload" }, 400);
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const processedMutationIds = [];
        const failedMutations = [];
        for (const mut of body.mutations) {
          try {
            const existing = await env2.DB.prepare(
              "SELECT mutation_id FROM processed_mutations WHERE mutation_id = ?"
            ).bind(mut.mutationId).first();
            if (existing) {
              processedMutationIds.push(mut.mutationId);
              continue;
            }
            if (mut.entityType === "expense") {
              const exp = mut.payload;
              if (mut.operation === "CREATE" || mut.operation === "UPDATE") {
                const orig = exp.originalAmount !== void 0 ? exp.originalAmount : exp.amount;
                const paisa = typeof exp.amount_paisa === "number" && Number.isInteger(exp.amount_paisa) ? exp.amount_paisa : (() => {
                  const s = String(orig || 0).trim();
                  const parts = s.split(".");
                  const whole = parseInt(parts[0].replace(/\D/g, "") || "0", 10);
                  const frac = parseInt((parts[1] ? parts[1].replace(/\D/g, "") + "00" : "00").slice(0, 2), 10);
                  return (s.startsWith("-") ? -1 : 1) * (whole * 100 + frac);
                })();
                const amount = !isNaN(Number(orig)) ? Number(orig) : paisa / 100;
                await env2.DB.prepare(`
                  INSERT INTO expenses (
                    id, group_id, group_name, is_shared, title, merchant,
                    amount, amount_paisa, currency, category, payment_method,
                    date, status, paid_by_user_id, paid_by_name, created_by,
                    created_by_email, splits_json, receipt_url, notes,
                    version, created_at, updated_at, deleted_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
                  ON CONFLICT(id) DO UPDATE SET
                    group_id = excluded.group_id,
                    group_name = excluded.group_name,
                    is_shared = excluded.is_shared,
                    title = excluded.title,
                    merchant = excluded.merchant,
                    amount = excluded.amount,
                    amount_paisa = excluded.amount_paisa,
                    currency = excluded.currency,
                    category = excluded.category,
                    payment_method = excluded.payment_method,
                    date = excluded.date,
                    status = excluded.status,
                    paid_by_user_id = excluded.paid_by_user_id,
                    paid_by_name = excluded.paid_by_name,
                    splits_json = excluded.splits_json,
                    notes = excluded.notes,
                    version = version + 1,
                    updated_at = excluded.updated_at,
                    deleted_at = NULL
                `).bind(
                  exp.id,
                  exp.groupId || null,
                  exp.groupName || null,
                  exp.isShared ? 1 : 0,
                  exp.title || "Expense",
                  exp.merchant || null,
                  amount,
                  paisa,
                  exp.currency || "BDT",
                  exp.category || "General",
                  exp.paymentMethod || "Cash",
                  exp.date || now.split("T")[0],
                  exp.status || "Completed",
                  exp.paidByUserId,
                  exp.paidByName || null,
                  exp.createdBy || null,
                  exp.createdByEmail || null,
                  exp.splits ? JSON.stringify(exp.splits) : null,
                  exp.receiptUrl || null,
                  exp.notes || null,
                  exp.version || 1,
                  exp.createdAt || now,
                  now
                ).run();
              } else if (mut.operation === "DELETE") {
                await env2.DB.prepare("UPDATE expenses SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(now, now, mut.entityId).run();
              }
            } else if (mut.entityType === "group") {
              const grp = mut.payload;
              if (mut.operation === "CREATE" || mut.operation === "UPDATE") {
                await env2.DB.prepare(`
                  INSERT INTO groups (
                    id, name, description, category, currency, invite_code,
                    image_url, created_by, members_json, total_spent,
                    unsettled_amount, version, created_at, updated_at, deleted_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
                  ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    category = excluded.category,
                    currency = excluded.currency,
                    image_url = excluded.image_url,
                    members_json = excluded.members_json,
                    total_spent = excluded.total_spent,
                    unsettled_amount = excluded.unsettled_amount,
                    version = version + 1,
                    updated_at = excluded.updated_at,
                    deleted_at = NULL
                `).bind(
                  grp.id,
                  grp.name,
                  grp.description || "",
                  grp.category || "General",
                  grp.currency || "BDT",
                  grp.inviteCode || null,
                  grp.imageUrl || null,
                  grp.createdBy || null,
                  JSON.stringify(grp.members || []),
                  grp.totalSpent || 0,
                  grp.unsettledAmount || 0,
                  grp.version || 1,
                  grp.createdAt || now,
                  now
                ).run();
              } else if (mut.operation === "DELETE") {
                await env2.DB.prepare("UPDATE groups SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(now, now, mut.entityId).run();
              }
            } else if (mut.entityType === "settlement") {
              const stl = mut.payload;
              if (mut.operation === "CREATE" || mut.operation === "UPDATE") {
                const orig = stl.originalAmount !== void 0 ? stl.originalAmount : stl.amount;
                const paisa = typeof stl.amount_paisa === "number" && Number.isInteger(stl.amount_paisa) ? stl.amount_paisa : (() => {
                  const s = String(orig || 0).trim();
                  const parts = s.split(".");
                  const whole = parseInt(parts[0].replace(/\D/g, "") || "0", 10);
                  const frac = parseInt((parts[1] ? parts[1].replace(/\D/g, "") + "00" : "00").slice(0, 2), 10);
                  return (s.startsWith("-") ? -1 : 1) * (whole * 100 + frac);
                })();
                const amount = !isNaN(Number(orig)) ? Number(orig) : paisa / 100;
                await env2.DB.prepare(`
                  INSERT INTO settlements (
                    id, group_id, group_name, from_user_id, from_user_name,
                    to_user_id, to_user_name, amount, amount_paisa, currency,
                    payment_method, status, proof_url, note, version,
                    created_at, updated_at, deleted_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
                  ON CONFLICT(id) DO UPDATE SET
                    group_id = excluded.group_id,
                    group_name = excluded.group_name,
                    from_user_id = excluded.from_user_id,
                    from_user_name = excluded.from_user_name,
                    to_user_id = excluded.to_user_id,
                    to_user_name = excluded.to_user_name,
                    amount = excluded.amount,
                    amount_paisa = excluded.amount_paisa,
                    currency = excluded.currency,
                    payment_method = excluded.payment_method,
                    status = excluded.status,
                    proof_url = excluded.proof_url,
                    note = excluded.note,
                    version = version + 1,
                    updated_at = excluded.updated_at,
                    deleted_at = NULL
                `).bind(
                  stl.id,
                  stl.groupId || null,
                  stl.groupName || null,
                  stl.fromUserId,
                  stl.fromUserName || null,
                  stl.toUserId,
                  stl.toUserName || null,
                  amount,
                  paisa,
                  stl.currency || "BDT",
                  stl.paymentMethod || "bKash",
                  stl.status || "Pending",
                  stl.proofUrl || null,
                  stl.note || null,
                  stl.version || 1,
                  stl.createdAt || now,
                  now
                ).run();
              } else if (mut.operation === "DELETE") {
                await env2.DB.prepare("UPDATE settlements SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(now, now, mut.entityId).run();
              }
            } else if (mut.entityType === "registeredUser") {
              const usr = mut.payload;
              if (mut.operation === "CREATE" || mut.operation === "UPDATE") {
                const userStatus = usr.status === "Disabled" ? "Disabled" : "Active";
                const userRoleTitle = usr.roleTitle || usr.title || "Financial Member";
                const cleanEmail = (usr.email || "").trim().toLowerCase();
                const pwdHash = usr.passwordHash || (usr.password ? await hashPassword(usr.password) : null);
                const avatarVal = usr.avatarUrl !== void 0 ? usr.avatarUrl || null : usr.avatar_url !== void 0 ? usr.avatar_url || null : null;
                const rawBudget = usr.monthlyBudget !== void 0 ? usr.monthlyBudget : usr.liquidityLimit !== void 0 ? usr.liquidityLimit : usr.monthly_budget;
                const budgetVal = rawBudget !== void 0 && rawBudget !== null ? Number(rawBudget) : 25e3;
                try {
                  await env2.DB.prepare(`
                    INSERT INTO users (
                      id, name, email, password_hash, system_role, role,
                      title, role_title, department, avatar_gradient, avatar_url, monthly_budget, status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                      name = excluded.name,
                      email = excluded.email,
                      system_role = excluded.system_role,
                      role = excluded.role,
                      title = excluded.title,
                      role_title = excluded.role_title,
                      department = excluded.department,
                      avatar_gradient = excluded.avatar_gradient,
                      avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
                      monthly_budget = COALESCE(excluded.monthly_budget, users.monthly_budget),
                      status = excluded.status,
                      updated_at = excluded.updated_at
                  `).bind(
                    usr.id,
                    usr.name || "User",
                    cleanEmail,
                    pwdHash,
                    usr.systemRole || "User",
                    usr.role || "User Member",
                    userRoleTitle,
                    userRoleTitle,
                    usr.department || "Personal Workspace",
                    usr.avatarGradient || "from-blue-600 to-indigo-600",
                    avatarVal,
                    budgetVal,
                    userStatus,
                    usr.createdAt || now,
                    now
                  ).run();
                } catch {
                  try {
                    await env2.DB.prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT").run();
                  } catch {
                  }
                  try {
                    await env2.DB.prepare("ALTER TABLE users ADD COLUMN monthly_budget REAL DEFAULT 25000").run();
                  } catch {
                  }
                  await env2.DB.prepare(`
                    INSERT INTO users (
                      id, name, email, password_hash, system_role, role,
                      title, role_title, department, avatar_gradient, status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                      name = excluded.name,
                      email = excluded.email,
                      system_role = excluded.system_role,
                      role = excluded.role,
                      title = excluded.title,
                      role_title = excluded.role_title,
                      department = excluded.department,
                      avatar_gradient = excluded.avatar_gradient,
                      status = excluded.status,
                      updated_at = excluded.updated_at
                  `).bind(
                    usr.id,
                    usr.name || "User",
                    cleanEmail,
                    pwdHash,
                    usr.systemRole || "User",
                    usr.role || "User Member",
                    userRoleTitle,
                    userRoleTitle,
                    usr.department || "Personal Workspace",
                    usr.avatarGradient || "from-blue-600 to-indigo-600",
                    userStatus,
                    usr.createdAt || now,
                    now
                  ).run();
                }
              } else if (mut.operation === "DELETE") {
                await env2.DB.prepare("DELETE FROM users WHERE id = ?").bind(mut.entityId).run();
              }
            }
            await env2.DB.prepare(`
              INSERT INTO processed_mutations (
                mutation_id, client_device_id, user_id, entity_type,
                entity_id, operation, processed_at, result_json
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              mut.mutationId,
              body.clientDeviceId,
              body.userId,
              mut.entityType,
              mut.entityId,
              mut.operation,
              now,
              JSON.stringify({ success: true })
            ).run();
            processedMutationIds.push(mut.mutationId);
          } catch (err) {
            console.error("[Worker Sync Push Error]", err);
            failedMutations.push({
              mutationId: mut.mutationId,
              error: err?.message || "Failed to process mutation"
            });
          }
        }
        return jsonResponse({
          success: true,
          processedMutationIds,
          failedMutations,
          serverTimestamp: now
        });
      }
      if (url.pathname === "/api/sync/pull" && request.method === "GET") {
        const rawSince = url.searchParams.get("since");
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const since = rawSince ? new Date(Math.max(0, new Date(rawSince).getTime() - 1e4)).toISOString() : null;
        const expensesStmt = since ? env2.DB.prepare("SELECT * FROM expenses WHERE updated_at >= ?").bind(since) : env2.DB.prepare("SELECT * FROM expenses");
        const groupsStmt = since ? env2.DB.prepare("SELECT * FROM groups WHERE updated_at >= ?").bind(since) : env2.DB.prepare("SELECT * FROM groups");
        const settlementsStmt = since ? env2.DB.prepare("SELECT * FROM settlements WHERE updated_at >= ?").bind(since) : env2.DB.prepare("SELECT * FROM settlements");
        const usersStmt = since ? env2.DB.prepare("SELECT * FROM users WHERE updated_at >= ?").bind(since) : env2.DB.prepare("SELECT * FROM users");
        const [expensesRes, groupsRes, settlementsRes, usersRes] = await Promise.all([
          expensesStmt.all(),
          groupsStmt.all(),
          settlementsStmt.all(),
          usersStmt.all()
        ]);
        const activeExpenses = [];
        const deletedExpenseIds = [];
        (expensesRes.results || []).forEach((row) => {
          if (row.deleted_at) {
            deletedExpenseIds.push(row.id);
          } else {
            activeExpenses.push({
              id: row.id,
              groupId: row.group_id,
              groupName: row.group_name,
              isShared: Boolean(row.is_shared),
              title: row.title,
              merchant: row.merchant,
              amount: row.amount,
              originalAmount: row.amount,
              amount_paisa: row.amount_paisa,
              currency: row.currency || "BDT",
              category: row.category,
              paymentMethod: row.payment_method,
              date: row.date,
              status: row.status,
              paidByUserId: row.paid_by_user_id,
              paidByName: row.paid_by_name,
              createdBy: row.created_by,
              createdByEmail: row.created_by_email,
              splits: row.splits_json ? JSON.parse(row.splits_json) : void 0,
              receiptUrl: row.receipt_url,
              notes: row.notes,
              version: row.version,
              createdAt: row.created_at,
              updatedAt: row.updated_at
            });
          }
        });
        const activeGroups = [];
        const deletedGroupIds = [];
        (groupsRes.results || []).forEach((row) => {
          if (row.deleted_at) {
            deletedGroupIds.push(row.id);
          } else {
            activeGroups.push({
              ...row,
              members: row.members_json ? JSON.parse(row.members_json) : [],
              inviteCode: row.invite_code,
              imageUrl: row.image_url,
              totalSpent: row.total_spent,
              unsettledAmount: row.unsettled_amount
            });
          }
        });
        const activeSettlements = [];
        const deletedSettlementIds = [];
        (settlementsRes.results || []).forEach((row) => {
          if (row.deleted_at) {
            deletedSettlementIds.push(row.id);
          } else {
            activeSettlements.push({
              ...row,
              groupId: row.group_id,
              groupName: row.group_name,
              fromUserId: row.from_user_id,
              fromUserName: row.from_user_name,
              toUserId: row.to_user_id,
              toUserName: row.to_user_name,
              paymentMethod: row.payment_method
            });
          }
        });
        const activeUsers = (usersRes.results || []).map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          systemRole: row.system_role || "User",
          role: row.role || "User Member",
          roleTitle: row.role_title || row.title || "Financial Member",
          title: row.title || row.role_title || "Financial Member",
          department: row.department || "Personal Workspace",
          avatarGradient: row.avatar_gradient || "from-blue-600 to-indigo-600",
          avatarUrl: row.avatar_url || void 0,
          monthlyBudget: row.monthly_budget !== null && row.monthly_budget !== void 0 ? Number(row.monthly_budget) : 25e3,
          liquidityLimit: row.monthly_budget !== null && row.monthly_budget !== void 0 ? Number(row.monthly_budget) : 25e3,
          status: row.status || "Active",
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }));
        return jsonResponse({
          success: true,
          serverTimestamp: now,
          expenses: activeExpenses,
          groups: activeGroups,
          settlements: activeSettlements,
          registeredUsers: activeUsers,
          deletedExpenseIds,
          deletedGroupIds,
          deletedSettlementIds
        });
      }
      if (url.pathname === "/api/audit-logs" && request.method === "GET") {
        try {
          const logsRes = await env2.DB.prepare("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100").all();
          return jsonResponse({ logs: logsRes.results || [] });
        } catch {
          return jsonResponse({ logs: [] });
        }
      }
      if (!url.pathname.startsWith("/api/") && env2.ASSETS) {
        const assetRes = await env2.ASSETS.fetch(request);
        if (assetRes.status === 404 && (request.method === "GET" || request.method === "HEAD") && !url.pathname.includes(".")) {
          const spaReqHtml = new Request(new URL("/index.html", request.url), request);
          const spaResHtml = await env2.ASSETS.fetch(spaReqHtml);
          if (spaResHtml.status === 200) {
            return spaResHtml;
          }
          const spaReq = new Request(new URL("/", request.url), request);
          return await env2.ASSETS.fetch(spaReq);
        }
        return assetRes;
      }
      return jsonResponse({ error: "Endpoint not found" }, 404);
    } catch (err) {
      console.error("[Worker Fatal Error]", err);
      return jsonResponse({ error: err.message || "Internal server error" }, 500);
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
