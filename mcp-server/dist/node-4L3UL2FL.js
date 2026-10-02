import { createRequire } from 'module'; const require = createRequire(import.meta.url);
import {
  AnthropicError,
  DEFAULT_MEMORY_SYNC_INTERVAL_MS,
  MIN_MEMORY_SYNC_INTERVAL_MS,
  ToolError,
  __classPrivateFieldGet,
  __classPrivateFieldSet,
  checkMemorySyncInterval,
  decodeUTF8,
  encodeUTF8,
  isStatus,
  loggerFor,
  promiseWithResolvers
} from "./chunk-MMWLM6BK.js";
import {
  child_process,
  crypto,
  fs,
  path,
  stream,
  util
} from "./chunk-NLLTJXF2.js";
import "./chunk-ZO3ASFWY.js";

// node_modules/@anthropic-ai/sdk/tools/agent-toolset/node.mjs
import * as fs4 from "fs/promises";
import * as fssync from "fs";
import * as path2 from "path";
import * as cp from "child_process";
import * as crypto2 from "crypto";
import * as readline from "readline";

// node_modules/@anthropic-ai/sdk/helpers/beta/json-schema.mjs
function betaTool(options) {
  if (options.inputSchema.type !== "object") {
    throw new Error(`JSON schema for tool "${options.name}" must be an object, but got ${options.inputSchema.type}`);
  }
  return {
    type: "custom",
    name: options.name,
    input_schema: options.inputSchema,
    description: options.description,
    run: options.run,
    parse: (content) => content,
    ...options.close ? { close: options.close } : {}
  };
}

// node_modules/@anthropic-ai/sdk/tools/agent-toolset/fs-util.mjs
var fs2 = fs.promises;
var DIR_CREATE_MODE = 493;
var FILE_CREATE_MODE = 420;
function isWithin(root, p) {
  const rel = path.relative(root, p);
  return rel === "" || !rel.startsWith(".." + path.sep) && rel !== ".." && !path.isAbsolute(rel);
}
async function containingRoot(roots, target) {
  for (const root of roots) {
    if (isWithin(await canonicalize(path.resolve(root)), target))
      return root;
  }
  return void 0;
}
var MAX_SYMLINK_HOPS = 40;
function errnoCode(err) {
  const code = err?.code;
  return typeof code === "string" ? code : void 0;
}
async function canonicalize(abs) {
  const tail = [];
  let prefix = abs;
  let hops = 0;
  for (; ; ) {
    let real;
    try {
      real = await fs2.realpath(prefix);
    } catch (realpathErr) {
      let isLink;
      try {
        isLink = (await fs2.lstat(prefix)).isSymbolicLink();
      } catch (lstatErr) {
        const code = errnoCode(lstatErr);
        if (code !== "ENOENT" && code !== "ENOTDIR")
          throw lstatErr;
        const parent = path.dirname(prefix);
        if (parent === prefix)
          throw lstatErr;
        tail.push(path.basename(prefix));
        prefix = parent;
        continue;
      }
      if (!isLink)
        throw realpathErr;
      if (++hops > MAX_SYMLINK_HOPS) {
        throw Object.assign(new Error("too many levels of symbolic links"), { code: "ELOOP" });
      }
      prefix = path.resolve(path.dirname(prefix), await fs2.readlink(prefix));
      continue;
    }
    return tail.length ? path.join(real, ...tail.reverse()) : real;
  }
}
async function confineToRoot(root, p, opts) {
  const allowedRoots = opts?.allowedRoots ?? [];
  const realRoot = await canonicalize(path.resolve(root));
  let real;
  try {
    real = await canonicalize(path.resolve(realRoot, p));
  } catch (err) {
    throw new ToolError(fsErrorMessage(err, `path ${JSON.stringify(p)}`));
  }
  if (isWithin(realRoot, real) || await containingRoot(allowedRoots, real) !== void 0) {
    return real;
  }
  const permitted = allowedRoots.length ? "the session's working directory and its other permitted directories" : "the session's working directory";
  throw new ToolError(`path ${JSON.stringify(p)} is outside ${permitted}`);
}
async function atomicWriteFile(targetPath, content) {
  const dir = path.dirname(targetPath);
  const tempPath = path.join(dir, `.tmp-${process.pid}-${crypto.randomUUID()}`);
  let handle;
  try {
    handle = await fs2.open(tempPath, "wx", FILE_CREATE_MODE);
    await handle.writeFile(content, "utf-8");
    await handle.sync();
    await handle.close();
    handle = void 0;
    await fs2.rename(tempPath, targetPath);
  } catch (err) {
    if (handle)
      await handle.close().catch(() => {
      });
    await fs2.unlink(tempPath).catch(() => {
    });
    throw err;
  }
}
function fsErrorMessage(err, file) {
  const code = errnoCode(err);
  switch (code) {
    case "ENOENT":
      return `${file}: no such file or directory`;
    case "EACCES":
    case "EPERM":
      return `${file}: permission denied`;
    case "ENOTDIR":
      return `${file}: not a directory`;
    case "EISDIR":
      return `${file}: is a directory`;
    case "ELOOP":
      return `${file}: too many levels of symbolic links`;
    case "ENAMETOOLONG":
      return `${file}: file name too long`;
    case "ENOSPC":
      return `${file}: no space left on device`;
    case "EMFILE":
    case "ENFILE":
      return `${file}: too many open files`;
    default:
      return `${file}: ${code !== void 0 ? `i/o error (${code})` : "i/o error"}`;
  }
}

