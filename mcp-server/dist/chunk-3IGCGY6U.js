import { createRequire } from 'module'; const require = createRequire(import.meta.url);
import {
  $ZodError,
  NEVER,
  any,
  array,
  boolean,
  int,
  literal,
  nullable,
  object,
  prettifyError,
  record,
  string,
  union,
  unknown
} from "./chunk-5HT2UXVQ.js";

// node_modules/@mistralai/mistralai/esm/extra/observability/provider.js
var registeredTracerProvider;
function registerTracerProvider(tracerProvider) {
  registeredTracerProvider = tracerProvider;
}
function getRegisteredTracerProvider() {
  return registeredTracerProvider;
}

// node_modules/@mistralai/mistralai/esm/lib/primitives.js
function remap(inp, mappings) {
  let out = {};
  if (!Object.keys(mappings).length) {
    out = inp;
    return out;
  }
  for (const [k, v] of Object.entries(inp)) {
    const j = mappings[k];
    if (j === null) {
      continue;
    }
    out[j ?? k] = v;
  }
  return out;
}
function compactMap(values) {
  const out = {};
  for (const [k, v] of Object.entries(values)) {
    if (typeof v !== "undefined") {
      out[k] = v;
    }
  }
  return out;
}

// node_modules/@mistralai/mistralai/esm/models/errors/sdkvalidationerror.js
var SDKValidationError = class extends Error {
  /**
   * The raw value that failed validation.
   */
  rawValue;
  /**
   * The raw message that failed validation.
   */
  rawMessage;
  // Allows for backwards compatibility for `instanceof` checks of `ResponseValidationError`
  static [Symbol.hasInstance](instance) {
    if (!(instance instanceof Error))
      return false;
    if (!("rawValue" in instance))
      return false;
    if (!("rawMessage" in instance))
      return false;
    if (!("pretty" in instance))
      return false;
    if (typeof instance.pretty !== "function")
      return false;
    return true;
  }
  constructor(message, cause, rawValue) {
    super(`${message}: ${cause}`);
    this.name = "SDKValidationError";
    this.cause = cause;
    this.rawValue = rawValue;
    this.rawMessage = message;
  }
  /**
   * Return a pretty-formatted error message if the underlying validation error
   * is a ZodError or some other recognized error type, otherwise return the
   * default error message.
   */
  pretty() {
    if (this.cause instanceof $ZodError) {
      return `${this.rawMessage}
${formatZodError(this.cause)}`;
    } else {
      return this.toString();
    }
  }
};
function formatZodError(err) {
  return prettifyError(err);
}

// node_modules/@mistralai/mistralai/esm/types/fp.js
function OK(value) {
  return { ok: true, value };
}
function ERR(error) {
  return { ok: false, error };
}
async function unwrapAsync(pr) {
  const r = await pr;
  if (!r.ok) {
    throw r.error;
  }
  return r.value;
}

// node_modules/@mistralai/mistralai/esm/lib/schemas.js
function safeParse(rawValue, fn, errorMessage) {
  try {
    return OK(fn(rawValue));
  } catch (err) {
    return ERR(new SDKValidationError(errorMessage, err, rawValue));
  }
}

// node_modules/@mistralai/mistralai/esm/models/components/usageinfo.js
var UsageInfo$inboundSchema = object({
  prompt_tokens: int().default(0),
  completion_tokens: int().default(0),
  total_tokens: int().default(0),
  prompt_audio_seconds: nullable(int()).optional(),
  service_tier: nullable(string()).optional()
}).catchall(any()).transform((v) => {
  return remap(v, {
    "prompt_tokens": "promptTokens",
    "completion_tokens": "completionTokens",
    "total_tokens": "totalTokens",
    "prompt_audio_seconds": "promptAudioSeconds",
    "service_tier": "serviceTier"
  });
});
var UsageInfo$outboundSchema = object({
  promptTokens: int().default(0),
  completionTokens: int().default(0),
  totalTokens: int().default(0),
  promptAudioSeconds: nullable(int()).optional(),
  serviceTier: nullable(string()).optional()
}).catchall(any()).transform((v) => {
  return {
    ...remap(v, {
      promptTokens: "prompt_tokens",
      completionTokens: "completion_tokens",
      totalTokens: "total_tokens",
      promptAudioSeconds: "prompt_audio_seconds",
      serviceTier: "service_tier"
    })
  };
});

