/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Home } from './pages/Home';
import { Gifts } from './pages/Gifts';
import { Admin } from './pages/Admin';
import { EventPage } from './pages/EventPage';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/presentes" element={<Gifts />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/:slug" element={<EventPage />} />
        </Routes>
      </Router>
      <Toaster position="bottom-center" richColors />
    </ErrorBoundary>
  );
}

