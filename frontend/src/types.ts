export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface User {
  id: string
  name: string
  email: string
  createdAt: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: Priority
  dueDate: string | null
  createdAt: string
  assignee: User | null
  project?: { id: string; name: string } | null
}

export interface ProjectSummary {
  id: string
  name: string
  description: string | null
  createdAt: string
  owner: User
  members: User[]
  tasks: { id: string; status: TaskStatus }[]
}

export interface ProjectDetail {
  id: string
  name: string
  description: string | null
  createdAt: string
  owner: User
  members: User[]
  tasks: Task[]
}

export interface TaskPage {
  items: Task[]
  total: number
  page: number
  pageSize: number
}

export interface AuthPayload {
  token: string
  user: User
}

export interface RegisterInput {
  name: string
  email: string
  password: string
}

export interface TaskFilterInput {
  projectId?: string
  status?: TaskStatus
  assigneeId?: string
}
