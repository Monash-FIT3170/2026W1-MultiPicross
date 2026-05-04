import { Button } from '../components/Button';
import './PagePlaceholder.css';

export function Settings() {
  return (
    <div className="page-placeholder">
      <h1>Settings</h1>
      <p>Audio, display, and control settings.</p>
      <Button to="/" variant="secondary">Back to Menu</Button>
    </div>
  );
}
