import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { Layout } from './components/Layout'
import { ChartSessionProvider } from './context/ChartSessionContext'
import { HomeRoute } from './pages/HomeRoute'
import { ProfilePage } from './pages/ProfilePage'
import { SavedPage } from './pages/SavedPage'
import { SoloPage } from './pages/SoloPage'
import { SynastryPage } from './pages/SynastryPage'

function App() {
  return (
    <BrowserRouter>
      <ChartSessionProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/solo" element={<SoloPage />} />
            <Route path="/solo/transits" element={<SoloPage />} />
            <Route path="/solo/solar-return" element={<SoloPage />} />
            <Route path="/solo/saturn-return" element={<SoloPage />} />
            <Route path="/synastry" element={<SynastryPage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/c/:slug" element={<SoloPage />} />
            <Route path="/s/:slug" element={<SynastryPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ChartSessionProvider>
    </BrowserRouter>
  )
}

export default App
