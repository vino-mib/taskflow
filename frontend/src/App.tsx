import { ApolloProvider } from '@apollo/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.tsx'
import { GuestOnly, RequireAuth } from './auth/guards.tsx'
import { AuthScreen } from './components/AuthScreen.tsx'
import { Shell } from './components/Shell.tsx'
import { ToastProvider } from './components/Toast.tsx'
import { client } from './graphql/client.ts'
import { ProjectPage } from './pages/ProjectPage.tsx'
import { ProjectsPage } from './pages/ProjectsPage.tsx'
import { TasksPage } from './pages/TasksPage.tsx'

export default function App() {
  return (
    <ApolloProvider client={client}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<GuestOnly />}>
                <Route path="/login" element={<AuthScreen mode="login" />} />
                <Route path="/register" element={<AuthScreen mode="register" />} />
              </Route>
              <Route element={<RequireAuth />}>
                <Route element={<Shell />}>
                  <Route index element={<ProjectsPage />} />
                  <Route path="projects/:id" element={<ProjectPage />} />
                  <Route path="tasks" element={<TasksPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ApolloProvider>
  )
}
