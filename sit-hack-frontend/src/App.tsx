import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { GamePage } from './pages/GamePage';
import { MotionDebugPage } from './pages/MotionDebugPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GamePage />} />
        <Route path="/debug" element={<MotionDebugPage />} />
        <Route path="*" element={<GamePage />} />
      </Routes>
    </BrowserRouter>
  );
}
