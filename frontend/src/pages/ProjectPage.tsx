import { useMutation, useQuery } from '@apollo/client'
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/context.ts'
import { Avatar } from '../components/Avatar.tsx'
import { Banner } from '../components/Banner.tsx'
import { Modal } from '../components/Modal.tsx'
import { TaskDialog } from '../components/TaskDialog.tsx'
import { TaskList } from '../components/TaskList.tsx'
import { useToast } from '../components/toast-context.ts'
import { ADD_MEMBER, PROJECT, REFRESH, UPDATE_TASK } from '../graphql/operations.ts'
import { errorMessage } from '../lib/errors.ts'
import { STATUSES, formatDate, formatTimestamp, isOverdue, priorityLabel } from '../lib/format.ts'
import type { ProjectDetail, Task, TaskStatus, User } from '../types.ts'

type DialogState = { mode: 'create' } | { mode: 'edit'; task: Task }

export function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const toast = useToast()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null)
  const [dragging, setDragging] = useState(false)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [memberOpen, setMemberOpen] = useState(false)
  const [updateTask] = useMutation(UPDATE_TASK)
  const { data, loading, error } = useQuery<{ project: ProjectDetail | null }, { id: string }>(PROJECT, {
    variables: { id: id ?? '' },
    skip: !id,
    fetchPolicy: 'cache-and-network',
  })
  const project = data?.project ?? null

  useEffect(() => {
    document.title = project ? `${project.name} · TaskFlow` : 'Project · TaskFlow'
  }, [project])

  async function move(task: Task, status: TaskStatus) {
    if (task.status === status) return
    try {
      await updateTask({
        variables: { id: task.id, input: { status } },
        optimisticResponse: {
          updateTask: {
            __typename: 'Task',
            id: task.id,
            title: task.title,
            description: task.description,
            status,
            priority: task.priority,
            dueDate: task.dueDate,
            createdAt: task.createdAt,
            assignee: task.assignee ? { __typename: 'User', ...task.assignee } : null,
          },
        },
        refetchQueries: REFRESH,
      })
    } catch (err) {
      toast(errorMessage(err))
    }
  }

  function onDrop(event: DragEvent<HTMLElement>, status: TaskStatus) {
    event.preventDefault()
    setDragOver(null)
    setDragging(false)
    const taskId = event.dataTransfer.getData('text/plain')
    const task = project?.tasks.find((item) => item.id === taskId)
    if (task) void move(task, status)
  }

  const isOwner = Boolean(user && project && user.id === project.owner.id)
  const people = project
    ? project.members.some((member) => member.id === project.owner.id)
      ? project.members
      : [project.owner, ...project.members]
    : []

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← Projects
      </Link>
      <Banner message={error ? errorMessage(error) : null} />
      {loading && !project && <BoardSkeleton />}
      {!loading && !error && !project && (
        <div className="empty">
          <h2>Project not found</h2>
          <p>It may have been removed, or you may not have access.</p>
        </div>
      )}
      {project && (
        <>
          <header className="page-head">
            <div>
              <p className="kicker">{isOwner ? 'Owner' : 'Member'}</p>
              <h1>{project.name}</h1>
              <p className="lede">{project.description?.trim() || 'No description yet.'}</p>
              <p className="meta-line">Created {formatTimestamp(project.createdAt)}</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setDialog({ mode: 'create' })}>
              New task
            </button>
          </header>
          <div className="member-row">
            {people.map((member) => (
              <span key={member.id} className="member-chip">
                <Avatar name={member.name} id={member.id} size="sm" />
                <span>{member.name}</span>
                {member.id === project.owner.id && <em className="role">Owner</em>}
                {member.id === user?.id && <em className="role">You</em>}
              </span>
            ))}
            {isOwner && (
              <button type="button" className="btn btn-ghost" onClick={() => setMemberOpen(true)}>
                Add member
              </button>
            )}
          </div>
          <div className="toolbar">
            <div className="segmented" role="tablist" aria-label="Task view">
              <button type="button" role="tab" aria-selected={view === 'board'} onClick={() => setView('board')}>
                Board
              </button>
              <button type="button" role="tab" aria-selected={view === 'list'} onClick={() => setView('list')}>
                List
              </button>
            </div>
          </div>
          {view === 'board' ? (
            <>
              <p className="hint">
                {dragging
                  ? 'Drop a card on a column to update its status.'
                  : 'Drag a card to another column, or open it to edit the details.'}
              </p>
              <div className="board">
                {STATUSES.map((column) => {
                  const tasks = project.tasks.filter((task) => task.status === column.value)
                  return (
                    <section
                      key={column.value}
                      className={`column${dragOver === column.value ? ' is-over' : ''}`}
                      onDragOver={(event) => {
                        event.preventDefault()
                        setDragOver(column.value)
                      }}
                      onDragLeave={(event) => {
                        const next = event.relatedTarget
                        if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
                          setDragOver((current) => (current === column.value ? null : current))
                        }
                      }}
                      onDrop={(event) => onDrop(event, column.value)}
                    >
                      <header className={`column-head status-${column.value}`}>
                        <i />
                        <span>{column.label}</span>
                        <span className="count-num">{tasks.length}</span>
                      </header>
                      <div className="column-cards">
                        {tasks.length === 0 && (
                          <p className="drop-hint">{dragOver === column.value ? 'Drop here' : 'Nothing here'}</p>
                        )}
                        {tasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onOpen={(item) => setDialog({ mode: 'edit', task: item })}
                            onDragChange={(active) => {
                              setDragging(active)
                              if (!active) setDragOver(null)
                            }}
                          />
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            </>
          ) : (
            <TaskList projectId={project.id} members={project.members} />
          )}
          {dialog && (
            <TaskDialog
              key={dialog.mode === 'edit' ? dialog.task.id : 'new'}
              projectId={project.id}
              members={project.members}
              task={dialog.mode === 'edit' ? dialog.task : null}
              onClose={() => setDialog(null)}
            />
          )}
          {memberOpen && <MemberDialog projectId={project.id} onClose={() => setMemberOpen(false)} />}
        </>
      )}
    </div>
  )
}

function TaskCard({
  task,
  onOpen,
  onDragChange,
}: {
  task: Task
  onOpen: (task: Task) => void
  onDragChange: (active: boolean) => void
}) {
  const skipClick = useRef(false)
  const [draggingCard, setDraggingCard] = useState(false)
  const overdue = isOverdue(task.dueDate, task.status)

  return (
    <article
      className={`task-card priority-${task.priority}${draggingCard ? ' is-dragging' : ''}`}
      draggable
      role="button"
      tabIndex={0}
      aria-label={`Edit ${task.title}`}
      onDragStart={(event) => {
        skipClick.current = true
        setDraggingCard(true)
        onDragChange(true)
        event.dataTransfer.setData('text/plain', task.id)
        event.dataTransfer.effectAllowed = 'move'
      }}
      onDragEnd={() => {
        setDraggingCard(false)
        onDragChange(false)
        window.setTimeout(() => {
          skipClick.current = false
        }, 0)
      }}
      onClick={() => {
        if (skipClick.current) return
        onOpen(task)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(task)
        }
      }}
    >
      <header>
        <span className={`badge priority-${task.priority}`}>{priorityLabel(task.priority)}</span>
        {task.dueDate && <time className={overdue ? 'overdue' : 'muted'}>{formatDate(task.dueDate)}</time>}
      </header>
      <h3>{task.title}</h3>
      {task.description?.trim() && <p className="clamp">{task.description}</p>}
      <footer>
        {task.assignee ? (
          <>
            <Avatar name={task.assignee.name} id={task.assignee.id} size="sm" />
            <span>{task.assignee.name}</span>
          </>
        ) : (
          <span>Unassigned</span>
        )}
      </footer>
    </article>
  )
}

function MemberDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const toast = useToast()
  const [userId, setUserId] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [addMember] = useMutation<
    { addMember: { id: string; members: User[] } },
    { projectId: string; userId: string }
  >(ADD_MEMBER)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const next = userId.trim()
    if (!next) {
      setError('Enter a user id.')
      return
    }
    setPending(true)
    setError('')
    try {
      await addMember({
        variables: { projectId, userId: next },
        refetchQueries: REFRESH,
        awaitRefetchQueries: true,
      })
      toast('Member added')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal title="Add member" onClose={onClose}>
      <form className="form-grid" onSubmit={(event) => { void submit(event) }}>
        <p className="help">Members are added by user id. Each person can copy theirs from the sidebar.</p>
        <label className="field">
          <span>User id</span>
          <input
            className="mono"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <Banner message={error} />
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Adding…' : 'Add member'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function BoardSkeleton() {
  return (
    <div className="board" aria-hidden="true">
      <div className="skeleton-card" />
      <div className="skeleton-card" />
      <div className="skeleton-card" />
    </div>
  )
}
