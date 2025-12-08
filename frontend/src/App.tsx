import { useState } from 'react'

import './App.css'
import Login from './routes/Login';
import Signup from './routes/Signup';
import Home from './routes/Home';
import { Route,Routes } from 'react-router-dom'

function App() {
  const [count, setCount] = useState(0)

  return (
    <Routes>
       <Route path="/" element={<Login />}></Route>
       
       <Route path="/Signup" element={<Signup />}></Route>
       <Route path="/Home" element={<Home />}></Route>
    </Routes>
  )
}

export default App