// node_modules/@mistralai/mistralai/esm/types/unrecognized.js
function unrecognized(value) {
  globalCount++;
  return value;
}
var globalCount = 0;
var refCount = 0;
function startCountingUnrecognized() {
  refCount++;
  const start = globalCount;
  return {
    /**
     * Ends counting and returns the delta.
     * @param delta - If provided, only this amount is added to the parent counter
     *   (used for nested unions where we only want to record the winning option's count).
     *   If not provided, records all counts since start().
     */
    end: (delta) => {
      const count = globalCount - start;
      globalCount = start + (delta ?? count);
      if (--refCount === 0)
        globalCount = 0;
      return count;
    }
  };
}

// node_modules/@mistralai/mistralai/esm/types/enums.js
function inboundSchema(enumObj) {
  const options = Object.values(enumObj);
  return union([
    ...options.map((x) => literal(x)),
    string().transform((x) => unrecognized(x))
  ]);
}
function inboundSchemaInt(enumObj) {
  const options = Object.values(enumObj).filter((v) => typeof v === "number");
  return union([
    ...options.map((x) => literal(x)),
    int().transform((x) => unrecognized(x))
  ]);
}
function outboundSchema(_) {
  return string();
}
function outboundSchemaInt(_) {
  return int();
}

// node_modules/@mistralai/mistralai/esm/types/discriminatedUnion.js
var UNKNOWN = /* @__PURE__ */ Symbol("UNKNOWN");
function isUnknown(value) {
  return typeof value === "object" && value !== null && UNKNOWN in value;
}
function discriminatedUnion(inputPropertyName, options, opts = {}) {
  const { unknownValue = "UNKNOWN", outputPropertyName } = opts;
  return unknown().transform((input) => {
    const fallback = Object.defineProperties({
      raw: input,
      [outputPropertyName ?? inputPropertyName]: unknownValue,
      isUnknown: true
    }, { [UNKNOWN]: { value: true, enumerable: false, configurable: false } });
    const isObject = typeof input === "object" && input !== null;
    if (!isObject)
      return fallback;
    const discriminator = input[inputPropertyName];
    if (typeof discriminator !== "string")
      return fallback;
    if (!(discriminator in options))
      return fallback;
    const schema = options[discriminator];
    if (!schema)
      return fallback;
    const unrecognizedCtr = startCountingUnrecognized();
    const result = schema.safeParse(input);
    if (!result.success) {
      unrecognizedCtr.end(0);
      return fallback;
    }
    unrecognizedCtr.end();
    if (outputPropertyName) {
      result.data[outputPropertyName] = discriminator;
    }
    return result.data;
  });
}

// node_modules/@mistralai/mistralai/esm/types/rfcdate.js
var dateRE = /^\d{4}-\d{2}-\d{2}$/;
var RFCDate = class _RFCDate {
  serialized;
  /**
   * Creates a new RFCDate instance using today's date.
   */
  static today() {
    return new _RFCDate(/* @__PURE__ */ new Date());
  }
  /**
   * Creates a new RFCDate instance using the provided input.
   * If a string is used then in must be in the format YYYY-MM-DD.
   *
   * @param date A Date object or a date string in YYYY-MM-DD format
   * @example
   * new RFCDate("2022-01-01")
   * @example
   * new RFCDate(new Date())
   */
  constructor(date) {
    if (typeof date === "string" && !dateRE.test(date)) {
      throw new RangeError("RFCDate: date strings must be in the format YYYY-MM-DD: " + date);
    }
    const value = new Date(date);
    if (isNaN(+value)) {
      throw new RangeError("RFCDate: invalid date provided: " + date);
    }
    this.serialized = value.toISOString().slice(0, "YYYY-MM-DD".length);
    if (!dateRE.test(this.serialized)) {
      throw new TypeError(`RFCDate: failed to build valid date with given value: ${date} serialized to ${this.serialized}`);
    }
  }
  toJSON() {
    return this.toString();
  }
  toString() {
    return this.serialized;
  }
};

