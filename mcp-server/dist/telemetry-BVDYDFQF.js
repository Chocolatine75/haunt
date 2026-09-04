import { createRequire } from 'module'; const require = createRequire(import.meta.url);
import {
  OTEL_SERVICE_NAME
} from "./chunk-F2O6X655.js";
import {
  getRegisteredTracerProvider
} from "./chunk-3IGCGY6U.js";
import "./chunk-5HT2UXVQ.js";
import "./chunk-ZO3ASFWY.js";

// node_modules/@mistralai/mistralai/esm/extra/observability/telemetry.js
import { trace } from "@opentelemetry/api";

// node_modules/@mistralai/mistralai/esm/extra/observability/redaction-policies.js
var DEFAULT_REDACTED_VALUE = "[REDACTED]";
function defaultRedactionPolicy() {
  return new RegexRedactionPolicy();
}
var RedactionPolicy = class {
  /** Return the span name to export. Defaults to unchanged. */
  redactSpanName(name) {
    return name;
  }
  /** Return the status description to export. Defaults to unchanged. */
  redactStatusDescription(description) {
    return description;
  }
};
var DEFAULT_TOKEN_PATTERNS = [
  /bearer\s+[a-z0-9._-]+/gi,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  /\b[sr]k_(?:live|test)_[0-9A-Za-z]{10,}\b/g,
  // AI providers
  /\bsk-ant-[A-Za-z0-9\-_]{20,}\b/g,
  /\bsk-proj-[A-Za-z0-9\-_]{20,}\b/g,
  /\bhf_[A-Za-z0-9]{30,}\b/g,
  // Dev / infra tokens
  /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g,
  /\bglpat-[A-Za-z0-9\-=_]{20,22}\b/g,
  /\bshp(?:at|ca|pa|ss)_[a-fA-F0-9]{32}\b/g,
  /\bsq0(?:atp|csp|idp)-[0-9A-Za-z\-_]{22,43}\b/g,
  /\bPMAK-[a-zA-Z0-9]{24,59}\b/g,
  /\bphc_[a-zA-Z0-9_]{43}\b/g,
  /\brubygems_[a-f0-9]{48}\b/g,
  /\blin_api_[0-9A-Za-z]{40}\b/g,
  /pypi-AgEIcHlwaS5vcmc[A-Za-z0-9\-_]{50,}/g,
  /\bsecret_[A-Za-z0-9]{43}\b/g,
  /[A-Za-z0-9]{14}\.atlasv1\.[A-Za-z0-9]{60,}/g,
  /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g,
  /\bpk_(?:live|test)_[0-9a-zA-Z]{24}\b/g,
  // Webhook URLs (the whole URL is the secret)
  /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/+]{40,}/g,
  /https:\/\/discord(?:app)?\.com\/api\/webhooks\/[0-9]{17,}\/[A-Za-z0-9\-_]{60,}/g,
  /https:\/\/hooks\.zapier\.com\/hooks\/catch\/[A-Za-z0-9/]{16,}/g
];
var DEFAULT_PII_SECRET_PATTERNS = [
  ...DEFAULT_TOKEN_PATTERNS,
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  // Credit-card-like sequences (13-16 digits, optional spaces/dashes)
  /\b(?:\d[ -]?){13,16}\b/g,
  // IPv4 addresses
  /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g
];
var RegexRedactionPolicy = class extends RedactionPolicy {
  patterns;
  redactedValue;
  constructor(patterns = DEFAULT_PII_SECRET_PATTERNS, options = {}) {
    super();
    this.patterns = patterns;
    this.redactedValue = options.redactedValue ?? DEFAULT_REDACTED_VALUE;
  }
  redactAttributes(attributes) {
    const redacted = {};
    if (attributes == null) {
      return redacted;
    }
    for (const [key, value] of Object.entries(attributes)) {
      if (value === void 0) {
        continue;
      }
      redacted[key] = redactValue(value, this.patterns, this.redactedValue);
    }
    return redacted;
  }
  redactSpanName(name) {
    return redactText(name, this.patterns, this.redactedValue);
  }
  redactStatusDescription(description) {
    if (description == null) {
      return description;
    }
    return redactText(description, this.patterns, this.redactedValue);
  }
};
var CallbackRedactionPolicy = class extends RedactionPolicy {
  maskFunction;
  constructor(maskFunction) {
    super();
    this.maskFunction = maskFunction;
  }
  redactAttributes(attributes) {
    const redacted = {};
    if (attributes == null) {
      return redacted;
    }
    for (const [key, value] of Object.entries(attributes)) {
      if (value === void 0) {
        continue;
      }
      const masked = this.maskFunction(key, value);
      if (masked === void 0) {
        continue;
      }
      redacted[key] = masked;
    }
    return redacted;
  }
};
function redactValue(value, patterns, redactedValue = DEFAULT_REDACTED_VALUE) {
  return redactValueCounting(value, patterns, redactedValue)[0];
}
function redactValueCounting(value, patterns, redactedValue = DEFAULT_REDACTED_VALUE) {
  if (typeof value === "string") {
    return redactTextCounting(value, patterns, redactedValue);
  }
  if (Array.isArray(value)) {
    let total = 0;
    const items = value.map((item) => {
      if (typeof item === "string") {
        const [redactedItem, count] = redactTextCounting(item, patterns, redactedValue);
        total += count;
        return redactedItem;
      }
      return item;
    });
    return [items, total];
  }
  return [value, 0];
}
function redactText(text, patterns, redactedValue = DEFAULT_REDACTED_VALUE) {
  return redactTextCounting(text, patterns, redactedValue)[0];
}
function redactTextCounting(text, patterns, redactedValue = DEFAULT_REDACTED_VALUE) {
  let redacted = text;
  let total = 0;
  for (const pattern of patterns) {
    redacted = redacted.replace(pattern, () => {
      total += 1;
      return redactedValue;
    });
  }
  return [redacted, total];
}

