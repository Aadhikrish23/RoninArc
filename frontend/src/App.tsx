import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
     <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">
          RoninArc
        </h1>
        <p className="text-slate-300">
          Forge your Game Path — frontend setup complete ⚔️
        </p>
      </div>
    </div>
  )
}

export default App