// node_modules/@mistralai/mistralai/esm/types/smartUnion.js
function smartUnion(options) {
  return unknown().transform((input, ctx) => {
    const candidates = [];
    const errors = options.map(() => []);
    const parentUnrecognizedCtr = startCountingUnrecognized();
    for (const [i, option] of options.entries()) {
      const unrecognizedCtr = startCountingUnrecognized();
      const result = option.safeParse(input);
      const inexactCount = unrecognizedCtr.end();
      const zeroDefaultCount = 0;
      if (result.success) {
        candidates.push({
          data: result.data,
          inexactCount,
          zeroDefaultCount,
          fieldCount: -1
          // We'll count this later if needed
        });
        continue;
      }
      errors[i].push(...result.error.issues);
    }
    if (candidates.length === 0) {
      parentUnrecognizedCtr.end(0);
      ctx.addIssue({ input, code: "invalid_union", errors });
      return NEVER;
    }
    let best = candidates[0];
    for (const candidate of candidates) {
      if (candidates.length > 1) {
        candidate.fieldCount = countFieldsRecursive(candidate.data);
      }
      best = better(candidate, best);
    }
    parentUnrecognizedCtr.end(best.inexactCount);
    return best.data;
  });
}
function better(a, b) {
  const aIsExact = a.inexactCount === 0;
  const bIsExact = b.inexactCount === 0;
  if (aIsExact !== bIsExact) {
    return aIsExact ? a : b;
  }
  const actualFieldCountA = a.fieldCount - a.zeroDefaultCount;
  const actualFieldCountB = b.fieldCount - b.zeroDefaultCount;
  if (actualFieldCountA !== actualFieldCountB) {
    return actualFieldCountA > actualFieldCountB ? a : b;
  }
  return a.inexactCount < b.inexactCount ? a : b;
}
function countFieldsRecursive(parsed) {
  let fieldCount = 0;
  const queue = [parsed];
  let index = 0;
  while (index < queue.length) {
    const value = queue[index++];
    if (value === void 0 || isUnknown(value)) {
      continue;
    }
    const type = typeof value;
    if (value === null || type === "number" || type === "string" || type === "boolean" || type === "bigint" || value instanceof Date || value instanceof RFCDate) {
      fieldCount++;
      continue;
    }
    if (Array.isArray(value)) {
      queue.push(...value);
      continue;
    }
    if (type === "object") {
      queue.push(...Object.values(value));
    }
  }
  return fieldCount;
}

// node_modules/@mistralai/mistralai/esm/models/components/audiochunk.js
var AudioChunk$inboundSchema = object({
  type: literal("input_audio"),
  input_audio: string()
}).transform((v) => {
  return remap(v, {
    "input_audio": "inputAudio"
  });
});
var AudioChunk$outboundSchema = object({
  type: literal("input_audio"),
  inputAudio: string()
}).transform((v) => {
  return remap(v, {
    inputAudio: "input_audio"
  });
});

// node_modules/@mistralai/mistralai/esm/models/components/documenturlchunk.js
var DocumentURLChunk$inboundSchema = object({
  type: literal("document_url").default("document_url"),
  document_url: string(),
  document_name: nullable(string()).optional()
}).transform((v) => {
  return remap(v, {
    "document_url": "documentUrl",
    "document_name": "documentName"
  });
});
var DocumentURLChunk$outboundSchema = object({
  type: literal("document_url").default("document_url"),
  documentUrl: string(),
  documentName: nullable(string()).optional()
}).transform((v) => {
  return remap(v, {
    documentUrl: "document_url",
    documentName: "document_name"
  });
});

