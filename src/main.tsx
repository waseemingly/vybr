import '@azure/core-asynciterator-polyfill';
import { createRoot } from 'react-dom/client'
import App from '../App'
import './index.css'

// Only run on web platform
if (typeof document !== 'undefined') {
  createRoot(document.getElementById("root")!).render(<App />);
}