// node_modules/@anthropic-ai/sdk/tools/agent-toolset/skills.mjs
var fs3 = fs.promises;
var execFileAsync = util.promisify(child_process.execFile);
async function setupSkills(ctx) {
  const { client, sessionId } = ctx;
  if (!client)
    return async () => {
    };
  const log = loggerFor(client);
  let session = ctx.session;
  if (!session) {
    if (sessionId === void 0)
      return async () => {
      };
    log.warn("AgentToolContext.sessionId is deprecated and costs an extra session fetch; fetch the session once and set `session` instead", { component: "agent-tool-context" });
    session = await client.beta.sessions.retrieve(sessionId);
  }
  const skillsRoot = path.resolve(ctx.workdir, "skills");
  const created = [];
  for (const skill of session.agent.skills) {
    try {
      const version = await client.beta.skills.versions.retrieve(skill.version, { skill_id: skill.skill_id });
      let dirname2 = path.basename(version.name.trim());
      if (dirname2 === "" || dirname2 === "." || dirname2 === "..")
        dirname2 = skill.skill_id;
      const dest = path.resolve(skillsRoot, dirname2);
      if (dest !== skillsRoot && !dest.startsWith(skillsRoot + path.sep)) {
        log.warn("skill name escapes the skills dir; skipping", {
          component: "agent-tool-context",
          name: version.name
        });
        continue;
      }
      const resp = await client.beta.skills.versions.download(version.id, { skill_id: skill.skill_id });
      await fs3.rm(dest, { recursive: true, force: true });
      await fs3.mkdir(dest, { recursive: true, mode: DIR_CREATE_MODE });
      created.push(dest);
      await extractSkillArchive(resp, dest);
      log.info("downloaded skill", {
        component: "agent-tool-context",
        skill_id: skill.skill_id,
        version: version.id,
        dest
      });
    } catch (e) {
      log.warn("failed to download skill", {
        component: "agent-tool-context",
        skill_id: skill.skill_id,
        error: String(e)
      });
    }
  }
  return async () => {
    for (const dest of created) {
      await fs3.rm(dest, { recursive: true, force: true }).catch((e) => {
        log.warn("failed to clean up skill", { component: "agent-tool-context", dest, error: String(e) });
      });
    }
  };
}
function assertSafeMemberNames(names) {
  for (const raw of names) {
    const entry = raw.trim();
    if (!entry)
      continue;
    if (path.isAbsolute(entry) || entry.split(/[\\/]/).includes("..")) {
      throw new AnthropicError(`refusing to extract unsafe archive member: ${entry}`);
    }
  }
}
var INCONSISTENT_LISTING = "skill archive listing is inconsistent; refusing to extract";
var PLAIN_TYPE_CHARS = { unzip: /* @__PURE__ */ new Set(["-", "d", "?"]), tar: /* @__PURE__ */ new Set(["-", "d", "C"]) };
function listingLines(listing) {
  const lines = listing.split("\n");
  if (lines[lines.length - 1] === "")
    lines.pop();
  return lines;
}
function canExcludeVerbatim(cmd, name) {
  return /^[\x20-\x7E]+$/.test(name) && !/[\\^#]/.test(name) && !(cmd === "unzip" && name.startsWith("-"));
}
function classifyArchiveListing(cmd, names, typed) {
  const nameLines = listingLines(names);
  const typedLines = listingLines(typed);
  if (nameLines.length !== typedLines.length)
    throw new AnthropicError(INCONSISTENT_LISTING);
  const plain = [];
  const special = [];
  nameLines.forEach((name, i) => {
    if (PLAIN_TYPE_CHARS[cmd].has(typedLines[i].charAt(0))) {
      plain.push(name);
      return;
    }
    if (!canExcludeVerbatim(cmd, name)) {
      throw new AnthropicError(`refusing to extract archive: cannot safely exclude member ${JSON.stringify(name)}`);
    }
    special.push(name);
  });
  return { plain, special };
}
async function assertOnlyPlainEntries(dir) {
  for (const entry of await fs3.readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory())
      await assertOnlyPlainEntries(path.join(dir, entry.name));
    else if (!entry.isFile())
      throw new AnthropicError(INCONSISTENT_LISTING);
  }
}
async function runArchiveTool(cmd, args) {
  try {
    const { stdout } = await execFileAsync(cmd, args);
    return stdout;
  } catch (e) {
    if (errnoCode(e) === "ENOENT") {
      throw new AnthropicError(`skill extraction requires the \`${cmd}\` command, but it was not found on PATH`);
    }
    throw e;
  }
}
function archiveTopDir(names) {
  let top;
  let nested = false;
  for (const raw of names) {
    const parts = raw.trim().split("/").filter((p) => p !== "" && p !== ".");
    if (parts.length === 0)
      continue;
    const first = parts[0];
    if (top === void 0)
      top = first;
    else if (first !== top)
      return "";
    if (parts.length > 1)
      nested = true;
  }
  return top !== void 0 && nested ? top : "";
}
async function extractSkillArchive(resp, dest) {
  const tmp = path.join(dest, `.skill-archive-${process.pid}-${Date.now()}`);
  if (!resp.body) {
    throw new AnthropicError("skill download response had no body");
  }
  await stream.promises.pipeline(stream.Readable.fromWeb(resp.body), fs.createWriteStream(tmp));
  const stage = path.join(path.dirname(dest), `.skill-stage-${process.pid}-${Date.now()}`);
  const excludeFile = path.join(path.dirname(dest), `.skill-exclude-${process.pid}-${Date.now()}`);
  try {
    const head = await readHead(tmp, 4);
    const isZip = head.length >= 4 && head[0] === 80 && head[1] === 75 && head[2] === 3 && head[3] === 4;
    const archiveCmd = isZip ? "unzip" : "tar";
    const names = await runArchiveTool(archiveCmd, isZip ? ["-Z1", tmp] : ["-tf", tmp]);
    const typed = await runArchiveTool(archiveCmd, isZip ? ["-Z", "--h", "--t", tmp] : ["-tvf", tmp]);
    const { plain, special } = classifyArchiveListing(archiveCmd, names, typed);
    assertSafeMemberNames([...plain, ...special]);
    const top = archiveTopDir(plain);
    await fs3.mkdir(stage, { recursive: true, mode: DIR_CREATE_MODE });
    if (plain.length > 0) {
      await runArchiveTool(archiveCmd, await extractArgs(archiveCmd, tmp, stage, special, excludeFile));
    }
    await assertOnlyPlainEntries(stage);
    const srcRoot = top ? path.join(stage, top) : stage;
    const entries = await fs3.readdir(srcRoot).catch((e) => {
      throw errnoCode(e) === "ENOENT" ? new AnthropicError(INCONSISTENT_LISTING) : e;
    });
    for (const entry of entries) {
      await fs3.rename(path.join(srcRoot, entry), path.join(dest, entry));
    }
  } finally {
    await fs3.rm(tmp, { force: true });
    await fs3.rm(excludeFile, { force: true });
    await fs3.rm(stage, { recursive: true, force: true });
  }
}
async function extractArgs(cmd, archive, stage, special, excludeFile) {
  const patterns = special.map((name) => name.replace(/[*?[\\]/g, "\\$&"));
  if (cmd === "unzip") {
    return ["-oq", archive, "-d", stage, ...patterns.length > 0 ? ["-x", ...patterns] : []];
  }
  if (patterns.length === 0)
    return ["-xf", archive, "-C", stage];
  await fs3.writeFile(excludeFile, patterns.join("\n") + "\n", { flag: "wx", mode: 384 });
  return ["-xf", archive, "-C", stage, "-X", excludeFile];
}
async function readHead(file, n) {
  const handle = await fs3.open(file, "r");
  try {
    const buf = Buffer.alloc(n);
    const { bytesRead } = await handle.read(buf, 0, n, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

// node_modules/@anthropic-ai/sdk/internal/file-store.mjs
var fsp = fs.promises;
var C = fs.constants;
var OWNER_ONLY_DIR_MODE = 448;
var OWNER_ONLY_FILE_MODE = 384;
var OWNER_ONLY_EXEC_MODE = 448;
var O_NOFOLLOW = C.O_NOFOLLOW ?? 0;
var O_NONBLOCK = C.O_NONBLOCK ?? 0;
var FileStoreError = class extends Error {
  constructor(reason, relPath) {
    super(`path ${JSON.stringify(relPath)} ${reason}`);
    this.name = "FileStoreError";
    this.reason = reason;
    this.relPath = relPath;
  }
};
FileStoreError.ESCAPES_ROOT = "escapes the store root";
FileStoreError.IS_A_SYMLINK = "is a symlink";
FileStoreError.NOT_A_FILE = "is not a regular file";
FileStoreError.NOT_A_DIRECTORY = "is not a directory";
FileStoreError.NOT_UTF8 = "is not valid utf-8";
FileStoreError.MOVE_DESTINATION_EXISTS = "already exists";
function isPathLegal(p) {
  return p.startsWith("/") && !p.split("/").includes("..");
}
var FileStore = class _FileStore {
  /** @internal — use {@link FileStore.open} / {@link openFileStore}. */
  constructor(root, removedOnDispose, utf8Only = false) {
    this.hashes = /* @__PURE__ */ new Map();
    this.rootPath = root;
    this.removedOnDispose = removedOnDispose;
    this.decoder = utf8Only ? new TextDecoder("utf-8", { fatal: true }) : void 0;
  }
  /** Resolve `root`; creates nothing — only {@link createRoot} makes the folder. */
  static async open(root, opts) {
    if (!platformSupported()) {
      throw new Error("FileStore requires O_NOFOLLOW support on this platform");
    }
    let removedOnDispose = false;
    try {
      await fsp.lstat(root);
    } catch (e) {
      if (e.code !== "ENOENT")
        throw e;
      removedOnDispose = true;
    }
    return new _FileStore(path.resolve(root), removedOnDispose, opts?.utf8 ?? false);
  }
  /** Create the root directory and any missing ancestors; already existing is fine. */
  async createRoot() {
    await makeDirAndAncestors(this.rootPath);
  }
  /** The resolved root, and what {@link dispose} will do to it. */
  root() {
    return { path: this.rootPath, removedOnDispose: this.removedOnDispose };
  }
  /**
   * Remove the root iff `open` created it; pre-existing roots are kept.
   *
   * Wired to `Symbol.asyncDispose` at runtime when the host provides it, so
   * `await using` works on engines with explicit resource management.
   */
  async dispose() {
    if (!this.removedOnDispose)
      return;
    await fsp.rm(this.rootPath, { recursive: true, force: true });
  }
  /**
   * Write `data` (`string` UTF-8 or bytes) atomically to the file at `relPath`.
   *
   * Missing directories below the root are created; a missing root is not —
   * the write fails with `ENOENT`.
   */
  async put(relPath, data, opts) {
    const tail = relPath.replace(/\\/g, "/");
    if (tail.endsWith("/") || tail.endsWith("/.") || tail === "" || tail === ".") {
      throw new FileStoreError(FileStoreError.NOT_A_FILE, relPath);
    }
    const dest = this.resolveUnderRoot(relPath);
    const payload = typeof data === "string" ? encodeUTF8(data) : data;
    this.requireUtf8(relPath, payload);
    await makeDirsBelowRoot(this.rootPath, path.dirname(dest));
    await replaceViaTemp(dest, payload, opts?.executable ?? false);
  }
  /** The file's bytes; `null` when absent. */
  async get(relPath) {
    const dest = this.resolveUnderRoot(relPath);
    let handle;
    try {
      handle = await openRegularFile(relPath, dest);
    } catch (e) {
      if (e.code === "ENOENT")
        return null;
      throw e;
    }
    let data;
    try {
      const buf = await handle.readFile();
      data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } finally {
      await handle.close();
    }
    this.requireUtf8(relPath, data);
    return data;
  }
  /** The relative path of every file under the directory `under`. */
  async ls(under = "/") {
    const base = this.resolveUnderRoot(under);
    return new Set((await filenamesInDir(this.rootPath, under, base)).map(([rel]) => rel));
  }
  /**
   * Every symlink under `under` — listings skip them and reads refuse them,
   * so a caller that must know they exist asks here.
   */
  async findSymlinks(under = "/") {
    const base = this.resolveUnderRoot(under);
    return symlinksInDir(this.rootPath, under, base);
  }
  /**
   * `{relPath: sha256Hex}` of every file under the directory `under`.
   *
   * Unchanged files — same size, mtime, and ctime since the last call —
   * reuse their recorded hash instead of being re-read.
   */
  async hashtree(under = "/") {
    const base = this.resolveUnderRoot(under);
    const walkStartNs = _internals.nowNs();
    const out = /* @__PURE__ */ Object.create(null);
    for (const [rel, full] of await filenamesInDir(this.rootPath, under, base)) {
      const sha = await this.hashViaCache(rel, full, walkStartNs);
      if (sha !== null)
        out[rel] = sha;
    }
    return out;
  }
  /** One file's sha256; `null` when absent. Shares {@link hashtree}'s cache. */
  async hashFile(relPath) {
    const dest = this.resolveUnderRoot(relPath);
    let st;
    try {
      st = await fsp.lstat(dest, { bigint: true });
    } catch (e) {
      if (e.code === "ENOENT")
        return null;
      throw e;
    }
    if (st.isSymbolicLink())
      throw new FileStoreError(FileStoreError.IS_A_SYMLINK, relPath);
    if (!st.isFile())
      throw new FileStoreError(FileStoreError.NOT_A_FILE, relPath);
    const rel = path.relative(this.rootPath, dest).split(path.sep).join("/");
    return this.hashViaCache(rel, dest, _internals.nowNs());
  }
  /**
   * Rename `src` to `dst`; an existing `dst` is refused. The banned store
   * root as either end does nothing.
   */
  async move(src, dst) {
    const s = this.resolveUnderRoot(src);
    const d = this.resolveUnderRoot(dst);
    if (s === this.rootPath || d === this.rootPath)
      return;
    const dstExists = await fsp.stat(d).then(() => true, () => false);
    if (dstExists)
      throw new FileStoreError(FileStoreError.MOVE_DESTINATION_EXISTS, dst);
    await makeDirsBelowRoot(this.rootPath, path.dirname(d));
    await fsp.rename(s, d);
  }
  /** Delete a file or subtree; absent — and the banned store root — do nothing. */
  async remove(relPath) {
    const dest = this.resolveUnderRoot(relPath);
    if (dest === this.rootPath)
      return;
    let st;
    try {
      st = await fsp.lstat(dest, { bigint: true });
    } catch (e) {
      if (e.code === "ENOENT")
        return;
      throw e;
    }
    if (st.isDirectory()) {
      await fsp.rm(dest, { recursive: true, force: true });
    } else {
      try {
        await fsp.unlink(dest);
      } catch (e) {
        if (e.code !== "ENOENT")
          throw e;
      }
    }
  }
  resolveUnderRoot(relPath) {
    const norm = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
    const parts = norm.split("/").filter((p) => p !== "" && p !== ".");
    if (path.posix.isAbsolute(norm) || parts.includes("..")) {
      throw new FileStoreError(FileStoreError.ESCAPES_ROOT, relPath);
    }
    return parts.length === 0 ? this.rootPath : path.join(this.rootPath, ...parts);
  }
  requireUtf8(relPath, data) {
    if (!this.decoder)
      return;
    try {
      this.decoder.decode(data);
    } catch {
      throw new FileStoreError(FileStoreError.NOT_UTF8, relPath);
    }
  }
  async hashViaCache(rel, full, walkStartNs) {
    let st;
    try {
      st = await fsp.lstat(full, { bigint: true });
    } catch (e) {
      if (e.code === "ENOENT")
        return null;
      throw e;
    }
    if (!st.isFile())
      return null;
    const cached = this.hashes.get(rel);
    let sha;
    if (cached !== void 0 && unchangedSinceHashed(cached, st)) {
      sha = cached.sha;
    } else {
      try {
        sha = await _internals.hashFile(full);
      } catch (e) {
        const code = e.code;
        if (code === "ENOENT" || e instanceof FileStoreError)
          return null;
        if (code === "ELOOP" || code === "EMLINK")
          return null;
        throw e;
      }
    }
    if (oldEnoughToCache(st, walkStartNs)) {
      this.hashes.set(rel, { mtimeNs: st.mtimeNs, ctimeNs: st.ctimeNs, size: st.size, sha });
    }
    return sha;
  }
};
FileStore.isPathLegal = isPathLegal;
function platformSupported() {
  return O_NOFOLLOW !== 0;
}
async function makeDirAndAncestors(dir) {
  const missing = [];
  let current = dir;
  for (; ; ) {
    try {
      await fsp.stat(current);
      break;
    } catch (e) {
      const code = e.code;
      if (code !== "ENOENT" && code !== "ENOTDIR" && code !== "ELOOP")
        throw e;
    }
    missing.push(current);
    const parent = path.dirname(current);
    if (parent === current)
      break;
    current = parent;
  }
  for (const directory of missing.reverse()) {
    try {
      await fsp.mkdir(directory, { mode: OWNER_ONLY_DIR_MODE });
    } catch (e) {
      if (e.code !== "EEXIST")
        throw e;
    }
  }
}
async function makeDirsBelowRoot(root, dir) {
  const below = path.relative(root, dir);
  if (below === "")
    return;
  let current = root;
  for (const part of below.split(path.sep)) {
    current = path.join(current, part);
    try {
      await fsp.mkdir(current, { mode: OWNER_ONLY_DIR_MODE });
    } catch (e) {
      if (e.code !== "EEXIST")
        throw e;
    }
  }
}
async function replaceViaTemp(dest, data, isExecutable) {
  const mode = isExecutable ? OWNER_ONLY_EXEC_MODE : OWNER_ONLY_FILE_MODE;
  const tmp = path.join(path.dirname(dest), `.fs-${crypto.randomBytes(8).toString("hex")}.tmp`);
  let handle;
  try {
    handle = await fsp.open(tmp, C.O_WRONLY | C.O_CREAT | C.O_EXCL | O_NOFOLLOW, mode);
    await handle.writeFile(data);
    await handle.close();
    handle = void 0;
    await fsp.rename(tmp, dest);
  } catch (err) {
    if (handle)
      await handle.close().catch(() => {
      });
    await fsp.unlink(tmp).catch(() => {
    });
    throw err;
  }
}
async function openRegularFile(relPath, dest) {
  let handle;
  try {
    handle = await fsp.open(dest, C.O_RDONLY | O_NOFOLLOW | O_NONBLOCK);
  } catch (e) {
    const code = e.code;
    if (code === "ELOOP" || code === "EMLINK") {
      throw new FileStoreError(FileStoreError.IS_A_SYMLINK, relPath);
    }
    throw e;
  }
  try {
    const st = await handle.stat();
    if (!st.isFile())
      throw new FileStoreError(FileStoreError.NOT_A_FILE, relPath);
  } catch (e) {
    await handle.close().catch(() => {
    });
    throw e;
  }
  return handle;
}
async function hashFile(full) {
  const digest = crypto.createHash("sha256");
  const handle = await openRegularFile(path.basename(full), full);
  const buf = new Uint8Array(1024 * 1024);
  try {
    for (; ; ) {
      const { bytesRead } = await handle.read(buf, 0, buf.length);
      if (bytesRead === 0)
        break;
      digest.update(buf.subarray(0, bytesRead));
    }
  } finally {
    await handle.close();
  }
  return digest.digest("hex");
}
async function filenamesInDir(root, under, base) {
  if (!await requireDir(under, base))
    return [];
  const out = [];
  await walk(base, (full, entry) => {
    if (entry.isFile())
      out.push([path.relative(root, full).split(path.sep).join("/"), full]);
  });
  out.sort();
  return out;
}
async function symlinksInDir(root, under, base) {
  const relOf = (full) => path.relative(root, full).split(path.sep).join("/");
  let st;
  try {
    st = await fsp.lstat(base, { bigint: true });
  } catch (e) {
    const code = e.code;
    if (code === "ENOENT" || code === "ENOTDIR")
      return /* @__PURE__ */ new Set();
    throw e;
  }
  if (st.isSymbolicLink())
    return /* @__PURE__ */ new Set([relOf(base)]);
  if (!st.isDirectory())
    throw new FileStoreError(FileStoreError.NOT_A_DIRECTORY, under);
  const out = /* @__PURE__ */ new Set();
  await walk(base, (full, entry) => {
    if (entry.isSymbolicLink())
      out.add(relOf(full));
  });
  return out;
}
async function requireDir(under, base) {
  let st;
  try {
    st = await fsp.lstat(base, { bigint: true });
  } catch (e) {
    const code = e.code;
    if (code === "ENOENT" || code === "ENOTDIR")
      return false;
    throw e;
  }
  if (!st.isDirectory())
    throw new FileStoreError(FileStoreError.NOT_A_DIRECTORY, under);
  return true;
}
async function walk(base, visit) {
  const stack = [base];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch (e) {
      if (e.code === "ENOENT")
        continue;
      throw e;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      visit(full, entry);
      if (entry.isDirectory() && !entry.isSymbolicLink())
        stack.push(full);
    }
  }
}
function unchangedSinceHashed(cached, st) {
  return st.mtimeNs === cached.mtimeNs && st.ctimeNs === cached.ctimeNs && st.size === cached.size;
}
function oldEnoughToCache(st, walkStartNs) {
  const newestNs = st.mtimeNs > st.ctimeNs ? st.mtimeNs : st.ctimeNs;
  return newestNs < walkStartNs - _internals.timestampTrustMarginNs;
}
var TIMESTAMP_TRUST_MARGIN_NS = 2000000000n;
var _internals = {
  hashFile,
  timestampTrustMarginNs: TIMESTAMP_TRUST_MARGIN_NS,
  nowNs: () => BigInt(Date.now()) * 1000000n
};
var LocalFileStore = FileStore;
var asyncDispose = Symbol.asyncDispose;
if (asyncDispose) {
  Object.defineProperty(FileStore.prototype, asyncDispose, {
    value: FileStore.prototype.dispose,
    configurable: true,
    writable: true
  });
}

// node_modules/@anthropic-ai/sdk/tools/agent-toolset/memories.mjs
var _SessionMemoryStores_instances;
var _SessionMemoryStores_client;
var _SessionMemoryStores_workdir;
var _SessionMemoryStores_syncIntervalMs;
var _SessionMemoryStores_syncDeletions;
var _SessionMemoryStores_log;
var _SessionMemoryStores_lastSyncAt;
var _SessionMemoryStores_finished;
var _SessionMemoryStores_stores;
var _SessionMemoryStores_storeRoot;
var _SessionMemoryStores_scanMarker;
var _SessionMemoryStores_syncStore;
var _SessionMemoryStores_flushStore;
var _SessionMemoryStores_recover;
var _SessionMemoryStores_stampAndPull;
var _SessionMemoryStores_syncPath;
var _SessionMemoryStores_removeLocal;
var _SessionMemoryStores_write;
var _SessionMemoryStores_pullAll;
var _SessionMemoryStores_uploadAll;
var _SessionMemoryStores_listMemories;
var _SessionMemoryStores_upload;
var _SessionMemoryStores_corroboratedDelete;
var _SessionMemoryStores_deleteRemote;
var MEMORY_FLUSH_TIMEOUT_MS = 3e4;
var MARKER_PATH = ".anthropic-memory-store";
var MARKER_VERSION = 1;
function markerSha(memoryStoreId) {
  return crypto.createHash("sha256").update(`version ${MARKER_VERSION}
${memoryStoreId}`, "utf-8").digest("hex");
}
var DELETE_CORROBORATION_MS = 3e4;
var LIST_PAGE_SIZE = 100;
var FULL_LIST_PAGE_SIZE = 20;
var FETCH_CONCURRENCY = 16;
var UPLOAD_CONCURRENCY = 32;
var DELETE_CAP_FLOOR = 8;
var DELETE_CAP_CEILING = 50;
var SessionMemoryError = class extends AnthropicError {
  constructor(message, cause) {
    super(message);
    this.name = "SessionMemoryError";
    if (cause !== void 0)
      this.cause = cause;
  }
};
var DeletePass = class {
  constructor(mode, cap, waiveWindow) {
    this.mode = mode;
    this.cap = cap;
    this.waiveWindow = waiveWindow;
    this.attempted = 0;
    this.capped = 0;
    this.suppressed = 0;
  }
  takeSlot() {
    if (this.attempted >= this.cap) {
      this.capped++;
      return false;
    }
    this.attempted++;
    return true;
  }
};
var SessionMemoryStores = class {
  constructor(client, opts) {
    _SessionMemoryStores_instances.add(this);
    _SessionMemoryStores_client.set(this, void 0);
    _SessionMemoryStores_workdir.set(this, void 0);
    _SessionMemoryStores_syncIntervalMs.set(this, void 0);
    _SessionMemoryStores_syncDeletions.set(this, void 0);
    _SessionMemoryStores_log.set(this, void 0);
    _SessionMemoryStores_lastSyncAt.set(this, void 0);
    _SessionMemoryStores_finished.set(this, false);
    _SessionMemoryStores_stores.set(this, []);
    __classPrivateFieldSet(this, _SessionMemoryStores_client, client, "f");
    __classPrivateFieldSet(this, _SessionMemoryStores_workdir, opts.workdir, "f");
    __classPrivateFieldSet(this, _SessionMemoryStores_syncIntervalMs, opts.syncIntervalMs ?? DEFAULT_MEMORY_SYNC_INTERVAL_MS, "f");
    checkMemorySyncInterval(__classPrivateFieldGet(this, _SessionMemoryStores_syncIntervalMs, "f"), "syncIntervalMs");
    __classPrivateFieldSet(this, _SessionMemoryStores_syncDeletions, opts.syncDeletions ?? "enabled", "f");
    __classPrivateFieldSet(this, _SessionMemoryStores_log, loggerFor(client), "f");
    __classPrivateFieldSet(this, _SessionMemoryStores_lastSyncAt, Date.now(), "f");
  }
  /**
   * Every attached store's root directory.
   *
   * The worker lists these as the file tools' allowed roots so a store
   * mounted outside the workdir stays reachable.
   */
  get roots() {
    return __classPrivateFieldGet(this, _SessionMemoryStores_stores, "f").map((s) => s.files.root().path);
  }
  /**
   * Root directories of stores attached read-only.
   *
   * The file tools consult this to refuse writes into read-only stores.
   */
  get readOnlyRoots() {
    return __classPrivateFieldGet(this, _SessionMemoryStores_stores, "f").filter((s) => s.readOnly).map((s) => s.files.root().path);
  }
  /**
   * Download every attached store's memories to disk.
   *
   * `session` arrives already fetched — one snapshot shared with the skills
   * download, so the two cannot disagree about the resources.
   */
  async download(session) {
    for (const resource of session.resources) {
      if (resource.type !== "memory_store")
        continue;
      const root = __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_storeRoot).call(this, resource);
      let store;
      try {
        store = {
          memoryStoreId: resource.memory_store_id,
          // utf8: a binary file is refused at put/get, not mid-sync.
          files: await LocalFileStore.open(root, { utf8: true }),
          readOnly: resource.access === "read_only",
          baseline: /* @__PURE__ */ new Map(),
          refusedShas: /* @__PURE__ */ new Map(),
          pendingDeletes: /* @__PURE__ */ new Map()
        };
        if (!store.files.root().removedOnDispose) {
          throw new SessionMemoryError(`something already exists at the memory store's path: ${root} (memory_store_id=${resource.memory_store_id}); it must not exist when the session starts`);
        }
        try {
          await store.files.createRoot();
        } catch (e) {
          if (!isErrno(e))
            throw e;
          throw new SessionMemoryError(`cannot create the memory store's folder: ${root} (memory_store_id=${resource.memory_store_id}): ${e}; the worker host must make this mount path writable`, e);
        }
        await __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_stampAndPull).call(this, store);
        __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").info("downloaded memories", {
          count: store.baseline.size,
          memory_store_id: store.memoryStoreId,
          dest: store.files.root().path
        });
        __classPrivateFieldGet(this, _SessionMemoryStores_stores, "f").push(store);
      } catch (e) {
        if (store)
          await store.files.dispose().catch(() => {
          });
        if (e instanceof SessionMemoryError)
          throw e;
        throw new SessionMemoryError(`failed to download memory store memory_store_id=${resource.memory_store_id}: ${e}`, e);
      }
    }
    __classPrivateFieldSet(this, _SessionMemoryStores_lastSyncAt, Date.now(), "f");
  }
  /**
   * The session's last sync — skips the delete wait, so calling it twice
   * would undo the protection; it throws instead.
   */
  async finish() {
    if (__classPrivateFieldGet(this, _SessionMemoryStores_finished, "f")) {
      throw new AnthropicError("finish() was already called: it is the session's last sync and runs once");
    }
    __classPrivateFieldSet(this, _SessionMemoryStores_finished, true, "f");
    await this.syncAll(true);
  }
  /** @internal — reconcile every store once; the tests' deterministic driver */
  async syncAll(final) {
    await Promise.all(__classPrivateFieldGet(this, _SessionMemoryStores_stores, "f").map((store) => __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_syncStore).call(this, store, final)));
    __classPrivateFieldSet(this, _SessionMemoryStores_lastSyncAt, Date.now(), "f");
  }
  /** Sync when `syncIntervalMs` has elapsed since the last one. Never throws. */
  async syncIfDue() {
    if (Date.now() - __classPrivateFieldGet(this, _SessionMemoryStores_lastSyncAt, "f") < __classPrivateFieldGet(this, _SessionMemoryStores_syncIntervalMs, "f"))
      return;
    await this.syncAll(false);
  }
  /**
   * Upload new and changed files; send no deletes and pull nothing.
   *
   * The push-only rescue pass for a session ending on an error or
   * cancel — best-effort, bounded by the caller: once `signal` aborts no
   * further upload starts, each store cut off part-way logs how many
   * changed files it had not finished uploading, and this resolves without
   * waiting for requests already in flight. Each store uploads up to
   * {@link UPLOAD_CONCURRENCY} files at a time. Skips read-only stores,
   * refused files, files the server already holds, and folders that fail
   * the marker check. Never throws.
   */
  async flushWrites(signal) {
    await Promise.all(__classPrivateFieldGet(this, _SessionMemoryStores_stores, "f").map((store) => __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_flushStore).call(this, store, signal)));
  }
  /**
   * Remove every store directory that {@link SessionMemoryStores.download}
   * created. Pre-existing directories are left alone — that is
   * {@link FileStore.dispose}'s own rule. A folder that fails the marker
   * check is kept too — sync left it as found, so must dispose.
   */
  async dispose() {
    for (const store of __classPrivateFieldGet(this, _SessionMemoryStores_stores, "f")) {
      const root = store.files.root();
      try {
        const scan = await __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_scanMarker).call(this, store);
        if (!scan.markerOk && Object.keys(scan.files).length > 0) {
          __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn(`${scan.distrustReason}; leaving the memory store folder on disk`, {
            root: root.path,
            memory_store_id: store.memoryStoreId
          });
          continue;
        }
        await store.files.dispose();
      } catch (e) {
        if (!(e instanceof FileStoreError) && !isErrno(e))
          throw e;
        __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn("failed to remove the memory store folder", {
          root: store.files.root().path,
          memory_store_id: store.memoryStoreId,
          error: String(e)
        });
        continue;
      }
      if (root.removedOnDispose) {
        __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").info("removed memory store dir", {
          dest: root.path,
          memory_store_id: store.memoryStoreId
        });
      }
    }
  }
};
_SessionMemoryStores_client = /* @__PURE__ */ new WeakMap(), _SessionMemoryStores_workdir = /* @__PURE__ */ new WeakMap(), _SessionMemoryStores_syncIntervalMs = /* @__PURE__ */ new WeakMap(), _SessionMemoryStores_syncDeletions = /* @__PURE__ */ new WeakMap(), _SessionMemoryStores_log = /* @__PURE__ */ new WeakMap(), _SessionMemoryStores_lastSyncAt = /* @__PURE__ */ new WeakMap(), _SessionMemoryStores_finished = /* @__PURE__ */ new WeakMap(), _SessionMemoryStores_stores = /* @__PURE__ */ new WeakMap(), _SessionMemoryStores_instances = /* @__PURE__ */ new WeakSet(), _SessionMemoryStores_storeRoot = function _SessionMemoryStores_storeRoot2(resource) {
  if (resource.mount_path) {
    if (!isPathLegal(resource.mount_path)) {
      throw new SessionMemoryError(`memory store mount_path is not a clean absolute path: ${JSON.stringify(resource.mount_path)} (memory_store_id=${resource.memory_store_id})`);
    }
    return resource.mount_path;
  }
  return path.join(__classPrivateFieldGet(this, _SessionMemoryStores_workdir, "f"), "memory", resource.name || resource.memory_store_id);
}, _SessionMemoryStores_scanMarker = async function _SessionMemoryStores_scanMarker2(store) {
  const local = await store.files.hashtree();
  const marker = local[MARKER_PATH];
  delete local[MARKER_PATH];
  if (marker === markerSha(store.memoryStoreId)) {
    return { files: local, markerOk: true, distrustReason: null };
  }
  return {
    files: local,
    markerOk: false,
    distrustReason: marker !== void 0 ? "the marker file does not match this store" : "the marker file is gone"
  };
}, _SessionMemoryStores_syncStore = async function _SessionMemoryStores_syncStore2(store, final) {
  try {
    const scan = await __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_scanMarker).call(this, store);
    const local = scan.files;
    if (!scan.markerOk) {
      if (Object.keys(local).length > 0) {
        __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn(`${scan.distrustReason}; leaving the memory store folder as found and not syncing`, {
          root: store.files.root().path,
          memory_store_id: store.memoryStoreId
        });
        return;
      }
      await __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_recover).call(this, store, "the folder or its marker is gone");
      return;
    }
    if (Object.keys(local).length === 0 && store.baseline.size > 1) {
      await __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_recover).call(this, store, "every memory file is gone at once");
      return;
    }
    const remote = /* @__PURE__ */ new Map();
    for await (const [rel, item] of __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_listMemories).call(this, store.memoryStoreId)) {
      remote.set(rel, item);
    }
    const deletes = new DeletePass(__classPrivateFieldGet(this, _SessionMemoryStores_syncDeletions, "f"), Math.max(DELETE_CAP_FLOOR, Math.min(DELETE_CAP_CEILING, Math.floor(store.baseline.size / 4))), final);
    const pulls = [];
    const baseline = /* @__PURE__ */ new Map();
    const paths = [.../* @__PURE__ */ new Set([...remote.keys(), ...Object.keys(local), ...store.baseline.keys()])].sort();
    for (const rel of paths) {
      const remoteItem = remote.get(rel);
      const localSha = local[rel];
      const baseSha = store.baseline.get(rel);
      let sha;
      if (localSha === void 0 && baseSha !== void 0 && remoteItem !== void 0 && remoteItem.content_sha256 === baseSha && !store.readOnly) {
        sha = await __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_corroboratedDelete).call(this, store, rel, remoteItem, baseSha, deletes);
      } else {
        sha = await __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_syncPath).call(this, store, rel, remoteItem, localSha, pulls);
      }
      if (sha !== void 0)
        baseline.set(rel, sha);
    }
    store.baseline = baseline;
    await __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_pullAll).call(this, store, pulls);
    if (deletes.suppressed > 0) {
      __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").debug("remote deletes are disabled; locally deleted memories stay on the server", {
        count: deletes.suppressed,
        memory_store_id: store.memoryStoreId
      });
    }
    if (deletes.capped > 0) {
      __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn(`delete cap reached: ${deletes.mode === "log_only" ? "would send" : "sent"} ${deletes.attempted} deletes, held ${deletes.capped} for later syncs`, { memory_store_id: store.memoryStoreId });
    }
  } catch (e) {
    __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn("memory sync failed", { memory_store_id: store.memoryStoreId, error: String(e) });
  }
}, _SessionMemoryStores_flushStore = async function _SessionMemoryStores_flushStore2(store, signal) {
  const dirty = /* @__PURE__ */ new Map();
  const unsent = /* @__PURE__ */ new Set();
  const push = async () => {
    if (store.readOnly)
      return;
    const scan = await __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_scanMarker).call(this, store);
    if (!scan.markerOk) {
      __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn(`${scan.distrustReason}; not uploading anything from the memory store folder`, {
        root: store.files.root().path,
        memory_store_id: store.memoryStoreId
      });
      return;
    }
    for (const [rel, sha] of Object.entries(scan.files)) {
      if (sha !== store.baseline.get(rel) && store.refusedShas.get(rel) !== sha) {
        dirty.set(rel, sha);
        unsent.add(rel);
      }
    }
    if (dirty.size === 0 || signal?.aborted)
      return;
    const remote = /* @__PURE__ */ new Map();
    for await (const [rel, item] of __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_listMemories).call(this, store.memoryStoreId)) {
      if (signal?.aborted)
        return;
      remote.set(rel, item);
    }
    const uploads = [];
    for (const rel of [...dirty.keys()].sort()) {
      const localSha = dirty.get(rel);
      const baseSha = store.baseline.get(rel);
      const existing = remote.get(rel);
      if (existing !== void 0 && existing.content_sha256 === localSha) {
        store.baseline.set(rel, existing.content_sha256);
        unsent.delete(rel);
        continue;
      }
      if (existing !== void 0 && existing.content_sha256 !== baseSha) {
        __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn("memory changed both locally and remotely; the flush leaves the remote version", {
          path: rel,
          memory_store_id: store.memoryStoreId
        });
        unsent.delete(rel);
        continue;
      }
      uploads.push([rel, localSha, existing]);
    }
    await __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_uploadAll).call(this, store, uploads, unsent, signal);
  };
  try {
    await settledOrAborted(push(), signal);
    if (signal?.aborted && unsent.size > 0) {
      __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn(`memory flush cut off part-way; ${unsent.size} of ${dirty.size} changed files had not finished uploading`, { memory_store_id: store.memoryStoreId });
    }
  } catch (e) {
    __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn("memory flush failed", { memory_store_id: store.memoryStoreId, error: String(e) });
  }
}, _SessionMemoryStores_recover = /** Rebuild a destroyed folder from the server; sends no deletes, no uploads. */
async function _SessionMemoryStores_recover2(store, reason) {
  __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn(`${reason}; re-downloading the memory store folder instead of syncing`, {
    root: store.files.root().path,
    memory_store_id: store.memoryStoreId
  });
  await store.files.createRoot();
  await __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_stampAndPull).call(this, store);
}, _SessionMemoryStores_stampAndPull = /**
 * Write the marker, then pull every remote memory. Baseline is cleared
 * first so a failed write never leaves an entry whose file is not on disk.
 * Every memory is needed here, so the listing carries the content — pages
 * cost far fewer round-trips than a request per memory.
 */