// node_modules/@mistralai/mistralai/esm/models/components/filechunk.js
var FileChunk$inboundSchema = object({
  type: literal("file").default("file"),
  file_id: string()
}).transform((v) => {
  return remap(v, {
    "file_id": "fileId"
  });
});
var FileChunk$outboundSchema = object({
  type: literal("file").default("file"),
  fileId: string()
}).transform((v) => {
  return remap(v, {
    fileId: "file_id"
  });
});

// node_modules/@mistralai/mistralai/esm/models/components/imagedetail.js
var ImageDetail = {
  Low: "low",
  Auto: "auto",
  High: "high"
};
var ImageDetail$inboundSchema = inboundSchema(ImageDetail);
var ImageDetail$outboundSchema = outboundSchema(ImageDetail);

// node_modules/@mistralai/mistralai/esm/models/components/imageurl.js
var ImageURL$inboundSchema = object({
  url: string(),
  detail: nullable(ImageDetail$inboundSchema).optional()
});
var ImageURL$outboundSchema = object({
  url: string(),
  detail: nullable(ImageDetail$outboundSchema).optional()
});

// node_modules/@mistralai/mistralai/esm/models/components/imageurlchunk.js
var ImageUrlUnion$inboundSchema = smartUnion([ImageURL$inboundSchema, string()]);
var ImageUrlUnion$outboundSchema = smartUnion([ImageURL$outboundSchema, string()]);
var ImageURLChunk$inboundSchema = object({
  type: literal("image_url").default("image_url"),
  image_url: smartUnion([ImageURL$inboundSchema, string()])
}).transform((v) => {
  return remap(v, {
    "image_url": "imageUrl"
  });
});
var ImageURLChunk$outboundSchema = object({
  type: literal("image_url").default("image_url"),
  imageUrl: smartUnion([ImageURL$outboundSchema, string()])
}).transform((v) => {
  return remap(v, {
    imageUrl: "image_url"
  });
});

// node_modules/@mistralai/mistralai/esm/models/components/referencechunk.js
var ReferenceId$inboundSchema = smartUnion([int(), string()]);
var ReferenceId$outboundSchema = smartUnion([int(), string()]);
var ReferenceChunk$inboundSchema = object({
  type: literal("reference").default("reference"),
  reference_ids: array(smartUnion([int(), string()]))
}).transform((v) => {
  return remap(v, {
    "reference_ids": "referenceIds"
  });
});
var ReferenceChunk$outboundSchema = object({
  type: literal("reference").default("reference"),
  referenceIds: array(smartUnion([int(), string()]))
}).transform((v) => {
  return remap(v, {
    referenceIds: "reference_ids"
  });
});

// node_modules/@mistralai/mistralai/esm/models/components/textchunk.js
var TextChunk$inboundSchema = object({
  type: literal("text").default("text"),
  text: string()
});
var TextChunk$outboundSchema = object({
  type: literal("text").default("text"),
  text: string()
});

// node_modules/@mistralai/mistralai/esm/models/components/builtinconnectors.js
var BuiltInConnectors = {
  WebSearch: "web_search",
  WebSearchPremium: "web_search_premium",
  CodeInterpreter: "code_interpreter",
  ImageGeneration: "image_generation",
  DocumentLibrary: "document_library"
};
var BuiltInConnectors$inboundSchema = inboundSchema(BuiltInConnectors);
var BuiltInConnectors$outboundSchema = outboundSchema(BuiltInConnectors);

