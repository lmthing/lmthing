import type { FunctionDefinition, FunctionAgentDefinition } from './types';
import type { FunctionRegistry } from './FunctionRegistry';

const SANDBOX_TIMEOUT_MS = 5000;

function isBrowserEnvironment(): boolean {
  const g = globalThis as any;
  return typeof g.window !== 'undefined' && typeof g.document !== 'undefined';
}

function getValueByPath(target: Record<string, any>, path: string): any {
  const parts = path.split('.');
  let current: any = target;

  for (const part of parts) {
    if (current == null) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

function collectCallablePaths(target: Record<string, any>, prefix = ''): string[] {
  const paths: string[] = [];

  for (const [key, value] of Object.entries(target)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'function') {
      paths.push(fullPath);
      continue;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      paths.push(...collectCallablePaths(value, fullPath));
    }
  }

  return paths;
}

function escapeScriptCloseTag(input: string): string {
  return input.replace(/<\/script>/gi, '<\\/script>');
}

async function executeSandboxInNode(code: string, sandboxObject: Record<string, any>): Promise<any> {
  const { VM } = await import('vm2');

  const vm = new VM({
    timeout: SANDBOX_TIMEOUT_MS,
    sandbox: sandboxObject,
    eval: false,
    wasm: false,
  });

  const wrappedCode = `(async () => {\n${code}\n})()`;
  return vm.run(wrappedCode);
}

async function executeSandboxInBrowser(code: string, sandboxObject: Record<string, any>): Promise<any> {
  const g = globalThis as any;
  const documentRef = g.document as any;
  const iframe = documentRef.createElement('iframe') as any;
  const channel = `lmthing-sandbox-${Math.random().toString(36).slice(2)}`;
  const callablePaths = collectCallablePaths(sandboxObject).filter((path) => !path.startsWith('console.'));

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      if (settled) {
        return;
      }
      settled = true;
      g.removeEventListener('message', onMessage);
      if (timeoutId) {
        g.clearTimeout(timeoutId);
      }
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    const finishWithError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const timeoutId = g.setTimeout(() => {
      finishWithError(new Error(`Sandbox execution timed out after ${SANDBOX_TIMEOUT_MS}ms`));
    }, SANDBOX_TIMEOUT_MS);

    const onMessage = async (event: any) => {
      if (event.source !== iframe.contentWindow) {
        return;
      }

      const data = event.data;
      if (!data || data.__sandboxChannel !== channel) {
        return;
      }

      if (data.type === 'sandbox-result') {
        cleanup();
        resolve(data.result);
        return;
      }

      if (data.type === 'sandbox-error') {
        finishWithError(new Error(data.error || 'Sandbox execution failed'));
        return;
      }

      if (data.type === 'sandbox-call') {
        const { callId, path, arg } = data;
        try {
          const fn = getValueByPath(sandboxObject, path);
          if (typeof fn !== 'function') {
            throw new Error(`Sandbox function not found: ${path}`);
          }

          const result = await Promise.resolve(fn(arg));
          iframe.contentWindow?.postMessage(
            {
              __sandboxChannel: channel,
              type: 'sandbox-call-result',
              callId,
              result,
            },
            '*'
          );
        } catch (error: any) {
          iframe.contentWindow?.postMessage(
            {
              __sandboxChannel: channel,
              type: 'sandbox-call-error',
              callId,
              error: error?.message || String(error),
            },
            '*'
          );
        }
      }
    };

    g.addEventListener('message', onMessage);

    const iframeScript = `
      (() => {
        const CHANNEL = ${JSON.stringify(channel)};
        const FUNCTION_PATHS = ${JSON.stringify(callablePaths)};
        const USER_CODE = ${JSON.stringify(code)};

        const pendingCalls = new Map();
        let callCounter = 0;

        const send = (payload) => {
          window.parent.postMessage({ __sandboxChannel: CHANNEL, ...payload }, '*');
        };

        const onMessage = (event) => {
          const data = event.data;
          if (!data || data.__sandboxChannel !== CHANNEL) {
            return;
          }

          if (data.type === 'sandbox-call-result' || data.type === 'sandbox-call-error') {
            const pending = pendingCalls.get(data.callId);
            if (!pending) {
              return;
            }

            pendingCalls.delete(data.callId);
            if (data.type === 'sandbox-call-error') {
              pending.reject(new Error(data.error || 'Sandbox call failed'));
            } else {
              pending.resolve(data.result);
            }
          }
        };

        window.addEventListener('message', onMessage);

        const callParent = (path, arg) => {
          const callId = 'call-' + Date.now() + '-' + (++callCounter);
          return new Promise((resolve, reject) => {
            pendingCalls.set(callId, { resolve, reject });
            send({ type: 'sandbox-call', callId, path, arg });
          });
        };

        const createSandbox = () => {
          const sandbox = {
            console: {
              log: (...args) => console.log('[Sandbox]', ...args),
              warn: (...args) => console.warn('[Sandbox]', ...args),
              error: (...args) => console.error('[Sandbox]', ...args),
            },
          };

          const createPathFunction = (path) => async (arg) => callParent(path, arg);

          for (const path of FUNCTION_PATHS) {
            const parts = path.split('.');
            let current = sandbox;

            for (let i = 0; i < parts.length; i++) {
              const part = parts[i];
              const isLast = i === parts.length - 1;

              if (isLast) {
                current[part] = createPathFunction(path);
              } else {
                current[part] = current[part] || {};
                current = current[part];
              }
            }
          }

          return sandbox;
        };

        const run = async () => {
          const sandbox = createSandbox();
          const runner = new Function(
            '__sandbox',
            'return (async () => { with (__sandbox) { ' + USER_CODE + ' } })();'
          );

          try {
            const result = await runner(sandbox);
            send({ type: 'sandbox-result', result });
          } catch (error) {
            const message = error && error.message ? error.message : String(error);
            send({ type: 'sandbox-error', error: message });
          } finally {
            window.removeEventListener('message', onMessage);
          }
        };

        run();
      })();
    `;

    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('style', 'display:none;');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.srcdoc = `<script>${escapeScriptCloseTag(iframeScript)}<\/script>`;
    documentRef.body.appendChild(iframe);
  });
}

