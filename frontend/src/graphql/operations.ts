import { gql } from '@apollo/client'

const USER_FIELDS = gql`
  fragment UserFields on User {
    id
    name
    email
    createdAt
  }
`

const TASK_FIELDS = gql`
  fragment TaskFields on Task {
    id
    title
    description
    status
    priority
    dueDate
    createdAt
    assignee {
      ...UserFields
    }
  }
  ${USER_FIELDS}
`

export const REFRESH = ['Project', 'Projects', 'Tasks']

export const ME = gql`
  query Me {
    me {
      ...UserFields
    }
  }
  ${USER_FIELDS}
`

export const PROJECTS = gql`
  query Projects {
    projects {
      id
      name
      description
      createdAt
      owner {
        ...UserFields
      }
      members {
        ...UserFields
      }
      tasks {
        id
        status
      }
    }
  }
  ${USER_FIELDS}
`

export const PROJECT = gql`
  query Project($id: ID!) {
    project(id: $id) {
      id
      name
      description
      createdAt
      owner {
        ...UserFields
      }
      members {
        ...UserFields
      }
      tasks {
        ...TaskFields
      }
    }
  }
  ${TASK_FIELDS}
`

export const TASKS = gql`
  query Tasks($filter: TaskFilter, $page: Int, $pageSize: Int) {
    tasks(filter: $filter, page: $page, pageSize: $pageSize) {
      total
      page
      pageSize
      items {
        ...TaskFields
        project {
          id
          name
        }
      }
    }
  }
  ${TASK_FIELDS}
`

export const REGISTER = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      user {
        ...UserFields
      }
    }
  }
  ${USER_FIELDS}
`

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        ...UserFields
      }
    }
  }
  ${USER_FIELDS}
`

export const CREATE_PROJECT = gql`
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      id
      name
    }
  }
`

export const ADD_MEMBER = gql`
  mutation AddMember($projectId: ID!, $userId: ID!) {
    addMember(projectId: $projectId, userId: $userId) {
      id
      members {
        ...UserFields
      }
    }
  }
  ${USER_FIELDS}
`

export const CREATE_TASK = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      ...TaskFields
    }
  }
  ${TASK_FIELDS}
`

export const UPDATE_TASK = gql`
  mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      ...TaskFields
    }
  }
  ${TASK_FIELDS}
`

export const DELETE_TASK = gql`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id)
  }
`