// node_modules/@mistralai/mistralai/esm/models/components/toolreferencechunk.js
var ToolReferenceChunkTool$inboundSchema = smartUnion([BuiltInConnectors$inboundSchema, string()]);
var ToolReferenceChunkTool$outboundSchema = smartUnion([BuiltInConnectors$outboundSchema, string()]);
var ToolReferenceChunk$inboundSchema = object({
  type: literal("tool_reference").default("tool_reference"),
  tool: smartUnion([BuiltInConnectors$inboundSchema, string()]),
  title: string(),
  url: nullable(string()).optional(),
  favicon: nullable(string()).optional(),
  description: nullable(string()).optional()
});
var ToolReferenceChunk$outboundSchema = object({
  type: literal("tool_reference").default("tool_reference"),
  tool: smartUnion([BuiltInConnectors$outboundSchema, string()]),
  title: string(),
  url: nullable(string()).optional(),
  favicon: nullable(string()).optional(),
  description: nullable(string()).optional()
});

// node_modules/@mistralai/mistralai/esm/models/components/thinkchunk.js
var Thinking$inboundSchema = smartUnion([
  ToolReferenceChunk$inboundSchema,
  TextChunk$inboundSchema,
  ReferenceChunk$inboundSchema
]);
var Thinking$outboundSchema = smartUnion([
  ToolReferenceChunk$outboundSchema,
  TextChunk$outboundSchema,
  ReferenceChunk$outboundSchema
]);
var ThinkChunk$inboundSchema = object({
  type: literal("thinking").default("thinking"),
  thinking: array(smartUnion([
    ToolReferenceChunk$inboundSchema,
    TextChunk$inboundSchema,
    ReferenceChunk$inboundSchema
  ])),
  signature: nullable(string()).optional(),
  closed: boolean().optional()
});
var ThinkChunk$outboundSchema = object({
  type: literal("thinking").default("thinking"),
  thinking: array(smartUnion([
    ToolReferenceChunk$outboundSchema,
    TextChunk$outboundSchema,
    ReferenceChunk$outboundSchema
  ])),
  signature: nullable(string()).optional(),
  closed: boolean().optional()
});

// node_modules/@mistralai/mistralai/esm/models/components/contentchunk.js
var ContentChunk$inboundSchema = discriminatedUnion("type", {
  image_url: ImageURLChunk$inboundSchema.and(object({ type: literal("image_url") })),
  document_url: DocumentURLChunk$inboundSchema.and(object({ type: literal("document_url") })),
  text: TextChunk$inboundSchema.and(object({ type: literal("text") })),
  reference: ReferenceChunk$inboundSchema.and(object({ type: literal("reference") })),
  file: FileChunk$inboundSchema.and(object({ type: literal("file") })),
  thinking: ThinkChunk$inboundSchema.and(object({ type: literal("thinking") })),
  input_audio: AudioChunk$inboundSchema
});
var ContentChunk$outboundSchema = union([
  ImageURLChunk$outboundSchema.and(object({ type: literal("image_url") })),
  DocumentURLChunk$outboundSchema.and(object({ type: literal("document_url") })),
  TextChunk$outboundSchema.and(object({ type: literal("text") })),
  ReferenceChunk$outboundSchema.and(object({ type: literal("reference") })),
  FileChunk$outboundSchema.and(object({ type: literal("file") })),
  ThinkChunk$outboundSchema.and(object({ type: literal("thinking") })),
  AudioChunk$outboundSchema
]);

// node_modules/@mistralai/mistralai/esm/models/components/functioncall.js
var Arguments$inboundSchema = smartUnion([record(string(), any()), string()]);
var Arguments$outboundSchema = smartUnion([record(string(), any()), string()]);
var FunctionCall$inboundSchema = object({
  name: string(),
  arguments: smartUnion([record(string(), any()), string()])
});
var FunctionCall$outboundSchema = object({
  name: string(),
  arguments: smartUnion([record(string(), any()), string()])
});

// node_modules/@mistralai/mistralai/esm/models/components/tooltypes.js
var ToolTypes = {
  Function: "function"
};
var ToolTypes$inboundSchema = inboundSchema(ToolTypes);
var ToolTypes$outboundSchema = outboundSchema(ToolTypes);