/**
 * Creates wrapped version of a function with validation and callbacks
 */
function createWrappedFunction(definition: FunctionDefinition) {
  return async (args: any) => {
    const { inputSchema, responseSchema, execute, options } = definition;
    let validatedInput: any;

    try {
      // Validate input using Zod
      validatedInput = inputSchema.parse(args);

      // Execute beforeCall callback if provided
      if (options.beforeCall) {
        const beforeResult = await Promise.resolve(options.beforeCall(validatedInput, undefined));
        if (beforeResult !== undefined) {
          // Short-circuit execution
          return beforeResult;
        }
      }

      // Execute the actual function
      let output = await Promise.resolve(execute(validatedInput));

      // Validate output using responseSchema
      output = responseSchema.parse(output);

      // Execute onSuccess callback if provided
      if (options.onSuccess) {
        const successResult = await Promise.resolve(options.onSuccess(validatedInput, output));
        if (successResult !== undefined) {
          output = successResult;
        }
      }

      return output;
    } catch (error) {
      // Execute onError callback if provided
      if (options.onError && error instanceof Error) {
        const errorResult = await Promise.resolve(options.onError(validatedInput || args, error));
        if (errorResult !== undefined) {
          return errorResult;
        }
      }
      throw error;
    }
  };
}

/**
 * Creates wrapped version of a function agent with validation and callbacks
 */