async function _SessionMemoryStores_stampAndPull2(store) {
  store.baseline = /* @__PURE__ */ new Map();
  store.pendingDeletes.clear();
  await store.files.put(MARKER_PATH, `version ${MARKER_VERSION}
${store.memoryStoreId}`);
  for await (const [rel, item] of __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_listMemories).call(this, store.memoryStoreId, "full")) {
    if (await __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_write).call(this, store, rel, item.content ?? "")) {
      store.baseline.set(rel, item.content_sha256);
    }
  }
}, _SessionMemoryStores_syncPath = /**
 * Reconcile one path. Returns the sha to record in the baseline, or
 * `undefined` to drop the path from it.
 *
 * `pulls` is an output: when the remote version should be written to disk,
 * this appends `[rel, remote]` to it instead of writing — `rel` is the
 * file to write, `remote` the listed memory whose content `#pullAll` will
 * fetch and write there.
 */
async function _SessionMemoryStores_syncPath2(store, rel, remote, localSha, pulls) {
  const baseSha = store.baseline.get(rel);
  if (localSha !== void 0) {
    store.pendingDeletes.delete(rel);
  }
  if (!remote) {
    if (localSha === void 0) {
      store.pendingDeletes.delete(rel);
      return void 0;
    }
    if (baseSha !== void 0) {
      if (localSha === baseSha) {
        const fresh = await __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_removeLocal).call(this, store, rel, baseSha);
        if (fresh === void 0)
          return void 0;
        if (fresh === baseSha)
          return baseSha;
        localSha = fresh;
      }
      if (store.readOnly) {
        __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn("memory deleted remotely but edited locally; keeping the file, which a read-only store cannot push", { path: rel, memory_store_id: store.memoryStoreId });
      } else if (store.refusedShas.get(rel) !== localSha) {
        __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").info("memory deleted remotely but edited locally; re-creating it from the file", {
          path: rel,
          memory_store_id: store.memoryStoreId
        });
      }
    }
    if (store.readOnly)
      return void 0;
    if (store.refusedShas.get(rel) === localSha)
      return void 0;
    return await __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_upload).call(this, store, rel, localSha, void 0);
  }
  const remoteSha = remote.content_sha256;
  const remoteChanged = remoteSha !== baseSha;
  const locallyEdited = localSha !== void 0 && localSha !== baseSha && localSha !== remoteSha;
  const localChanged = !store.readOnly && locallyEdited;
  if (localSha === void 0 && baseSha !== void 0) {
    if (remoteChanged) {
      __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn("memory deleted locally but changed remotely; restoring the remote version", {
        path: rel,
        memory_store_id: store.memoryStoreId
      });
      store.pendingDeletes.delete(rel);
      pulls.push([rel, remote]);
    }
    return baseSha;
  }
  if (remoteChanged) {
    if (localSha === remoteSha)
      return remoteSha;
    if (locallyEdited) {
      __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn("memory changed both locally and remotely; keeping the remote version", {
        path: rel,
        memory_store_id: store.memoryStoreId
      });
    }
    pulls.push([rel, remote]);
    return baseSha;
  }
  if (localChanged) {
    if (store.refusedShas.get(rel) === localSha)
      return remoteSha;
    return await __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_upload).call(this, store, rel, localSha, remote) ?? remoteSha;
  }
  return remoteSha;
}, _SessionMemoryStores_removeLocal = /**
 * Remove the file for a memory the server no longer has, if it still holds
 * `expectSha`. Returns `undefined` when the file is gone from disk,
 * `expectSha` when it must stay in the baseline (I/O error), or the file's
 * fresh sha when it was edited since the scan.
 */
