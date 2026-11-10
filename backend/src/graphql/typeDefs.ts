export const typeDefs = `#graphql
  enum TaskStatus { TODO IN_PROGRESS DONE }
  enum Priority { LOW MEDIUM HIGH }

  type User {
    id: ID!
    name: String!
    email: String!
    createdAt: String!
  }

  type Project {
    id: ID!
    name: String!
    description: String
    owner: User!
    members: [User!]!
    tasks(status: TaskStatus): [Task!]!
    createdAt: String!
  }

  type Task {
    id: ID!
    title: String!
    description: String
    status: TaskStatus!
    priority: Priority!
    dueDate: String
    project: Project!
    assignee: User
    createdAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type TaskPage {
    items: [Task!]!
    total: Int!
    page: Int!
    pageSize: Int!
  }

  input RegisterInput {
    name: String!
    email: String!
    password: String!
  }
  input CreateProjectInput {
    name: String!
    description: String
  }
  input CreateTaskInput {
    projectId: ID!
    title: String!
    description: String
    priority: Priority
    dueDate: String
    assigneeId: ID
  }
  input UpdateTaskInput {
    title: String
    description: String
    status: TaskStatus
    priority: Priority
    dueDate: String
    assigneeId: ID
  }
  input TaskFilter {
    projectId: ID
    status: TaskStatus
    assigneeId: ID
  }

  type Query {
    me: User
    projects: [Project!]!
    project(id: ID!): Project
    tasks(filter: TaskFilter, page: Int = 1, pageSize: Int = 10): TaskPage!
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    createProject(input: CreateProjectInput!): Project!
    addMember(projectId: ID!, userId: ID!): Project!
    createTask(input: CreateTaskInput!): Task!
    updateTask(id: ID!, input: UpdateTaskInput!): Task!
    deleteTask(id: ID!): Boolean!
  }
`;
