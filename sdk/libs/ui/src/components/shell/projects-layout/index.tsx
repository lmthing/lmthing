/**
 * ProjectsLayout - Projects listing page (the post-login landing).
 *
 * Lists all projects on the user's compute pod (live from `useProjects()`,
 * which reads `GET /api/projects`). Opening a project navigates to
 * `/$projectId` (the project's spaces). Create/delete are wired through
 * `useApp()` (the pod transport).
 *
 * Under the pod-backed architecture there is no `$username` segment and no
 * local/demo marketplace — this replaces the old `StudiosLayout`.
 */
import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Plus, Trash2, ArrowRight, Layers } from 'lucide-react'
import '@lmthing/css/elements/layouts/page/index.css'
import '@lmthing/css/elements/forms/button/index.css'
import '@lmthing/css/elements/forms/input/index.css'
import '@lmthing/css/elements/content/card/index.css'
import '@lmthing/css/components/shell/index.css'
import { PageHeader, PageBody } from '@lmthing/ui/elements/layouts/page'
import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { useProjects, useToggle, useUIState } from '@lmthing/state'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'
import { buildProjectPath } from '@lmthing/ui/lib/space-path'

const PROJECT_COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#06b6d4', '#ef4444', '#ec4899']

/**
 * Derive a slug for a new project name. The pod assigns the canonical id;
 * this is only used to preview/disable the create button and is no longer
 * passed to the transport (the pod mints the id from the name).
 */
function toSlug(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface ProjectsLayoutProps {
  /** Override the destination when a project is opened. Defaults to `/$projectId`. */
  onOpenProject?: (projectId: string) => void
  /** Override the home destination. Defaults to `/`. */
  onGoHome?: () => void
}

export function ProjectsLayout({ onOpenProject, onGoHome }: ProjectsLayoutProps) {
  const navigate = useNavigate()
  const { projects, createProject, deleteProject, isLoading, error } = useProjects()

  const [isCreateOpen, , setIsCreateOpen] = useToggle('projects-layout.create-open', false)
  const [newProjectName, setNewProjectName] = useUIState('projects-layout.new-project-name', '')
  const [confirmDelete, setConfirmDelete] = useUIState<string | null>('projects-layout.confirm-delete', null)

  const orderedProjects = useMemo(() => {
    return [...projects].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
  }, [projects])

  const openProject = (projectId: string) => {
    if (onOpenProject) {
      onOpenProject(projectId)
      return
    }
    navigate({ to: buildProjectPath(projectId) })
  }

  const goHome = () => {
    if (onGoHome) {
      onGoHome()
      return
    }
    navigate({ to: '/' })
  }

  const handleCreate = async () => {
    const name = newProjectName.trim()
    if (!name) return
    const created = await createProject(name)
    setIsCreateOpen(false)
    setNewProjectName('')
    if (created) openProject(created.id)
  }

  const handleDelete = async (projectId: string) => {
    await deleteProject(projectId)
    setConfirmDelete(null)
  }

  return (
    <div className="projects-layout">
      {/* Top bar */}
      <div className="projects-layout__topbar">
        <div className="projects-layout__topbar-left">
          <button onClick={goHome} className="projects-layout__home-btn">
            <CozyThingText text="lmthing" />
          </button>
          <span className="projects-layout__breadcrumb-sep">/</span>
          <span className="projects-layout__title">Projects</span>
        </div>
        <div className="projects-layout__topbar-right">
          <button className="btn btn--primary btn--sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="projects-layout__topbar-icon" />
            New Project
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="projects-layout__content">
        <PageHeader>
          <div className="projects-layout__header-row">
            <div>
              <Heading level={2}>Projects</Heading>
              <Caption muted>Projects on your compute pod. Each project holds spaces.</Caption>
            </div>
          </div>
        </PageHeader>

        <PageBody>
          {isLoading && (
            <Caption muted className="projects-layout__loading">Loading projects…</Caption>
          )}
          {error && (
            <Caption className="projects-layout__error">Failed to load projects: {error}</Caption>
          )}

          {!isLoading && !error && orderedProjects.length > 0 ? (
            <div className="projects-layout__grid">
              {orderedProjects.map((project, idx) => (
                <Card
                  key={project.id}
                  interactive
                  className="projects-layout__card"
                  onClick={() => openProject(project.id)}
                >
                  <CardBody>
                    <div className="projects-layout__card-header">
                      <div
                        className="projects-layout__card-icon-wrapper"
                        style={{ backgroundColor: PROJECT_COLORS[idx % PROJECT_COLORS.length] + '20' }}
                      >
                        <Layers
                          className="projects-layout__card-icon"
                          style={{ color: PROJECT_COLORS[idx % PROJECT_COLORS.length] }}
                        />
                      </div>
                      <button
                        className="btn btn--ghost btn--sm projects-layout__card-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDelete(project.id)
                        }}
                        title="Delete project"
                      >
                        <Trash2 className="projects-layout__card-delete-icon" />
                      </button>
                    </div>
                    <Heading level={4}>{project.name || project.id}</Heading>
                    <Caption muted className="projects-layout__card-id">{project.id}</Caption>
                    <div className="projects-layout__card-arrow">
                      <ArrowRight className="projects-layout__card-arrow-icon" />
                    </div>
                  </CardBody>
                </Card>
              ))}

              {/* Create new card */}
              <button
                onClick={() => setIsCreateOpen(true)}
                className="projects-layout__create-card"
              >
                <div className="projects-layout__create-card-inner">
                  <Plus className="projects-layout__create-card-icon" />
                  <Caption>New Project</Caption>
                </div>
              </button>
            </div>
          ) : null}

          {!isLoading && !error && orderedProjects.length === 0 && (
            <div className="projects-layout__empty">
              <Layers className="projects-layout__empty-icon" />
              <Heading level={3}>No projects yet</Heading>
              <Caption muted className="projects-layout__empty-caption">
                Your compute pod has no projects. Create one to get started.
              </Caption>
              <button
                className="btn btn--primary projects-layout__empty-create-btn"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="projects-layout__empty-create-icon" /> Create Project
              </button>
            </div>
          )}
        </PageBody>
      </div>

      {/* Create project modal */}
      {isCreateOpen && (
        <div className="projects-layout__modal-backdrop">
          <div className="projects-layout__modal">
            <h3 className="projects-layout__modal-title">Create New Project</h3>
            <p className="projects-layout__modal-desc">
              A project groups related spaces together on your pod.
            </p>
            <div className="projects-layout__modal-fields">
              <input
                className="input"
                autoFocus
                placeholder="Project name (e.g. my-project)"
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleCreate() }}
              />
              {newProjectName.trim() && (
                <Caption muted>Suggested slug: {toSlug(newProjectName)}</Caption>
              )}
              <div className="projects-layout__modal-actions">
                <button
                  className="btn btn--ghost"
                  onClick={() => { setIsCreateOpen(false); setNewProjectName('') }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn--primary"
                  onClick={() => void handleCreate()}
                  disabled={!toSlug(newProjectName)}
                >
                  Create Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="projects-layout__modal-backdrop">
          <div className="projects-layout__modal projects-layout__modal--sm">
            <h3 className="projects-layout__modal-title">Delete Project</h3>
            <p className="projects-layout__modal-desc projects-layout__modal-desc--lg">
              Are you sure you want to delete <strong>{confirmDelete}</strong>? This will remove all
              spaces and data within it on your pod.
            </p>
            <div className="projects-layout__modal-actions">
              <button className="btn btn--ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                className="btn projects-layout__delete-btn"
                onClick={() => void handleDelete(confirmDelete)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export { ProjectsLayout as default }