async function _SessionMemoryStores_removeLocal2(store, rel, expectSha) {
  let freshSha;
  try {
    freshSha = await store.files.hashFile(rel);
  } catch (e) {
    if (!(e instanceof FileStoreError) && !isErrno(e))
      throw e;
    return expectSha;
  }
  if (freshSha === null)
    return void 0;
  if (freshSha !== expectSha)
    return freshSha;
  try {
    await store.files.remove(rel);
  } catch (e) {
    if (!(e instanceof FileStoreError) && !isErrno(e))
      throw e;
    __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn("failed to remove memory deleted remotely", {
      path: rel,
      memory_store_id: store.memoryStoreId,
      error: String(e)
    });
    return expectSha;
  }
  return void 0;
}, _SessionMemoryStores_write = /**
 * Write a memory's content to disk; `false` (and a warning) on failure.
 *
 * A `..` component in the wire path reaches here as {@link FileStoreError} —
 * that is the escape guard.
 */
async function _SessionMemoryStores_write2(store, rel, content) {
  try {
    await store.files.put(rel, content);
  } catch (e) {
    if (!(e instanceof FileStoreError) && !isErrno(e))
      throw e;
    __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn("failed to write memory", {
      path: rel,
      memory_store_id: store.memoryStoreId,
      error: String(e)
    });
    return false;
  }
  return true;
}, _SessionMemoryStores_pullAll = /**
 * Fetch and write the given memories, {@link FETCH_CONCURRENCY} at a time.
 *
 * The sync's content pass: the listing carried no content, so each memory
 * is fetched individually and written as it arrives. On success the path's
 * baseline advances; on a failed fetch or write the old entry stays and the
 * next sync retries. A 404 means the memory was deleted after the listing —
 * the next sync reconciles it.
 */
