/**
 * Type of node in the file system
 */
export type NodeType = 'directory' | 'file';

/**
 * Form field types for directory rendering
 */
export type FieldType = 'text' | 'textarea' | 'select' | 'multiselect' | 'toggle';

/**
 * How a directory should be rendered in the Agent Builder form
 */
export type RenderAs = 'section' | 'field';

/**
 * Metadata configuration stored in a directory's config.json file
 */
export interface DirectoryConfig {
  /** Human-readable label for the directory */
  label?: string;
  /** Description of the directory's purpose */
  description?: string;
  /** Icon identifier for UI rendering */
  icon?: string;
  /** Color for visual distinction in UI */
  color?: string;

  // ===== Field Rendering Configuration =====

  /**
   * How this directory renders in Agent Builder forms.
   * - "section": Collapsible container for nested fields (default for directories with children)
   * - "field": Form input where child files are selectable options
   */
  renderAs?: RenderAs;

  /**
   * Type of form control when renderAs = "field".
   * - "select": Single choice (radio buttons or dropdown)
   * - "multiselect": Multiple choices (checkboxes or tag input) - default
   * - "text": Single-line text input
   * - "textarea": Multi-line text input
   * - "toggle": Boolean switch
   */
  fieldType?: FieldType;

  /**
   * Placeholder text for text/textarea fields
   */
  placeholder?: string;

  /**
   * Default value for the field
   */
  default?: string | string[] | boolean;

  /**
   * Whether the field is required (default: false)
   */
  required?: boolean;

  /**
   * Variable name used in template generation (defaults to directory name)
   */
  variableName?: string;

  /**
   * Hint text displayed below the field
   */
  hint?: string;

  /** Additional custom metadata properties */
  [key: string]: unknown;
}

/**
 * Frontmatter metadata from a prompt fragment's markdown file.
 * Files serve as selectable options within their parent directory field.
 */
export interface PromptFrontmatter {
  /**
   * Human-readable title for this option (defaults to filename without extension)
   */
  title?: string;
  /**
   * Brief description of this option (shown as hint in selection UI)
   */
  description?: string;
  /**
   * Display order within parent directory (lower = higher priority)
   */
  order?: number;
  /**
   * Whether this option is disabled/hidden in selection UI
   */
  disabled?: boolean;
  /** Category for organization */
  category?: string;
  /** Tags for filtering and discovery */
  tags?: string[];
  /** Author identifier */
  author?: string;
  /** ISO date string of creation */
  created?: string;
  /** ISO date string of last modification */
  modified?: string;
  /** Additional custom properties */
  [key: string]: unknown;
}

/**
 * A prompt fragment file in the library.
 * When the parent directory is rendered as a field, files serve as selectable options.
 * The filename (without .md) is the option label, and content is the value.
 */
export interface PromptFragment {
  /** Unique identifier for the fragment */
  id: string;
  /** Filename including extension (the option label without extension) */
  name: string;
  /** Node type discriminator */
  type: 'file';
  /** Full path from root */
  path: string;
  /** Optional frontmatter metadata */
  frontmatter?: PromptFrontmatter;
  /** Markdown content of the prompt (inserted into template when this option is selected) */
  content: string;
  /** Whether this file has unsaved changes */
  hasUnsavedChanges?: boolean;
}

/**
 * A directory that can contain other nodes
 */
export interface Directory {
  /** Unique identifier for the directory */
  id: string;
  /** Directory name */
  name: string;
  /** Node type discriminator */
  type: 'directory';
  /** Full path from root */
  path: string;
  /** Optional directory metadata from config.json */
  config?: DirectoryConfig;
  /** Child nodes (directories and/or files) */
  children?: FileSystemNode[];
}

/**
 * Union type for any node in the file system tree
 */
export type FileSystemNode = Directory | PromptFragment;

/**
 * New file form data for creation modal
 */
export interface NewFileForm {
  /** Filename (extension auto-added if not provided) */
  filename: string;
  /** Parent directory path where file will be created */
  parentPath: string;
}