// node_modules/@mistralai/mistralai/esm/extra/observability/redaction.js
function resolveRedaction(redaction) {
  if (redaction === false) {
    return void 0;
  }
  if (redaction === true) {
    return defaultRedactionPolicy();
  }
  return resolvePolicy(redaction);
}
function resolvePolicy(policy) {
  if (policy == null) {
    return defaultRedactionPolicy();
  }
  if (policy instanceof RedactionPolicy) {
    return policy;
  }
  if (typeof policy === "function") {
    return new CallbackRedactionPolicy(policy);
  }
  throw new TypeError(`redaction policy must be a RedactionPolicy, a callable, or undefined; got ${typeof policy}.`);
}
var RedactingSpanExporter = class {
  exporter;
  policy;
  constructor(exporter, policy) {
    this.exporter = exporter;
    this.policy = resolvePolicy(policy);
  }
  export(spans, resultCallback) {
    const redacted = spans.map((span) => redactSpan(span, this.policy));
    this.exporter.export(redacted, resultCallback);
  }
  shutdown() {
    return this.exporter.shutdown();
  }
  forceFlush() {
    return this.exporter.forceFlush?.() ?? Promise.resolve();
  }
};
function overrideProperty(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true
  });
}
function shallowClone(source) {
  return Object.create(Object.getPrototypeOf(source), Object.getOwnPropertyDescriptors(source));
}
function redactSpan(span, policy) {
  const redacted = shallowClone(span);
  overrideProperty(redacted, "name", policy.redactSpanName(span.name));
  overrideProperty(redacted, "attributes", policy.redactAttributes(span.attributes));
  overrideProperty(redacted, "events", redactEvents(span.events, policy));
  overrideProperty(redacted, "links", redactLinks(span.links, policy));
  overrideProperty(redacted, "resource", redactResource(span.resource, policy));
  overrideProperty(redacted, "status", redactStatus(span.status, policy));
  return redacted;
}
function redactEvents(events, policy) {
  if (events == null) {
    return [];
  }
  return events.map((event) => {
    const redacted = shallowClone(event);
    overrideProperty(redacted, "attributes", policy.redactAttributes(event.attributes));
    return redacted;
  });
}
function redactLinks(links, policy) {
  if (links == null) {
    return [];
  }
  return links.map((link) => {
    const redacted = shallowClone(link);
    overrideProperty(redacted, "attributes", policy.redactAttributes(link.attributes));
    return redacted;
  });
}
function redactResource(resource, policy) {
  if (resource == null) {
    return resource;
  }
  const redacted = shallowClone(resource);
  overrideProperty(redacted, "attributes", policy.redactAttributes(resource.attributes));
  return redacted;
}
function redactStatus(status, policy) {
  if (status == null) {
    return status;
  }
  const message = policy.redactStatusDescription(status.message);
  const redacted = { code: status.code };
  if (message !== void 0) {
    redacted.message = message;
  }
  return redacted;
}