async function _SessionMemoryStores_pullAll2(store, pulls) {
  if (pulls.length === 0)
    return;
  const pullOne = async (rel, listed) => {
    let item;
    try {
      item = await __classPrivateFieldGet(this, _SessionMemoryStores_client, "f").beta.memoryStores.memories.retrieve(listed.id, {
        memory_store_id: store.memoryStoreId,
        view: "full"
      });
    } catch (e) {
      if (isStatus(e, 404))
        return;
      __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn("failed to fetch memory content", {
        path: rel,
        memory_store_id: store.memoryStoreId,
        error: String(e)
      });
      return;
    }
    if (await __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_write).call(this, store, rel, item.content ?? "")) {
      store.baseline.set(rel, item.content_sha256);
    }
  };
  const queue = pulls[Symbol.iterator]();
  const worker = async () => {
    for (const [rel, listed] of queue)
      await pullOne(rel, listed);
  };
  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, pulls.length) }, worker));
}, _SessionMemoryStores_uploadAll = /**
 * Upload the given files, {@link UPLOAD_CONCURRENCY} at a time, taking each
 * path off `unsent` as its upload returns. No upload starts once `signal`
 * aborts; the ones already in flight run to completion.
 */
async function _SessionMemoryStores_uploadAll2(store, uploads, unsent, signal) {
  const queue = uploads[Symbol.iterator]();
  const worker = async () => {
    for (const [rel, localSha, existing] of queue) {
      if (signal?.aborted)
        return;
      const sha = await __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_upload).call(this, store, rel, localSha, existing);
      unsent.delete(rel);
      if (sha !== void 0)
        store.baseline.set(rel, sha);
    }
  };
  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, uploads.length) }, worker));
}, _SessionMemoryStores_listMemories = /**
 * The store's memories keyed by relative path (the wire path's leading `/`
 * stripped — `#upload` re-prefixes it) — `basic` view (shas, no content) at
 * {@link LIST_PAGE_SIZE} per page unless the caller needs `full` pages.
 * `memory_prefix` rollups and the reserved marker path are skipped.
 */
async function* _SessionMemoryStores_listMemories2(memoryStoreId, view = "basic") {
  const limit = view === "basic" ? LIST_PAGE_SIZE : FULL_LIST_PAGE_SIZE;
  for await (const item of __classPrivateFieldGet(this, _SessionMemoryStores_client, "f").beta.memoryStores.memories.list(memoryStoreId, { view, limit })) {
    if (item.type !== "memory")
      continue;
    const rel = item.path.replace(/^\/+/, "");
    if (rel === MARKER_PATH) {
      __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn("the server listed the reserved marker path; skipping", {
        path: item.path,
        memory_store_id: memoryStoreId
      });
      continue;
    }
    yield [rel, item];
  }
}, _SessionMemoryStores_upload = /**
 * Push one local file; `undefined` keeps the old baseline so the next pass retries.
 *
 * A refusal the server would repeat (400/413, the utf-8 gate) enters
 * `refusedShas`: warned once, retried only after the file changes.
 */
