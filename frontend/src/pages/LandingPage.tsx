import { Link } from 'react-router-dom'

// Stub for the page-ify patch - built out in the "add landing page" patch.
export function LandingPage() {
  return (
    <div className="notice">
      <p>Welcome to Stellation.</p>
      <p>
        <Link to="/solo">Cast your chart</Link> or <Link to="/synastry">compare charts</Link> to get started.
      </p>
    </div>
  )
}
