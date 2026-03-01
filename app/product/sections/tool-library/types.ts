/**
 * Tool Library Section Types
 */

// Tool source origin
export type ToolSource = "builtin" | "package";

// Tool operational status
export type ToolStatus = "enabled" | "disabled";

// Usage reference source type
export type ReferenceSource = "frontmatter" | "config.json";

// Where a tool is referenced in the prompt library
export type ReferenceType = "fragment" | "directory";

/**
 * A reference to where a tool is used in the prompt library
 */
export interface UsageReference {
  /** The type of source that references this tool */
  type: ReferenceType;
  /** File system path to the fragment or directory */
  path: string;
  /** How the tool is declared (frontmatter or config.json) */
  source: ReferenceSource;
}

/**
 * A parameter definition for a tool
 */
export interface ToolParameter {
  /** Parameter name */
  name: string;
  /** Parameter data type */
  type: string | "object" | "array" | "number" | "boolean";
  /** Whether this parameter is required */
  required: boolean;
  /** Human-readable description of the parameter */
  description: string;
}

/**
 * A function-calling tool that agents can invoke
 */
export interface Tool {
  /** Unique tool identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of what the tool does */
  description: string;
  /** Where this tool comes from */
  source: ToolSource;
  /** Package name that provides this tool */
  packageName: string;
  /** Whether the tool is currently enabled */
  status: ToolStatus;
  /** Parameters this tool accepts */
  parameters: ToolParameter[];
  /** Environment variable keys this tool requires */
  envRequirements: string[];
  /** References to where this tool is used in the prompt library */
  usageReferences: UsageReference[];
  /** Detailed documentation for the tool */
  documentation: string;
}

/**
 * An npm package that provides tools
 */
export interface ToolPackage {
  /** Unique package identifier */
  id: string;
  /** Package name */
  name: string;
  /** Currently installed version */
  version: string;
  /** Package description */
  description: string;
  /** Package author */
  author: string;
  /** Whether the package is installed */
  installed: boolean;
  /** Whether this is a built-in package */
  isBuiltin: boolean;
  /** Latest available version */
  latestVersion: string;
  /** Whether an update is available */
  updateAvailable: boolean;
  /** Number of tools provided by this package */
  toolCount: number;
  /** IDs of tools this package provides */
  tools: string[];
}

/**
 * A workspace-level environment variable
 */
export interface EnvironmentVariable {
  /** Variable key/name */
  key: string;
  /** Variable value (may be masked for secrets) */
  value: string;
  /** Description of what this variable is for */
  description: string;
  /** Whether this is a secret value */
  isSecret: boolean;
  /** Tool IDs that use this variable */
  usedBy: string[];
}

/**
 * Current navigation view in Tool Library
 */
export type ToolLibraryView = "tools" | "packages" | "environment";

/**
 * Props for the Tool Library section
 */
export interface ToolLibraryProps {
  /** All available tools */
  tools: Tool[];
  /** All packages (installed and available) */
  packages: ToolPackage[];
  /** Workspace environment variables */
  environmentVariables: EnvironmentVariable[];
  /** Currently active view */
  currentView: ToolLibraryView;

  /** Called when installing a new package */
  onInstallPackage?: (packageName: string) => void;
  /** Called when uninstalling a package */
  onUninstallPackage?: (packageName: string) => void;
  /** Called when updating a package */
  onUpdatePackage?: (packageName: string) => void;
  /** Called when searching for packages */
  onSearchPackages?: (query: string) => void;
  /** Called when adding an environment variable */
  onAddEnvVariable?: (variable: Omit<EnvironmentVariable, "usedBy">) => void;
  /** Called when updating an environment variable */
  onUpdateEnvVariable?: (key: string, value: string) => void;
  /** Called when deleting an environment variable */
  onDeleteEnvVariable?: (key: string) => void;
  /** Called when toggling tool status */
  onToggleTool?: (toolId: string) => void;
  /** Called when switching views */
  onChangeView?: (view: ToolLibraryView) => void;
  /** Called when searching/filtering tools */
  onSearchTools?: (query: string) => void;
}
