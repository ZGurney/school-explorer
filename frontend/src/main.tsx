import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import './index.css'
import { CompareProvider } from './context/CompareContext'
import { ShortlistProvider, useShortlistContext } from './context/ShortlistContext'
import CompareBar from './components/CompareBar'
import ComparePage from './pages/ComparePage'
import DashboardPage from './pages/DashboardPage'
import HomePage from './pages/HomePage'
import SchoolDetailPage from './pages/SchoolDetailPage'
import ShortlistPage from './pages/ShortlistPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
})

function App() {
  const { saved } = useShortlistContext()

  return (
    <>
      <nav className="topbar">
        <div className="topbar-inner">
          {/* Brand: Fraunces serif, brick accent on "School Explorer" */}
          <Link to="/" className="topbar-brand">
            London <em>School Explorer</em>
          </Link>
          <div className="topbar-nav">
            <Link to="/" className="nav-link">Search</Link>
            <Link to="/dashboard" className="nav-link">Rankings</Link>
            <Link to="/shortlist" className="nav-link">
              Shortlist
              {saved.length > 0 && <span className="nav-count">{saved.length}</span>}
            </Link>
            <Link to="/compare" className="nav-link">Compare</Link>
          </div>
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/schools/:urn" element={<SchoolDetailPage />} />
        <Route path="/shortlist" element={<ShortlistPage />} />
        <Route path="/compare" element={<ComparePage />} />
      </Routes>
      <CompareBar />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <CompareProvider>
          <ShortlistProvider>
            <App />
          </ShortlistProvider>
        </CompareProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)