// node_modules/@mistralai/mistralai/esm/extra/observability/telemetry.js
var MISTRAL_SDK_TELEMETRY_ENV = "MISTRAL_SDK_TELEMETRY";
var MISTRAL_TELEMETRY_BASE_URL = "https://api.mistral.ai";
var MISTRAL_TELEMETRY_TRACES_PATH = "/telemetry/v1/traces";
var MISTRAL_TELEMETRY_ENDPOINT = createTelemetryEndpoint(MISTRAL_TELEMETRY_BASE_URL);
var MISTRAL_OTLP_TRACES_ENDPOINT_ENV = "MISTRAL_OTLP_TRACES_ENDPOINT";
var TELEMETRY_PROVIDER_DEDICATED = "dedicated";
var TELEMETRY_PROVIDER_GLOBAL = "global";
var DISABLED_VALUE = "false";
var TelemetryConfigurationError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "TelemetryConfigurationError";
  }
};
async function configureTelemetry(client, provider = TELEMETRY_PROVIDER_DEDICATED, options = {}) {
  const hook = getTracingHook(client);
  const redaction = options.redaction;
  if (typeof provider === "string") {
    const providerMode = resolveProviderMode(provider);
    if (providerMode === TELEMETRY_PROVIDER_GLOBAL) {
      warnRedactionIgnored(redaction, TELEMETRY_PROVIDER_GLOBAL);
      return useGlobalTracerProvider(hook, { replaceExisting: true });
    }
    return configureTelemetryForHook(hook, { baseURL: client._baseURL, options: client._options }, { telemetry: providerMode, replaceExisting: true, redaction });
  }
  warnRedactionIgnored(redaction, "custom");
  markTelemetryConfigurationChanged(hook);
  await attachCustomTracerProvider(hook, provider);
  return true;
}
function warnRedactionIgnored(redaction, mode) {
  if (redaction === false) {
    return;
  }
  warnLog(`Telemetry redaction is only applied in 'dedicated' provider mode, where the Mistral SDK owns the exporter. In '${mode}' mode the application owns the export pipeline; wrap your exporter with RedactingSpanExporter to redact spans. Ignoring the redaction argument.`);
}
async function setTracerProvider(client, provider) {
  return configureTelemetry(client, provider);
}
async function flushTelemetry(client) {
  const hook = getTracingHook(client);
  await hook._autoTelemetryProvider?.forceFlush?.();
}
async function shutdownTelemetry(client) {
  const hook = getTracingHook(client);
  await shutdownTelemetryProvider(hook);
}
function getTelemetryTracer(client, name, version, options) {
  const hook = getTracingHook(client);
  const providerMode = resolveMistralTelemetryEnv();
  return getClientTracerProvider(hook, providerMode === TELEMETRY_PROVIDER_GLOBAL).getTracer(name, version, options);
}
async function configureTelemetryForHook(hook, context, options = {}) {
  const telemetryOverride = options.telemetry;
  const hasTelemetryOverride = telemetryOverride != null;
  const replaceExisting = options.replaceExisting === true;
  if (!hasTelemetryOverride && hasConfiguredAutoTelemetry(hook)) {
    return true;
  }
  if (!hasTelemetryOverride && hook._telemetryAutoDisabled) {
    return false;
  }
  const providerMode = hasTelemetryOverride ? resolveTelemetryMode(telemetryOverride) : resolveMistralTelemetryEnv();
  if (hook._telemetryInitialization !== void 0) {
    if (!replaceExisting && providerMode === TELEMETRY_PROVIDER_DEDICATED) {
      return hook._telemetryInitialization;
    }
    try {
      await hook._telemetryInitialization;
    } catch {
    }
  }
  if (providerMode == null) {
    markTelemetryConfigurationChanged(hook);
    await shutdownTelemetryProvider(hook);
    markAutoTelemetryDisabled(hook);
    return false;
  }
  if (providerMode === TELEMETRY_PROVIDER_GLOBAL) {
    return useGlobalTracerProvider(hook, {
      replaceExisting: replaceExisting || hasTelemetryOverride
    });
  }
  if (hook._autoTelemetryProvider !== void 0) {
    return true;
  }
  if (hook.tracerProvider !== void 0) {
    if (!replaceExisting) {
      return false;
    }
    hook.tracerProvider = void 0;
  }
  if (getRegisteredTracerProvider() !== void 0 && !replaceExisting) {
    return false;
  }
  const configurationVersion = markTelemetryConfigurationChanged(hook);
  const initialization = initializeTelemetryProvider(hook, context, options, configurationVersion);
  hook._telemetryInitialization = initialization;
  try {
    return await initialization;
  } finally {
    if (hook._telemetryInitialization === initialization) {
      hook._telemetryInitialization = void 0;
    }
  }
}
async function initializeTelemetryProvider(hook, context, options, configurationVersion) {
  const createProvider = options.createTelemetryTracerProvider ?? _createTelemetryTracerProvider;
  const provider = await createProvider({
    apiKey: await resolveApiKey(context),
    baseURL: context.baseURL ?? context.options?.serverURL,
    redaction: options.redaction
  });
  if (hook._telemetryConfigurationVersion !== configurationVersion) {
    await provider.shutdown?.();
    return false;
  }
  await attachTelemetryProvider(hook, provider);
  return true;
}
async function _createTelemetryTracerProvider(options) {
  if (options.apiKey == null || options.apiKey === "") {
    throw new TelemetryConfigurationError("Mistral telemetry requires an API key. Pass apiKey to the client or set MISTRAL_API_KEY.");
  }
  const moduleLoader = options.moduleLoader ?? loadModule;
  let sdkTraceBase;
  let otlpExporterModule;
  let resourcesModule;
  try {
    [sdkTraceBase, otlpExporterModule, resourcesModule] = await Promise.all([
      moduleLoader("@opentelemetry/sdk-trace-base"),
      moduleLoader("@opentelemetry/exporter-trace-otlp-http"),
      moduleLoader("@opentelemetry/resources")
    ]);
  } catch {
    throw new TelemetryConfigurationError("Mistral telemetry requires optional OpenTelemetry SDK/exporter dependencies. Install @opentelemetry/sdk-trace-base, @opentelemetry/exporter-trace-otlp-http, and @opentelemetry/resources with your package manager.");
  }
  const BasicTracerProvider = requireExportConstructor(sdkTraceBase, "BasicTracerProvider", "@opentelemetry/sdk-trace-base");
  const BatchSpanProcessor = requireExportConstructor(sdkTraceBase, "BatchSpanProcessor", "@opentelemetry/sdk-trace-base");
  const OTLPTraceExporter = requireExportConstructor(otlpExporterModule, "OTLPTraceExporter", "@opentelemetry/exporter-trace-otlp-http");
  const exporter = new OTLPTraceExporter({
    url: resolveMistralTelemetryEndpoint(options.baseURL),
    headers: { Authorization: asBearerToken(options.apiKey) }
  });
  const policy = resolveRedaction(options.redaction ?? true);
  const spanExporter = policy ? new RedactingSpanExporter(exporter, policy) : exporter;
  const spanProcessor = new BatchSpanProcessor(spanExporter);
  const resource = createResource(resourcesModule, {
    "service.name": OTEL_SERVICE_NAME
  });
  const provider = new BasicTracerProvider({ resource });
  if (typeof provider.addSpanProcessor === "function") {
    provider.addSpanProcessor(spanProcessor);
    return provider;
  }
  return new BasicTracerProvider({
    resource,
    spanProcessors: [spanProcessor]
  });
}
function getTracingHook(client) {
  const hooks = client._options?.hooks;
  const beforeRequestHooks = hooks?.beforeRequestHooks;
  if (!Array.isArray(beforeRequestHooks)) {
    throw new Error("Cannot configure telemetry: SDK hooks not initialised.");
  }
  const hook = beforeRequestHooks.find(isTelemetryCapableTracingHook);
  if (hook === void 0) {
    throw new Error("Cannot configure telemetry: TracingHook not found in the client's hooks.");
  }
  return hook;
}
function isTelemetryCapableTracingHook(hook) {
  return Boolean(hook && typeof hook === "object" && hook._mistralTracingHook === true);
}
function getClientTracerProvider(hook, usesGlobalProvider) {
  if (hook.tracerProvider !== void 0) {
    return hook.tracerProvider;
  }
  if (!usesGlobalProvider && !hook._telemetryUseGlobalProvider) {
    const registeredProvider = getRegisteredTracerProvider();
    if (registeredProvider !== void 0) {
      return registeredProvider;
    }
  }
  return trace.getTracerProvider();
}
function resolveTelemetryMode(value) {
  if (typeof value === "boolean") {
    return value ? TELEMETRY_PROVIDER_DEDICATED : null;
  }
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case TELEMETRY_PROVIDER_DEDICATED:
      return TELEMETRY_PROVIDER_DEDICATED;
    case TELEMETRY_PROVIDER_GLOBAL:
      return TELEMETRY_PROVIDER_GLOBAL;
    case DISABLED_VALUE:
      return null;
  }
  throw new TelemetryConfigurationError(`Invalid telemetry setting ${JSON.stringify(value)}. Expected one of: dedicated, false, global.`);
}
function resolveProviderMode(value) {
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case TELEMETRY_PROVIDER_DEDICATED:
      return TELEMETRY_PROVIDER_DEDICATED;
    case TELEMETRY_PROVIDER_GLOBAL:
      return TELEMETRY_PROVIDER_GLOBAL;
  }
  throw new TelemetryConfigurationError(`Invalid telemetry provider ${JSON.stringify(value)}. Expected one of: dedicated, global.`);
}
function resolveMistralTelemetryEnv() {
  const envValue = readEnv(MISTRAL_SDK_TELEMETRY_ENV);
  if (envValue == null || envValue === "") {
    return null;
  }
  try {
    return resolveTelemetryMode(envValue);
  } catch {
    throw new TelemetryConfigurationError(`Invalid ${MISTRAL_SDK_TELEMETRY_ENV}=${JSON.stringify(envValue)}. Expected one of: dedicated, false, global.`);
  }
}
async function resolveApiKey(context) {
  const authHeader = context.resolvedSecurity?.headers?.["Authorization"];
  if (authHeader) {
    return authHeader;
  }
  const apiKey = await resolveApiKeySource(context.options?.apiKey);
  if (apiKey) {
    return apiKey;
  }
  const envApiKey = readEnv("MISTRAL_API_KEY");
  if (envApiKey) {
    return envApiKey;
  }
  throw new TelemetryConfigurationError("Mistral telemetry requires an API key. Pass apiKey to the client or set MISTRAL_API_KEY.");
}
async function resolveApiKeySource(source) {
  if (source == null) {
    return void 0;
  }
  return typeof source === "function" ? source() : source;
}
function resolveMistralTelemetryEndpoint(baseURL) {
  const endpoint = readEnv(MISTRAL_OTLP_TRACES_ENDPOINT_ENV)?.trim();
  if (endpoint) {
    return endpoint;
  }
  if (baseURL != null && `${baseURL}`.trim() !== "") {
    return createTelemetryEndpoint(baseURL);
  }
  return MISTRAL_TELEMETRY_ENDPOINT;
}
function createTelemetryEndpoint(baseURL) {
  return new URL(MISTRAL_TELEMETRY_TRACES_PATH, baseURL).toString();
}
async function attachTelemetryProvider(hook, provider) {
  await shutdownTelemetryProvider(hook);
  hook.tracerProvider = provider;
  hook._autoTelemetryProvider = provider;
  hook._telemetryUseGlobalProvider = false;
  hook._telemetryAutoDisabled = false;
}
function hasConfiguredAutoTelemetry(hook) {
  return hook._autoTelemetryProvider !== void 0 || hook._telemetryUseGlobalProvider;
}
function markAutoTelemetryDisabled(hook) {
  hook._telemetryUseGlobalProvider = false;
  hook._telemetryAutoDisabled = true;
}
function markTelemetryConfigurationChanged(hook) {
  hook._telemetryConfigurationVersion += 1;
  return hook._telemetryConfigurationVersion;
}
async function attachCustomTracerProvider(hook, provider) {
  await shutdownTelemetryProvider(hook);
  hook.tracerProvider = provider;
  hook._telemetryUseGlobalProvider = false;
  hook._telemetryAutoDisabled = false;
}
async function useGlobalTracerProvider(hook, options) {
  if (hook.tracerProvider !== void 0 && hook._autoTelemetryProvider === void 0 && !options.replaceExisting) {
    return false;
  }
  markTelemetryConfigurationChanged(hook);
  await shutdownTelemetryProvider(hook);
  hook.tracerProvider = void 0;
  hook._telemetryUseGlobalProvider = true;
  hook._telemetryAutoDisabled = true;
  return true;
}
async function shutdownTelemetryProvider(hook) {
  const provider = hook._autoTelemetryProvider;
  if (provider === void 0) {
    return;
  }
  hook._autoTelemetryProvider = void 0;
  if (hook.tracerProvider === provider) {
    hook.tracerProvider = void 0;
  }
  await provider.shutdown?.();
}
function asBearerToken(apiKey) {
  return apiKey.toLowerCase().startsWith("bearer ") ? apiKey : `Bearer ${apiKey}`;
}
function readEnv(name) {
  try {
    const denoEnv = globalThis.Deno?.env;
    const denoValue = denoEnv?.get?.(name);
    if (denoValue !== void 0) {
      return denoValue;
    }
  } catch {
  }
  try {
    return globalThis.process?.env?.[name];
  } catch {
    return void 0;
  }
}
function warnLog(message) {
  try {
    globalThis.console?.warn?.(message);
  } catch {
  }
}
async function loadModule(specifier) {
  return await import(
    /* webpackIgnore: true */
    /* turbopackIgnore: true */
    /* @vite-ignore */
    specifier
  );
}
function requireExportConstructor(moduleExports, exportName, moduleName) {
  const value = moduleExports[exportName];
  if (typeof value !== "function") {
    throw new TelemetryConfigurationError(`Mistral telemetry expected ${moduleName} to export ${exportName}.`);
  }
  return value;
}
function createResource(moduleExports, attributes) {
  const resourceFromAttributes = moduleExports["resourceFromAttributes"];
  if (typeof resourceFromAttributes === "function") {
    return resourceFromAttributes(attributes);
  }
  const Resource = moduleExports["Resource"];
  if (typeof Resource !== "function") {
    return { attributes };
  }
  const resource = new Resource(attributes);
  const defaultResource = Resource.default?.();
  return defaultResource?.merge?.(resource) ?? resource;
}
export {
  MISTRAL_OTLP_TRACES_ENDPOINT_ENV,
  MISTRAL_SDK_TELEMETRY_ENV,
  MISTRAL_TELEMETRY_BASE_URL,
  MISTRAL_TELEMETRY_ENDPOINT,
  MISTRAL_TELEMETRY_TRACES_PATH,
  TELEMETRY_PROVIDER_DEDICATED,
  TELEMETRY_PROVIDER_GLOBAL,
  TelemetryConfigurationError,
  _createTelemetryTracerProvider,
  configureTelemetry,
  configureTelemetryForHook,
  flushTelemetry,
  getTelemetryTracer,
  setTracerProvider,
  shutdownTelemetry
};