function createWrappedAgent(definition: FunctionAgentDefinition, parentPrompt: any, StatefulPromptClass: any) {
  return async (args: any) => {
    const { inputSchema, responseSchema, execute, options } = definition;
    let validatedInput: any;

    try {
      // Validate input using Zod
      validatedInput = inputSchema.parse(args);

      // Execute beforeCall callback if provided
      if (options.beforeCall) {
        const beforeResult = await Promise.resolve(options.beforeCall(validatedInput, undefined));
        if (beforeResult !== undefined) {
          // Short-circuit execution
          return beforeResult;
        }
      }

      // Create child prompt for agent
      const { model, system, plugins, ...otherOptions } = options;
      const childPrompt = StatefulPromptClass.create(model || parentPrompt.getModel());
      childPrompt.withOptions(otherOptions || parentPrompt.getOptions());

      // Set plugins if provided
      if (plugins) {
        childPrompt.setPlugins(plugins);
      }

      // Helper to convert Zod schema to JSON Schema (simplified version)
      const zodToJsonSchema = (schema: any): any => {
        // This is a simplified version - you may want to use a proper zod-to-json-schema library
        return { type: 'object' };
      };

      // Add response schema instruction to system prompt
      const schemaInstruction = `You must respond with valid JSON that matches this schema:\n\n${JSON.stringify(zodToJsonSchema(responseSchema), null, 2)}\n\nIMPORTANT: Your response must be ONLY valid JSON matching this schema, with no additional text before or after.`;
      const finalSystem = system ? `${system}\n\n${schemaInstruction}` : schemaInstruction;
      childPrompt.defSystem('responseFormat', finalSystem);

      // Execute the agent function (configure the child prompt)
      await Promise.resolve(execute(validatedInput, childPrompt));

      // Run the agent
      const result = childPrompt.run();
      const lastResponse = await result.text;

      // Parse and validate response against schema
      let output;
      try {
        output = JSON.parse(lastResponse);
        output = responseSchema.parse(output);
      } catch (parseError: any) {
        throw new Error(`Agent response validation failed: ${parseError.message || String(parseError)}`);
      }

      // Execute onSuccess callback if provided
      if (options.onSuccess) {
        const successResult = await Promise.resolve(options.onSuccess(validatedInput, output));
        if (successResult !== undefined) {
          output = successResult;
        }
      }

      return output;
    } catch (error) {
      // Execute onError callback if provided
      if (options.onError && error instanceof Error) {
        const errorResult = await Promise.resolve(options.onError(validatedInput || args, error));
        if (errorResult !== undefined) {
          return errorResult;
        }
      }
      throw error;
    }
  };
}

/**
 * Creates sandbox object with all registered functions and agents
 */
function createSandboxObject(registry: FunctionRegistry, parentPrompt: any, StatefulPromptClass: any): Record<string, any> {
  const sandbox: Record<string, any> = {
    console: {
      log: (...args: any[]) => console.log('[Sandbox]', ...args),
      error: (...args: any[]) => console.error('[Sandbox]', ...args),
      warn: (...args: any[]) => console.warn('[Sandbox]', ...args),
    },
  };

  for (const [name, value] of registry.getAll().entries()) {
    if ('execute' in value) {
      // Single function or agent
      if ('isAgent' in value && value.isAgent) {
        sandbox[name] = createWrappedAgent(value as FunctionAgentDefinition, parentPrompt, StatefulPromptClass);
      } else {
        sandbox[name] = createWrappedFunction(value as FunctionDefinition);
      }
    } else {
      // Composite function/agent (namespace)
      sandbox[name] = {};
      for (const [subName, definition] of Object.entries(value as Record<string, FunctionDefinition | FunctionAgentDefinition>)) {
        if ('isAgent' in definition && definition.isAgent) {
          sandbox[name][subName] = createWrappedAgent(definition as FunctionAgentDefinition, parentPrompt, StatefulPromptClass);
        } else {
          sandbox[name][subName] = createWrappedFunction(definition as FunctionDefinition);
        }
      }
    }
  }

  return sandbox;
}

/**
 * Executes user code in a secure sandbox
 */
export async function executeSandbox(code: string, registry: FunctionRegistry, parentPrompt?: any, StatefulPromptClass?: any): Promise<any> {
  // Create sandbox with wrapped functions and agents
  const sandboxObject = createSandboxObject(registry, parentPrompt, StatefulPromptClass);

  return executeSandboxWithObject(code, sandboxObject);
}

/**
 * Executes user code in a secure sandbox using a provided sandbox object.
 */
export async function executeSandboxWithObject(code: string, sandboxObject: Record<string, any>): Promise<any> {

  if (isBrowserEnvironment()) {
    return executeSandboxInBrowser(code, sandboxObject);
  }

  return executeSandboxInNode(code, sandboxObject);
}