// node_modules/@mistralai/mistralai/esm/models/components/toolcall.js
var ToolCall$inboundSchema = object({
  id: string().default("null"),
  type: ToolTypes$inboundSchema.default("function"),
  function: FunctionCall$inboundSchema,
  index: int().default(0)
});
var ToolCall$outboundSchema = object({
  id: string().default("null"),
  type: ToolTypes$outboundSchema.default("function"),
  function: FunctionCall$outboundSchema,
  index: int().default(0)
});

// node_modules/@mistralai/mistralai/esm/models/components/deltamessage.js
var DeltaMessageContent$inboundSchema = smartUnion([string(), array(ContentChunk$inboundSchema)]);
var DeltaMessage$inboundSchema = object({
  role: nullable(string()).optional(),
  content: nullable(smartUnion([string(), array(ContentChunk$inboundSchema)])).optional(),
  tool_calls: nullable(array(ToolCall$inboundSchema)).optional(),
  tool_call_id: nullable(string()).optional(),
  index: nullable(int()).optional(),
  metadata: nullable(record(string(), any())).optional()
}).transform((v) => {
  return remap(v, {
    "tool_calls": "toolCalls",
    "tool_call_id": "toolCallId"
  });
});

// node_modules/@mistralai/mistralai/esm/models/components/completionresponsestreamchoice.js
var CompletionResponseStreamChoiceFinishReason = {
  Stop: "stop",
  Length: "length",
  Error: "error",
  ToolCalls: "tool_calls"
};
var CompletionResponseStreamChoiceFinishReason$inboundSchema = inboundSchema(CompletionResponseStreamChoiceFinishReason);
var CompletionResponseStreamChoice$inboundSchema = object({
  index: int(),
  delta: DeltaMessage$inboundSchema,
  finish_reason: nullable(CompletionResponseStreamChoiceFinishReason$inboundSchema)
}).transform((v) => {
  return remap(v, {
    "finish_reason": "finishReason"
  });
});

// node_modules/@mistralai/mistralai/esm/models/components/completionchunk.js
var CompletionChunk$inboundSchema = object({
  id: string(),
  object: string().optional(),
  created: int().optional(),
  model: string(),
  usage: UsageInfo$inboundSchema.optional(),
  choices: array(CompletionResponseStreamChoice$inboundSchema)
});
function completionChunkFromJSON(jsonString) {
  return safeParse(jsonString, (x) => CompletionChunk$inboundSchema.parse(JSON.parse(x)), `Failed to parse 'CompletionChunk' from JSON`);
}

export {
  registerTracerProvider,
  getRegisteredTracerProvider,
  formatZodError,
  OK,
  ERR,
  unwrapAsync,
  safeParse,
  remap,
  compactMap,
  inboundSchema,
  inboundSchemaInt,
  outboundSchema,
  outboundSchemaInt,
  discriminatedUnion,
  smartUnion,
  DocumentURLChunk$inboundSchema,
  DocumentURLChunk$outboundSchema,
  FileChunk$outboundSchema,
  ImageURLChunk$inboundSchema,
  ImageURLChunk$outboundSchema,
  TextChunk$inboundSchema,
  TextChunk$outboundSchema,
  BuiltInConnectors$inboundSchema,
  BuiltInConnectors$outboundSchema,
  ToolReferenceChunk$inboundSchema,
  ToolReferenceChunk$outboundSchema,
  ThinkChunk$inboundSchema,
  ThinkChunk$outboundSchema,
  ContentChunk$inboundSchema,
  ContentChunk$outboundSchema,
  ToolTypes$inboundSchema,
  ToolTypes$outboundSchema,
  ToolCall$inboundSchema,
  ToolCall$outboundSchema,
  DeltaMessage$inboundSchema,
  UsageInfo$inboundSchema,
  UsageInfo$outboundSchema,
  CompletionChunk$inboundSchema,
  completionChunkFromJSON
};
