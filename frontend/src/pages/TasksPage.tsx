import { useEffect } from 'react'
import { TaskList } from '../components/TaskList.tsx'

export function TasksPage() {
  useEffect(() => {
    document.title = 'All tasks · TaskFlow'
  }, [])

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">Across projects</p>
          <h1>All tasks</h1>
          <p className="lede">Filter and page through every task you can access.</p>
        </div>
      </header>
      <TaskList />
    </div>
  )
}