/**
 * New folder form data for creation modal
 */
export interface NewFolderForm {
  /** Folder name */
  folderName: string;
  /** Parent directory path where folder will be created */
  parentPath: string;
}

/**
 * Context menu action type
 */
export type ContextMenuAction = 'rename' | 'move' | 'delete' | 'duplicate';

/**
 * Unsaved changes dialog action
 */
export type UnsavedChangesAction = 'save' | 'discard' | 'cancel';

/**
 * Validation error type
 */
export interface ValidationError {
  /** Field that has the error */
  field: string;
  /** Error message */
  message: string;
}

/**
 * Error display type
 */
export type ErrorType = 'toast' | 'modal' | 'inline';

/**
 * Error notification
 */
export interface ErrorNotification {
  /** Type of error display */
  type: ErrorType;
  /** Error message */
  message: string;
  /** Whether error requires user action to dismiss (for modal types) */
  blocking?: boolean;
  /** Auto-dismiss timeout in milliseconds (for toast types, default 5000) */
  timeout?: number;
}

/**
 * Supported markdown formatting types for the WYSIWYG editor
 */
export type MarkdownFormat =
  | 'bold'
  | 'italic'
  | 'heading'
  | 'bulletList'
  | 'numberedList'
  | 'codeBlock'
  | 'inlineCode'
  | 'link'
  | 'blockquote'
  | 'horizontalRule';

/**
 * WYSIWYG editor configuration
 */
export interface EditorConfig {
  /** Available formatting options */
  formats: MarkdownFormat[];
  /** Whether syntax highlighting is enabled for code blocks */
  syntaxHighlighting: boolean;
}

/**
 * Props for the Prompt Library screen component
 */
export interface PromptLibraryProps {
  /** The complete file system tree structure */
  fileSystem: Directory;
  /** Currently selected file (if any) */
  selectedFile: PromptFragment | null;
  /** Array of folder paths that should be expanded in the tree */
  expandedFolders: string[];
  /** Whether the current editor has unsaved changes */
  unsavedChanges: boolean;
  /** Whether a file operation is in progress */
  isLoading?: boolean;
  /** Error notification to display (if any) */
  error?: ErrorNotification | null;
  /** Validation errors for forms */
  validationErrors?: ValidationError[];
  /** Empty state type */
  emptyState?: 'no-selection' | 'empty-library';

  /** Callback when a file is selected in the tree */
  onSelectFile: (file: PromptFragment) => void;
  /** Callback when a folder is expanded/collapsed */
  onToggleFolder: (path: string) => void;
  /** Callback when all folders are expanded */
  onExpandAll: () => void;
  /** Callback when all folders are collapsed */
  onCollapseAll: () => void;
  /** Callback when file content is edited */
  onEditContent: (content: string) => void;
  /** Callback when file frontmatter metadata is edited */
  onEditFrontmatter?: (frontmatter: PromptFrontmatter) => void;
  /** Callback when directory config metadata is edited */
  onEditDirectoryConfig?: (directoryPath: string, config: DirectoryConfig) => void;
  /** Callback when changes are saved */
  onSave: () => void;
  /** Callback when unsaved changes dialog action is chosen */
  onUnsavedChangesAction?: (action: UnsavedChangesAction) => void;
  /** Callback when a new file is created */
  onCreateFile: (form: NewFileForm) => void;
  /** Callback when a new folder is created */
  onCreateFolder: (form: NewFolderForm) => void;
  /** Callback when a node is renamed */
  onRename: (nodeId: string, newName: string) => void;
  /** Callback when a node is moved */
  onMove: (nodeId: string, newParentPath: string) => void;
  /** Callback when a node is deleted */
  onDelete: (nodeId: string) => void;
  /** Callback when a node is duplicated */
  onDuplicate?: (nodeId: string) => void;
  /** Callback when error is dismissed */
  onDismissError?: () => void;
}
