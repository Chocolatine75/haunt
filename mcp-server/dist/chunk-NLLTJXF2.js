import { createRequire } from 'module'; const require = createRequire(import.meta.url);

// node_modules/@anthropic-ai/sdk/internal/node.mjs
import * as child_process from "child_process";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as stream from "stream";
import * as util from "util";

export {
  child_process,
  crypto,
  fs,
  os,
  path,
  stream,
  util
};
