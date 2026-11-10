import { useMutation, useQuery } from '@apollo/client'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context.ts'
import { Avatar } from '../components/Avatar.tsx'
import { Banner } from '../components/Banner.tsx'
import { Modal } from '../components/Modal.tsx'
import { useToast } from '../components/toast-context.ts'
import { CREATE_PROJECT, PROJECTS } from '../graphql/operations.ts'
import { errorMessage } from '../lib/errors.ts'
import { STATUSES, formatTimestamp, statusLabel } from '../lib/format.ts'
import type { ProjectSummary } from '../types.ts'

export function ProjectsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const { data, loading, error } = useQuery<{ projects: ProjectSummary[] }>(PROJECTS, {
    fetchPolicy: 'cache-and-network',
  })

  useEffect(() => {
    document.title = 'Projects · TaskFlow'
  }, [])

  const projects = data?.projects ?? []

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">Workspace</p>
          <h1>Projects</h1>
          <p className="lede">Boards you own or belong to.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          New project
        </button>
      </header>
      <Banner message={error ? errorMessage(error) : null} />
      {loading && !data ? (
        <div className="card-grid">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      ) : projects.length === 0 ? (
        <div className="empty">
          <h2>No projects yet</h2>
          <p>Create a project, then add tasks and invite people with their user id.</p>
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            Create a project
          </button>
        </div>
      ) : (
        <div className="card-grid">
          {projects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`} className="project-card">
              <div className="project-card-top">
                <h2>{project.name}</h2>
                <span className="role">{user?.id === project.owner.id ? 'Owner' : 'Member'}</span>
              </div>
              <p className="clamp">{project.description?.trim() || 'No description'}</p>
              <div className="counts">
                {STATUSES.map((item) => (
                  <span key={item.value} className={`count status-${item.value}`}>
                    <i />
                    <b>{project.tasks.filter((task) => task.status === item.value).length}</b>
                    {statusLabel(item.value)}
                  </span>
                ))}
              </div>
              <div className="project-card-foot">
                <div className="avatar-stack" aria-label={project.members.map((member) => member.name).join(', ')}>
                  {project.members.slice(0, 4).map((member) => (
                    <Avatar key={member.id} name={member.name} id={member.id} size="sm" />
                  ))}
                </div>
                <span className="muted">
                  {project.members.length} {project.members.length === 1 ? 'member' : 'members'} · {formatTimestamp(project.createdAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {open && (
        <CreateProject
          onClose={() => setOpen(false)}
          onCreated={(projectId) => {
            toast('Project created')
            navigate(`/projects/${projectId}`)
          }}
        />
      )}
    </div>
  )
}

function CreateProject({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [createProject] = useMutation<
    { createProject: { id: string } },
    { input: { name: string; description?: string } }
  >(CREATE_PROJECT)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) {
      setError('Project name is required.')
      return
    }
    setPending(true)
    setError('')
    try {
      const { data } = await createProject({
        variables: { input: { name: nextName, description: description.trim() } },
        refetchQueries: ['Projects'],
        awaitRefetchQueries: true,
      })
      if (!data?.createProject) throw new Error('Could not create the project')
      onCreated(data.createProject.id)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal title="New project" onClose={onClose}>
      <form className="form-grid" onSubmit={(event) => { void submit(event) }}>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <Banner message={error} />
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