async function _SessionMemoryStores_upload2(store, rel, localSha, existing) {
  try {
    const data = await store.files.get(rel);
    if (data === null)
      return void 0;
    const content = decodeUTF8(data);
    const item = existing ? await __classPrivateFieldGet(this, _SessionMemoryStores_client, "f").beta.memoryStores.memories.update(existing.id, {
      memory_store_id: store.memoryStoreId,
      content,
      precondition: { type: "content_sha256", content_sha256: existing.content_sha256 }
    }) : await __classPrivateFieldGet(this, _SessionMemoryStores_client, "f").beta.memoryStores.memories.create(store.memoryStoreId, {
      path: "/" + rel,
      content
    });
    store.refusedShas.delete(rel);
    return item.content_sha256;
  } catch (e) {
    if (existing && isStatus(e, 404)) {
      return await __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_upload2).call(this, store, rel, localSha, void 0);
    }
    const permanent = e instanceof FileStoreError || isStatus(e, 400) || isStatus(e, 413);
    if (existing && isStatus(e, 409)) {
      __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn("memory changed both locally and remotely; the upload was refused and the local edit loses", {
        path: rel,
        memory_store_id: store.memoryStoreId
      });
    } else if (permanent && localSha !== void 0) {
      store.refusedShas.set(rel, localSha);
      __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn("the server rejected this memory file, so it stays un-synced until its content changes", { path: rel, memory_store_id: store.memoryStoreId, rejection: String(e) });
    } else {
      __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn("failed to upload memory", {
        path: rel,
        memory_store_id: store.memoryStoreId,
        error: String(e)
      });
    }
    return void 0;
  }
}, _SessionMemoryStores_corroboratedDelete = /** Send the server delete only after the wait, the cap, and a fresh re-check all clear. */
async function _SessionMemoryStores_corroboratedDelete2(store, rel, remote, baseSha, deletes) {
  if (deletes.mode === "disabled") {
    deletes.suppressed++;
    return baseSha;
  }
  let firstAbsent = store.pendingDeletes.get(rel);
  if (firstAbsent === void 0) {
    firstAbsent = Date.now();
    store.pendingDeletes.set(rel, firstAbsent);
  }
  if (!deletes.waiveWindow && Date.now() - firstAbsent < DELETE_CORROBORATION_MS) {
    return baseSha;
  }
  let markerOk;
  let stillAbsent;
  try {
    markerOk = await store.files.hashFile(MARKER_PATH) === markerSha(store.memoryStoreId);
    stillAbsent = await store.files.hashFile(rel) === null;
  } catch (e) {
    if (!(e instanceof FileStoreError) && !isErrno(e))
      throw e;
    markerOk = stillAbsent = false;
  }
  if (!markerOk)
    return baseSha;
  if (!stillAbsent) {
    store.pendingDeletes.delete(rel);
    return baseSha;
  }
  if (!deletes.takeSlot())
    return baseSha;
  if (deletes.mode === "log_only") {
    __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").info("log-only: sync would delete this memory on the server", {
      path: rel,
      memory_store_id: store.memoryStoreId
    });
    return baseSha;
  }
  const sha = await __classPrivateFieldGet(this, _SessionMemoryStores_instances, "m", _SessionMemoryStores_deleteRemote).call(this, store, rel, remote, baseSha);
  if (sha === void 0) {
    store.pendingDeletes.delete(rel);
  }
  return sha;
}, _SessionMemoryStores_deleteRemote = async function _SessionMemoryStores_deleteRemote2(store, rel, remote, baseSha) {
  try {
    await __classPrivateFieldGet(this, _SessionMemoryStores_client, "f").beta.memoryStores.memories.delete(remote.id, {
      memory_store_id: store.memoryStoreId,
      expected_content_sha256: baseSha
    });
  } catch (e) {
    if (isStatus(e, 404))
      return void 0;
    if (isStatus(e, 409) || isStatus(e, 412)) {
      __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn("memory deleted locally but changed remotely; keeping the remote version", {
        path: rel,
        memory_store_id: store.memoryStoreId
      });
    } else {
      __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").warn("failed to delete memory", {
        path: rel,
        memory_store_id: store.memoryStoreId,
        error: String(e)
      });
    }
    return baseSha;
  }
  __classPrivateFieldGet(this, _SessionMemoryStores_log, "f").info("propagated local deletion", { path: rel, memory_store_id: store.memoryStoreId });
  return void 0;
};
function isErrno(e) {
  return typeof e === "object" && e !== null && typeof e.code === "string";
}
async function settledOrAborted(p, signal) {
  if (!signal) {
    await p;
    return;
  }
  let onAbort;
  const aborted = new Promise((resolve2) => {
    onAbort = resolve2;
    if (signal.aborted)
      resolve2();
  });
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    await Promise.race([p, aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

// node_modules/@anthropic-ai/sdk/tools/agent-toolset/node.mjs
var _BashSession_instances;
var _BashSession_proc;
var _BashSession_buf;
var _BashSession_truncated;
var _BashSession_closed;
var _BashSession_waiting;
var _BashSession_append;
var _LineRangeCollector_instances;
var _LineRangeCollector_filePath;
var _LineRangeCollector_startLine;
var _LineRangeCollector_endLine;
var _LineRangeCollector_start;
var _LineRangeCollector_end;
var _LineRangeCollector_limit;
var _LineRangeCollector_line;
var _LineRangeCollector_collected;
var _LineRangeCollector_collectedBytes;
var _LineRangeCollector_collect;
var _LineRangeCollector_overLimitError;
var BASH_OUTPUT_LIMIT = 100 * 1024;
var BASH_DEFAULT_TIMEOUT_MS = 12e4;
var DEFAULT_MAX_FILE_BYTES = 256 * 1024;
var READ_STREAM_CHUNK_BYTES = 64 * 1024;
var NEWLINE = Buffer.from("\n");
var GREP_OUTPUT_LIMIT = 100 * 1024;
var GREP_MAX_LINE_LENGTH = 2e3;
var GLOB_RESULT_LIMIT = 200;
var BashTimeoutError = class extends AnthropicError {
  constructor(timeoutMs) {
    super(`bash command timed out after ${timeoutMs}ms`);
    this.name = "BashTimeoutError";
    this.timeoutMs = timeoutMs;
  }
};
var ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
var fsGlob = fs4.glob;
function resolveMaxBytes(configured) {
  return configured === void 0 ? DEFAULT_MAX_FILE_BYTES : configured;
}
function rejectUnrestrictedPaths(value) {
  if (value === void 0)
    return;
  throw new AnthropicError("The `unrestrictedPaths` option you passed to the agent toolset (AgentToolContext) is no longer supported. The toolset's file tools (read, write, edit, glob, grep) are now always confined to the working directory plus the directories listed in `allowedRoots`. Remove `unrestrictedPaths` from your context; to let the file tools reach any other directory, add it to `allowedRoots`.");
}
function betaAgentToolset20260401(ctx) {
  return [
    betaBashTool(ctx),
    betaReadTool(ctx),
    betaWriteTool(ctx),
    betaEditTool(ctx),
    betaGlobTool(ctx),
    betaGrepTool(ctx)
  ];
}
async function resolvePath(ctx, p) {
  rejectUnrestrictedPaths(ctx.unrestrictedPaths);
  return confineToRoot(ctx.workdir, p, { allowedRoots: ctx.allowedRoots ?? [] });
}
function readOnlyRootFor(ctx, target) {
  return containingRoot(ctx.readOnlyRoots ?? [], target);
}
function scrubbedShellEnv() {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("ANTHROPIC_"))
      continue;
    env[key] = value;
  }
  return env;
}
var BashSession = class {
  constructor(dir, env = scrubbedShellEnv()) {
    _BashSession_instances.add(this);
    _BashSession_proc.set(this, void 0);
    _BashSession_buf.set(this, "");
    _BashSession_truncated.set(this, false);
    _BashSession_closed.set(this, false);
    _BashSession_waiting.set(this, null);
    __classPrivateFieldSet(this, _BashSession_proc, cp.spawn("/bin/bash", ["--noprofile", "--norc"], {
      cwd: dir,
      // `env` is the full base environment (the scrubbed process env by
      // default, or the verbatim replacement from `AgentToolContext.env`).
      // PS1/PS2/TERM are shell-control settings BashSession always applies so
      // the pipe-based sentinel exec parsing works — not part of the
      // user-facing environment.
      env: { ...env, PS1: "", PS2: "", TERM: "dumb" },
      stdio: ["pipe", "pipe", "pipe"],
      detached: true
    }), "f");
    __classPrivateFieldGet(this, _BashSession_proc, "f").stdout.setEncoding("utf8");
    __classPrivateFieldGet(this, _BashSession_proc, "f").stderr.setEncoding("utf8");
    __classPrivateFieldGet(this, _BashSession_proc, "f").stdout.on("data", (d) => __classPrivateFieldGet(this, _BashSession_instances, "m", _BashSession_append).call(this, d));
    __classPrivateFieldGet(this, _BashSession_proc, "f").stderr.on("data", (d) => __classPrivateFieldGet(this, _BashSession_instances, "m", _BashSession_append).call(this, d));
    __classPrivateFieldGet(this, _BashSession_proc, "f").once("close", () => {
      __classPrivateFieldSet(this, _BashSession_closed, true, "f");
      const w = __classPrivateFieldGet(this, _BashSession_waiting, "f");
      __classPrivateFieldSet(this, _BashSession_waiting, null, "f");
      w?.resolve();
    });
  }
  /** Whether the underlying shell process has exited. */
  get closed() {
    return __classPrivateFieldGet(this, _BashSession_closed, "f");
  }
  async exec(command, opts = {}) {
    if (__classPrivateFieldGet(this, _BashSession_closed, "f")) {
      throw new AnthropicError("bash session terminated");
    }
    const timeoutMs = opts.timeoutMs ?? BASH_DEFAULT_TIMEOUT_MS;
    const signal = opts.signal;
    signal?.throwIfAborted();
    __classPrivateFieldSet(this, _BashSession_buf, "", "f");
    __classPrivateFieldSet(this, _BashSession_truncated, false, "f");
    const sentinel = `__ANT_CMD_${crypto2.randomUUID()}_DONE__`;
    const sentinelSplit = `${sentinel.slice(0, 8)}''${sentinel.slice(8)}`;
    const wrapped = `{ ${command}
} </dev/null 2>&1; printf '\\n${sentinelSplit}%d\\n' $?
`;
    __classPrivateFieldGet(this, _BashSession_proc, "f").stdin.write(wrapped);
    if (__classPrivateFieldGet(this, _BashSession_buf, "f").indexOf(sentinel) < 0) {
      const { promise: sentinelSeen, resolve: resolve2 } = promiseWithResolvers();
      __classPrivateFieldSet(this, _BashSession_waiting, { sentinel, resolve: resolve2 }, "f");
      let timer;
      let onAbort;
      try {
        await Promise.race([
          sentinelSeen,
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new BashTimeoutError(timeoutMs)), timeoutMs);
          }),
          new Promise((_, reject) => {
            if (!signal)
              return;
            onAbort = () => reject(signal.reason);
            signal.addEventListener("abort", onAbort, { once: true });
          })
        ]);
      } finally {
        if (timer)
          clearTimeout(timer);
        if (onAbort && signal)
          signal.removeEventListener("abort", onAbort);
        __classPrivateFieldSet(this, _BashSession_waiting, null, "f");
      }
    }
    const idx = __classPrivateFieldGet(this, _BashSession_buf, "f").indexOf(sentinel);
    if (idx < 0) {
      throw new AnthropicError("bash session terminated");
    }
    const tail = __classPrivateFieldGet(this, _BashSession_buf, "f").slice(idx + sentinel.length);
    const m = tail.match(/^(-?\d+)/);
    const exitCode = m ? parseInt(m[1], 10) : -1;
    let out = __classPrivateFieldGet(this, _BashSession_buf, "f").slice(0, idx).replace(ANSI_RE, "").replace(/\n+$/, "");
    if (__classPrivateFieldGet(this, _BashSession_truncated, "f")) {
      out = `[output truncated]
${out}`;
    }
    return { output: out, exitCode };
  }
  close() {
    if (__classPrivateFieldGet(this, _BashSession_closed, "f"))
      return;
    __classPrivateFieldSet(this, _BashSession_closed, true, "f");
    const w = __classPrivateFieldGet(this, _BashSession_waiting, "f");
    __classPrivateFieldSet(this, _BashSession_waiting, null, "f");
    w?.resolve();
    __classPrivateFieldGet(this, _BashSession_proc, "f").stdout.destroy();
    __classPrivateFieldGet(this, _BashSession_proc, "f").stderr.destroy();
    __classPrivateFieldGet(this, _BashSession_proc, "f").stdin.destroy();
    try {
      process.kill(-__classPrivateFieldGet(this, _BashSession_proc, "f").pid, "SIGKILL");
    } catch {
      __classPrivateFieldGet(this, _BashSession_proc, "f").kill("SIGKILL");
    }
    __classPrivateFieldGet(this, _BashSession_proc, "f").unref();
  }
};
_BashSession_proc = /* @__PURE__ */ new WeakMap(), _BashSession_buf = /* @__PURE__ */ new WeakMap(), _BashSession_truncated = /* @__PURE__ */ new WeakMap(), _BashSession_closed = /* @__PURE__ */ new WeakMap(), _BashSession_waiting = /* @__PURE__ */ new WeakMap(), _BashSession_instances = /* @__PURE__ */ new WeakSet(), _BashSession_append = function _BashSession_append2(d) {
  __classPrivateFieldSet(this, _BashSession_buf, __classPrivateFieldGet(this, _BashSession_buf, "f") + d, "f");
  if (__classPrivateFieldGet(this, _BashSession_buf, "f").length > BASH_OUTPUT_LIMIT) {
    __classPrivateFieldSet(this, _BashSession_buf, __classPrivateFieldGet(this, _BashSession_buf, "f").slice(__classPrivateFieldGet(this, _BashSession_buf, "f").length - BASH_OUTPUT_LIMIT), "f");
    __classPrivateFieldSet(this, _BashSession_truncated, true, "f");
  }
  if (__classPrivateFieldGet(this, _BashSession_waiting, "f") && __classPrivateFieldGet(this, _BashSession_buf, "f").indexOf(__classPrivateFieldGet(this, _BashSession_waiting, "f").sentinel) >= 0) {
    const w = __classPrivateFieldGet(this, _BashSession_waiting, "f");
    __classPrivateFieldSet(this, _BashSession_waiting, null, "f");
    w.resolve();
  }
};
function betaBashTool(ctx) {
  rejectUnrestrictedPaths(ctx.unrestrictedPaths);
  let session;
  let tail = Promise.resolve();
  return betaTool({
    name: "bash",
    description: "Run a bash command in a persistent shell. State (cwd, env vars) persists across calls.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "The command to run" },
        restart: { type: "boolean", description: "Restart the persistent shell before running" },
        timeout_ms: { type: "integer", description: "Per-call timeout in milliseconds" }
      }
    },
    run: async ({ command, restart, timeout_ms }, context) => {
      const prev = tail;
      const gate = promiseWithResolvers();
      tail = gate.promise;
      try {
        await prev;
      } catch {
      }
      try {
        if (restart) {
          session?.close();
          session = void 0;
        }
        if (!command) {
          if (restart)
            return "bash session restarted";
          throw new ToolError("bash: command is required");
        }
        session ?? (session = new BashSession(ctx.workdir, ctx.env));
        try {
          const { output, exitCode } = await session.exec(command, {
            timeoutMs: timeout_ms ?? BASH_DEFAULT_TIMEOUT_MS,
            signal: context?.signal
          });
          if (exitCode !== 0)
            throw new ToolError(output || `exit ${exitCode}`);
          return output;
        } catch (e) {
          if (e instanceof ToolError)
            throw e;
          session.close();
          session = void 0;
          throw new ToolError(`bash: ${e instanceof Error ? e.message : String(e)}`);
        }
      } finally {
        gate.resolve();
      }
    },
    close: () => {
      session?.close();
      session = void 0;
    }
  });
}
function betaReadTool(ctx) {
  rejectUnrestrictedPaths(ctx.unrestrictedPaths);
  return betaTool({
    name: "read",
    description: "Read a UTF-8 text file relative to the workdir.",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string" },
        view_range: {
          type: "array",
          items: { type: "integer" },
          description: "[start_line, end_line] 1-indexed inclusive"
        }
      },
      required: ["file_path"]
    },
    run: async ({ file_path, view_range }) => {
      if (!file_path)
        throw new ToolError("read: file_path is required");
      const abs = await resolvePath(ctx, file_path);
      if (view_range?.length && view_range.length !== 2) {
        throw new ToolError("read: view_range must be [start_line, end_line]");
      }
      let data;
      try {
        const st = await fs4.stat(abs);
        if (!st.isFile()) {
          throw new ToolError(`read: ${file_path} is not a regular file`);
        }
        const limit = resolveMaxBytes(ctx.maxFileBytes);
        if (limit !== null && st.size > limit) {
          if (!view_range?.length) {
            throw new ToolError(`read: ${file_path} is ${st.size} bytes, exceeds ${limit}-byte limit. Use the view_range parameter to read specific line ranges, e.g. view_range: [1, 500].`);
          }
          const [startLine2, endLine2] = view_range;
          return await readRangeStreaming(abs, file_path, startLine2, endLine2, limit);
        }
        data = await fs4.readFile(abs, "utf8");
      } catch (e) {
        if (e instanceof ToolError)
          throw e;
        throw new ToolError(`read: ${fsErrorMessage(e, file_path)}`);
      }
      if (!view_range?.length)
        return data;
      const [startLine, endLine] = view_range;
      const lines = data.split("\n");
      const start = Math.max(0, startLine - 1);
      const end = endLine > 0 ? endLine : lines.length;
      return lines.slice(start, end).join("\n");
    }
  });
}
async function readRangeStreaming(abs, filePath, startLine, endLine, limit) {
  const lines = new LineRangeCollector(filePath, startLine, endLine, limit);
  if (lines.rangeIsEmpty())
    return "";
  const stream2 = fssync.createReadStream(abs, { highWaterMark: READ_STREAM_CHUNK_BYTES });
  try {
    for await (const chunk of stream2) {
      lines.collectFrom(chunk);
      if (lines.rangeIsCollected())
        break;
    }
  } finally {
    stream2.destroy();
  }
  return lines.text();
}
var LineRangeCollector = class {
  constructor(filePath, startLine, endLine, limit) {
    _LineRangeCollector_instances.add(this);
    _LineRangeCollector_filePath.set(this, void 0);
    _LineRangeCollector_startLine.set(this, void 0);
    _LineRangeCollector_endLine.set(this, void 0);
    _LineRangeCollector_start.set(this, void 0);
    _LineRangeCollector_end.set(this, void 0);
    _LineRangeCollector_limit.set(this, void 0);
    _LineRangeCollector_line.set(this, 0);
    _LineRangeCollector_collected.set(this, []);
    _LineRangeCollector_collectedBytes.set(this, 0);
    __classPrivateFieldSet(this, _LineRangeCollector_filePath, filePath, "f");
    __classPrivateFieldSet(this, _LineRangeCollector_startLine, startLine, "f");
    __classPrivateFieldSet(this, _LineRangeCollector_endLine, endLine, "f");
    __classPrivateFieldSet(this, _LineRangeCollector_start, Math.max(0, startLine - 1), "f");
    __classPrivateFieldSet(this, _LineRangeCollector_end, endLine > 0 ? endLine : Infinity, "f");
    __classPrivateFieldSet(this, _LineRangeCollector_limit, limit, "f");
  }
  rangeIsEmpty() {
    return __classPrivateFieldGet(this, _LineRangeCollector_end, "f") <= __classPrivateFieldGet(this, _LineRangeCollector_start, "f");
  }
  rangeIsCollected() {
    return __classPrivateFieldGet(this, _LineRangeCollector_line, "f") >= __classPrivateFieldGet(this, _LineRangeCollector_end, "f");
  }
  collectFrom(chunk) {
    var _a;
    let lineStart = 0;
    while (lineStart < chunk.length && !this.rangeIsCollected()) {
      const newline = chunk.indexOf(10, lineStart);
      const lineEnd = newline < 0 ? chunk.length : newline;
      if (__classPrivateFieldGet(this, _LineRangeCollector_line, "f") >= __classPrivateFieldGet(this, _LineRangeCollector_start, "f")) {
        __classPrivateFieldGet(this, _LineRangeCollector_instances, "m", _LineRangeCollector_collect).call(this, chunk.subarray(lineStart, lineEnd), newline >= 0);
      }
      if (newline < 0)
        break;
      __classPrivateFieldSet(this, _LineRangeCollector_line, (_a = __classPrivateFieldGet(this, _LineRangeCollector_line, "f"), _a++, _a), "f");
      lineStart = newline + 1;
    }
  }
  text() {
    return Buffer.concat(__classPrivateFieldGet(this, _LineRangeCollector_collected, "f"), __classPrivateFieldGet(this, _LineRangeCollector_collectedBytes, "f")).toString("utf8");
  }
};
_LineRangeCollector_filePath = /* @__PURE__ */ new WeakMap(), _LineRangeCollector_startLine = /* @__PURE__ */ new WeakMap(), _LineRangeCollector_endLine = /* @__PURE__ */ new WeakMap(), _LineRangeCollector_start = /* @__PURE__ */ new WeakMap(), _LineRangeCollector_end = /* @__PURE__ */ new WeakMap(), _LineRangeCollector_limit = /* @__PURE__ */ new WeakMap(), _LineRangeCollector_line = /* @__PURE__ */ new WeakMap(), _LineRangeCollector_collected = /* @__PURE__ */ new WeakMap(), _LineRangeCollector_collectedBytes = /* @__PURE__ */ new WeakMap(), _LineRangeCollector_instances = /* @__PURE__ */ new WeakSet(), _LineRangeCollector_collect = function _LineRangeCollector_collect2(lineBytes, newlineTerminated) {
  __classPrivateFieldGet(this, _LineRangeCollector_collected, "f").push(lineBytes);
  __classPrivateFieldSet(this, _LineRangeCollector_collectedBytes, __classPrivateFieldGet(this, _LineRangeCollector_collectedBytes, "f") + lineBytes.length, "f");
  if (newlineTerminated && __classPrivateFieldGet(this, _LineRangeCollector_line, "f") + 1 < __classPrivateFieldGet(this, _LineRangeCollector_end, "f")) {
    __classPrivateFieldGet(this, _LineRangeCollector_collected, "f").push(NEWLINE);
    __classPrivateFieldSet(this, _LineRangeCollector_collectedBytes, __classPrivateFieldGet(this, _LineRangeCollector_collectedBytes, "f") + NEWLINE.length, "f");
  }
  if (__classPrivateFieldGet(this, _LineRangeCollector_collectedBytes, "f") > __classPrivateFieldGet(this, _LineRangeCollector_limit, "f"))
    throw __classPrivateFieldGet(this, _LineRangeCollector_instances, "m", _LineRangeCollector_overLimitError).call(this);
}, _LineRangeCollector_overLimitError = function _LineRangeCollector_overLimitError2() {
  if (__classPrivateFieldGet(this, _LineRangeCollector_end, "f") - __classPrivateFieldGet(this, _LineRangeCollector_start, "f") === 1) {
    return new ToolError(`read: line ${__classPrivateFieldGet(this, _LineRangeCollector_start, "f") + 1} of ${__classPrivateFieldGet(this, _LineRangeCollector_filePath, "f")} alone exceeds ${__classPrivateFieldGet(this, _LineRangeCollector_limit, "f")}-byte limit. The read tool cannot return part of a line, so view_range cannot narrow this further.`);
  }
  return new ToolError(`read: view_range [${__classPrivateFieldGet(this, _LineRangeCollector_startLine, "f")}, ${__classPrivateFieldGet(this, _LineRangeCollector_endLine, "f")}] of ${__classPrivateFieldGet(this, _LineRangeCollector_filePath, "f")} exceeds ${__classPrivateFieldGet(this, _LineRangeCollector_limit, "f")}-byte limit. Narrow the view_range to read a smaller portion.`);
};
function betaWriteTool(ctx) {
  rejectUnrestrictedPaths(ctx.unrestrictedPaths);
  return betaTool({
    name: "write",
    description: "Write a UTF-8 text file relative to the workdir, creating parent directories as needed.",
    inputSchema: {
      type: "object",
      properties: { file_path: { type: "string" }, content: { type: "string" } },
      required: ["file_path", "content"]
    },
    run: async ({ file_path, content }) => {
      if (!file_path)
        throw new ToolError("write: file_path is required");
      const abs = await resolvePath(ctx, file_path);
      const ro = await readOnlyRootFor(ctx, abs);
      if (ro !== void 0) {
        throw new ToolError(`write: ${file_path} is inside read-only directory ${ro}`);
      }
      try {
        await fs4.mkdir(path2.dirname(abs), { recursive: true, mode: DIR_CREATE_MODE });
        await atomicWriteFile(abs, content ?? "");
      } catch (e) {
        throw new ToolError(`write: ${fsErrorMessage(e, file_path)}`);
      }
      return `wrote ${Buffer.byteLength(content ?? "")} bytes to ${file_path}`;
    }
  });
}
function betaEditTool(ctx) {
  rejectUnrestrictedPaths(ctx.unrestrictedPaths);
  return betaTool({
    name: "edit",
    description: "Replace old_string with new_string in a file. old_string must be unique unless replace_all.",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string" },
        old_string: { type: "string" },
        new_string: { type: "string" },
        replace_all: { type: "boolean" }
      },
      required: ["file_path", "old_string", "new_string"]
    },
    run: async ({ file_path, old_string, new_string, replace_all }) => {
      if (!file_path)
        throw new ToolError("edit: file_path is required");
      if (!old_string)
        throw new ToolError("edit: old_string is required");
      const abs = await resolvePath(ctx, file_path);
      const ro = await readOnlyRootFor(ctx, abs);
      if (ro !== void 0) {
        throw new ToolError(`edit: ${file_path} is inside read-only directory ${ro}`);
      }
      let data;
      try {
        const st = await fs4.stat(abs);
        if (!st.isFile()) {
          throw new ToolError(`edit: ${file_path} is not a regular file`);
        }
        const limit = resolveMaxBytes(ctx.maxFileBytes);
        if (limit !== null && st.size > limit) {
          throw new ToolError(`edit: ${file_path} is ${st.size} bytes, exceeds ${limit}-byte limit. The edit tool loads the whole file and cannot modify a file this large.`);
        }
        data = await fs4.readFile(abs, "utf8");
      } catch (e) {
        if (e instanceof ToolError)
          throw e;
        throw new ToolError(`edit: ${fsErrorMessage(e, file_path)}`);
      }
      const count = data.split(old_string).length - 1;
      if (count === 0)
        throw new ToolError(`edit: old_string not found in ${file_path}`);
      let updated;
      if (replace_all) {
        updated = data.split(old_string).join(new_string);
      } else {
        if (count > 1)
          throw new ToolError(`edit: old_string appears ${count} times in ${file_path} (must be unique)`);
        updated = data.replace(old_string, () => new_string);
      }
      try {
        await atomicWriteFile(abs, updated);
      } catch (e) {
        throw new ToolError(`edit: write: ${fsErrorMessage(e, file_path)}`);
      }
      return `edited ${file_path} (${replace_all ? count : 1} replacement(s))`;
    }
  });
}
function patternCanAscend(pattern) {
  return pattern.split(/[\\/{},]/).includes("..");
}
function betaGlobTool(ctx) {
  rejectUnrestrictedPaths(ctx.unrestrictedPaths);
  return betaTool({
    name: "glob",
    description: "Match files under the workdir against a glob pattern. Results are mtime-sorted, newest first.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        path: { type: "string", description: "Directory to search in. Defaults to the workdir." }
      },
      required: ["pattern"]
    },
    run: async ({ pattern, path: searchPath }) => {
      if (!pattern)
        throw new ToolError("glob: pattern is required");
      if (path2.isAbsolute(pattern)) {
        throw new ToolError("glob: absolute pattern not permitted; pass a relative pattern (and optionally path)");
      }
      if (patternCanAscend(pattern)) {
        throw new ToolError('glob: ".." is not permitted in the pattern');
      }
      const root = searchPath ? await resolvePath(ctx, searchPath) : path2.resolve(ctx.workdir);
      const realRoot = searchPath ? root : await canonicalize(root);
      const matches = [];
      let remaining = WALK_MAX_ENTRIES;
      try {
        for await (const entry of fsGlob(pattern, {
          cwd: root,
          withFileTypes: true,
          exclude: (d) => d.name === ".git" || d.name === "node_modules"
        })) {
          if (remaining-- <= 0)
            break;
          if (!entry.isFile())
            continue;
          const full = path2.join(entry.parentPath, entry.name);
          let real;
          try {
            real = await fs4.realpath(full);
          } catch {
            continue;
          }
          if (!isWithin(realRoot, real))
            continue;
          let mtime = 0;
          try {
            mtime = (await fs4.stat(full)).mtimeMs;
          } catch {
          }
          matches.push({ path: full, mtime });
        }
      } catch (e) {
        throw new ToolError(`glob: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (matches.length === 0)
        return "no matches";
      matches.sort((a, b) => b.mtime - a.mtime);
      return matches.slice(0, GLOB_RESULT_LIMIT).map((m) => m.path).join("\n");
    }
  });
}
function betaGrepTool(ctx) {
  rejectUnrestrictedPaths(ctx.unrestrictedPaths);
  return betaTool({
    name: "grep",
    description: "Search file contents for a regex. Uses ripgrep if available, otherwise a built-in walker.",
    inputSchema: {
      type: "object",
      properties: { pattern: { type: "string" }, path: { type: "string" } },
      required: ["pattern"]
    },
    run: async ({ pattern, path: p }, context) => {
      if (!pattern)
        throw new ToolError("grep: pattern is required");
      let searchPath = path2.resolve(ctx.workdir);
      if (p)
        searchPath = await resolvePath(ctx, p);
      const rg = await findRg();
      return rg ? runRipgrep(rg, pattern, searchPath, context?.signal) : runWalkGrep(pattern, searchPath, context?.signal);
    }
  });
}
function runRipgrep(rg, pattern, searchPath, signal) {
  return new Promise((resolve2, reject) => {
    const proc = cp.spawn(rg, ["-n", "--no-heading", "-e", pattern, "--", searchPath], {
      ...signal ? { signal } : {}
    });
    let out = "";
    let errOut = "";
    let truncated = false;
    proc.stdout.on("data", (d) => {
      if (truncated)
        return;
      out += d;
      if (out.length > GREP_OUTPUT_LIMIT) {
        truncated = true;
        out = out.slice(0, GREP_OUTPUT_LIMIT);
        proc.kill("SIGKILL");
      }
    });
    proc.stderr.on("data", (d) => errOut += d);
    proc.on("close", (code) => {
      if (signal?.aborted)
        return reject(new ToolError("grep: aborted"));
      if (truncated)
        return resolve2(out + `
[output truncated at ${GREP_OUTPUT_LIMIT} bytes]`);
      if (code === 0)
        return resolve2(out);
      if (code === 1)
        return resolve2("no matches");
      reject(new ToolError(`grep: rg failed: ${errOut || `exit ${code}`}`));
    });
    proc.on("error", (e) => {
      if (signal?.aborted)
        return reject(new ToolError("grep: aborted"));
      reject(new ToolError(`grep: rg failed: ${e.message}`));
    });
  });
}
async function runWalkGrep(pattern, root, signal) {
  let re;
  try {
    re = new RegExp(pattern);
  } catch (e) {
    throw new ToolError(`grep: invalid regex: ${e instanceof Error ? e.message : String(e)}`);
  }
  const hits = [];
  let budget = GREP_OUTPUT_LIMIT;
  const push = (line) => {
    budget -= line.length + 1;
    if (budget < 0) {
      hits.push(`[output truncated at ${GREP_OUTPUT_LIMIT} bytes]`);
      return false;
    }
    hits.push(line);
    return true;
  };
  const stat2 = await fs4.stat(root).catch(() => null);
  if (stat2?.isFile()) {
    await grepFile(root, re, push);
  } else {
    await walk2(root, "", (rel) => grepFile(path2.join(root, rel), re, push), signal);
  }
  if (signal?.aborted)
    throw new ToolError("grep: aborted");
  if (hits.length === 0)
    return "no matches";
  return hits.join("\n");
}
async function grepFile(file, re, push) {
  const stream2 = fssync.createReadStream(file, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream2, crlfDelay: Infinity });
  let i = 0;
  try {
    for await (const line of rl) {
      i++;
      if (line.length > GREP_MAX_LINE_LENGTH)
        continue;
      if (re.test(line) && !push(`${file}:${i}:${line}`))
        return false;
    }
  } catch {
  } finally {
    stream2.destroy();
  }
  return true;
}
var WALK_MAX_DEPTH = 40;
var WALK_MAX_ENTRIES = 5e4;
async function walk2(root, rel, fn, signal) {
  let remaining = WALK_MAX_ENTRIES;
  async function inner(rel2, depth) {
    if (depth > WALK_MAX_DEPTH)
      return true;
    if (signal?.aborted)
      return false;
    let entries;
    try {
      entries = await fs4.readdir(path2.join(root, rel2), { withFileTypes: true });
    } catch {
      return true;
    }
    for (const e of entries) {
      if (e.name === ".git" || e.name === "node_modules")
        continue;
      if (remaining-- <= 0)
        return false;
      if (signal?.aborted)
        return false;
      const childRel = rel2 ? path2.join(rel2, e.name) : e.name;
      if (e.isDirectory()) {
        if (!await inner(childRel, depth + 1))
          return false;
      } else if (e.isFile()) {
        if (await fn(childRel) === false)
          return false;
      }
    }
    return true;
  }
  await inner(rel, 0);
}
async function findRg() {
  const dirs = (process.env["PATH"] ?? "").split(path2.delimiter);
  for (const d of dirs) {
    const candidate = path2.join(d, "rg");
    try {
      await fs4.access(candidate, fssync.constants.X_OK);
      return candidate;
    } catch {
    }
  }
  return null;
}
export {
  BashSession,
  BashTimeoutError,
  DEFAULT_MEMORY_SYNC_INTERVAL_MS,
  MARKER_PATH,
  MEMORY_FLUSH_TIMEOUT_MS,
  MIN_MEMORY_SYNC_INTERVAL_MS,
  SessionMemoryError,
  SessionMemoryStores,
  betaAgentToolset20260401,
  betaBashTool,
  betaEditTool,
  betaGlobTool,
  betaGrepTool,
  betaReadTool,
  betaWriteTool,
  extractSkillArchive,
  resolvePath,
  setupSkills
};
