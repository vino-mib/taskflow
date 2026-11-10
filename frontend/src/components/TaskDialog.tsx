import { useMutation } from '@apollo/client'
import { useState, type FormEvent } from 'react'
import { CREATE_TASK, DELETE_TASK, REFRESH, UPDATE_TASK } from '../graphql/operations.ts'
import { errorMessage } from '../lib/errors.ts'
import { PRIORITIES, STATUSES, dateInputToIso, toDateInput } from '../lib/format.ts'
import type { Priority, Task, TaskStatus, User } from '../types.ts'
import { Banner } from './Banner.tsx'
import { Modal } from './Modal.tsx'
import { useToast } from './toast-context.ts'

export function TaskDialog({
  projectId,
  members,
  task,
  onClose,
}: {
  projectId: string
  members: User[]
  task: Task | null
  onClose: () => void
}) {
  const toast = useToast()
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'TODO')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'MEDIUM')
  const [dueDate, setDueDate] = useState(toDateInput(task?.dueDate))
  const [assigneeId, setAssigneeId] = useState(task?.assignee?.id ?? '')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [createTask] = useMutation(CREATE_TASK)
  const [updateTask] = useMutation(UPDATE_TASK)
  const [deleteTask] = useMutation(DELETE_TASK)

  const assigneeMissing = Boolean(task?.assignee && !members.some((member) => member.id === task.assignee?.id))

  async function save(event: FormEvent) {
    event.preventDefault()
    const nextTitle = title.trim()
    if (!nextTitle) {
      setError('Task title is required.')
      return
    }
    setPending(true)
    setError('')
    const shared = {
      title: nextTitle,
      description: description.trim(),
      priority,
      dueDate: dateInputToIso(dueDate),
      assigneeId: assigneeId || null,
    }
    try {
      if (task) {
        await updateTask({
          variables: { id: task.id, input: { ...shared, status } },
          refetchQueries: REFRESH,
          awaitRefetchQueries: true,
        })
        toast('Task updated')
      } else {
        await createTask({
          variables: { input: { ...shared, projectId } },
          refetchQueries: REFRESH,
          awaitRefetchQueries: true,
        })
        toast('Task created')
      }
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  async function remove() {
    if (!task) return
    setPending(true)
    setError('')
    try {
      await deleteTask({
        variables: { id: task.id },
        refetchQueries: REFRESH,
        awaitRefetchQueries: true,
      })
      toast('Task deleted')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal title={task ? 'Edit task' : 'New task'} onClose={onClose}>
      <form className="form-grid" onSubmit={(event) => { void save(event) }}>
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        {task && (
          <div className="field">
            <span>Status</span>
            <div className="pills" role="radiogroup" aria-label="Status">
              {STATUSES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`pill status-${item.value}${status === item.value ? ' is-on' : ''}`}
                  aria-pressed={status === item.value}
                  onClick={() => setStatus(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="field">
          <span>Priority</span>
          <div className="pills" role="radiogroup" aria-label="Priority">
            {PRIORITIES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`pill priority-${item.value}${priority === item.value ? ' is-on' : ''}`}
                aria-pressed={priority === item.value}
                onClick={() => setPriority(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="split">
          <label className="field">
            <span>Due date</span>
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>
          <label className="field">
            <span>Assignee</span>
            <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
              <option value="">Unassigned</option>
              {assigneeMissing && task?.assignee && (
                <option value={task.assignee.id}>{task.assignee.name}</option>
              )}
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!task && <p className="help">New tasks start in To do. You can drag them across the board after that.</p>}
        <Banner message={error} />
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Saving…' : task ? 'Save changes' : 'Create task'}
          </button>
        </div>
      </form>
      {task && (
        <div className="danger-zone">
          {confirmDelete ? (
            <div className="confirm-row">
              <span>Delete this task permanently?</span>
              <button type="button" className="btn btn-danger" disabled={pending} onClick={() => { void remove() }}>
                Delete
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                Keep
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost danger-text" onClick={() => setConfirmDelete(true)}>
              Delete task
            </button>
          )}
        </div>
      )}
    </Modal>
  )
}
