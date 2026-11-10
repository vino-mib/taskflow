import { useMutation, useQuery } from '@apollo/client'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PROJECTS, REFRESH, TASKS, UPDATE_TASK } from '../graphql/operations.ts'
import { errorMessage } from '../lib/errors.ts'
import { PAGE_SIZE, STATUSES, formatDate, isOverdue, priorityLabel } from '../lib/format.ts'
import type { ProjectSummary, Task, TaskFilterInput, TaskPage, TaskStatus, User } from '../types.ts'
import { Avatar } from './Avatar.tsx'
import { Banner } from './Banner.tsx'
import { useToast } from './toast-context.ts'

export function TaskList({ projectId, members }: { projectId?: string; members?: User[] }) {
  const toast = useToast()
  const [status, setStatus] = useState<TaskStatus | ''>('')
  const [assigneeId, setAssigneeId] = useState('')
  const [chosenProject, setChosenProject] = useState('')
  const [page, setPage] = useState(1)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<string, TaskStatus>>({})
  const [updateTask] = useMutation(UPDATE_TASK)

  const activeProject = projectId ?? chosenProject
  const filter = buildFilter(activeProject, status, assigneeId)
  const projectsQuery = useQuery<{ projects: ProjectSummary[] }>(PROJECTS, {
    fetchPolicy: 'cache-and-network',
    skip: Boolean(projectId && members),
  })
  const tasksQuery = useQuery<{ tasks: TaskPage }, { filter: TaskFilterInput; page: number; pageSize: number }>(TASKS, {
    variables: { filter, page, pageSize: PAGE_SIZE },
    fetchPolicy: 'cache-and-network',
  })

  const projectOptions = projectsQuery.data?.projects
  const people = useMemo(
    () => members ?? collectMembers(projectOptions ?? [], projectId),
    [members, projectOptions, projectId],
  )
  const pageData = tasksQuery.data?.tasks
  const items = pageData?.items ?? []
  const total = pageData?.total ?? 0
  const pageSize = pageData?.pageSize ?? PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)))
  if (pageData && page > pageCount) setPage(pageCount)
  const currentPage = pageData && page > pageCount ? pageCount : page
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, total)

  async function changeStatus(task: Task, next: TaskStatus) {
    if ((overrides[task.id] ?? task.status) === next) return
    setOverrides((current) => ({ ...current, [task.id]: next }))
    setPendingId(task.id)
    try {
      await updateTask({
        variables: { id: task.id, input: { status: next } },
        refetchQueries: REFRESH,
        awaitRefetchQueries: true,
      })
    } catch (err) {
      toast(errorMessage(err))
    } finally {
      setOverrides((current) => {
        const nextOverrides = { ...current }
        delete nextOverrides[task.id]
        return nextOverrides
      })
      setPendingId(null)
    }
  }

  return (
    <div className="task-list">
      <div className="filters">
        {!projectId && (
          <label className="field">
            <span>Project</span>
            <select
              value={chosenProject}
              onChange={(event) => {
                setChosenProject(event.target.value)
                setAssigneeId('')
                setPage(1)
              }}
            >
              <option value="">All projects</option>
              {(projectOptions ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as TaskStatus | '')
              setPage(1)
            }}
          >
            <option value="">Any status</option>
            {STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Assignee</span>
          <select
            value={assigneeId}
            onChange={(event) => {
              setAssigneeId(event.target.value)
              setPage(1)
            }}
          >
            <option value="">Anyone</option>
            {people.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Banner message={projectsQuery.error ? errorMessage(projectsQuery.error) : null} />
      <Banner message={tasksQuery.error ? errorMessage(tasksQuery.error) : null} />

      {tasksQuery.loading && !pageData ? (
        <div className="stack">
          <div className="skeleton-row" />
          <div className="skeleton-row" />
          <div className="skeleton-row" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty">
          <h3>No tasks match</h3>
          <p>Try another filter, or create a task from a project board.</p>
        </div>
      ) : (
        <ul className="rows">
          {items.map((task) => {
            const shown = overrides[task.id] ?? task.status
            return (
              <li key={task.id} className="task-row">
                <div className="task-row-main">
                  <div className="task-row-title">
                    {task.project ? (
                      <Link to={`/projects/${task.project.id}`}>{task.title}</Link>
                    ) : (
                      <strong>{task.title}</strong>
                    )}
                    {!projectId && task.project && <span className="muted">{task.project.name}</span>}
                  </div>
                  <select
                    className={`status-select status-${shown}`}
                    aria-label={`Status for ${task.title}`}
                    value={shown}
                    disabled={pendingId === task.id}
                    onChange={(event) => { void changeStatus(task, event.target.value as TaskStatus) }}
                  >
                    {STATUSES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <span className={`badge priority-${task.priority}`}>{priorityLabel(task.priority)}</span>
                  <span className="assignee-cell">
                    {task.assignee ? (
                      <>
                        <Avatar name={task.assignee.name} id={task.assignee.id} size="sm" />
                        <span>{task.assignee.name}</span>
                      </>
                    ) : (
                      <span className="muted">Unassigned</span>
                    )}
                  </span>
                  <time className={isOverdue(task.dueDate, shown) ? 'overdue' : 'muted'}>
                    {task.dueDate ? formatDate(task.dueDate) : 'No date'}
                  </time>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="pager">
        <span className="muted">{total === 0 ? '0 tasks' : `${start}–${end} of ${total}`}</span>
        <div className="pager-actions">
          <button type="button" className="btn btn-ghost" disabled={currentPage <= 1} onClick={() => setPage(Math.max(1, currentPage - 1))}>
            Previous
          </button>
          <span>
            Page {currentPage} of {pageCount}
          </span>
          <button type="button" className="btn btn-ghost" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

function buildFilter(projectId: string, status: TaskStatus | '', assigneeId: string): TaskFilterInput {
  const filter: TaskFilterInput = {}
  if (projectId) filter.projectId = projectId
  if (status) filter.status = status
  if (assigneeId) filter.assigneeId = assigneeId
  return filter
}

function collectMembers(projects: ProjectSummary[], projectId?: string): User[] {
  const source = projectId ? projects.filter((project) => project.id === projectId) : projects
  const map = new Map<string, User>()
  for (const project of source) {
    for (const member of project.members) map.set(member.id, member)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}
