import { Button } from '../components/Button';
import './PagePlaceholder.css';

export function Statistics() {
  return (
    <div className="page-placeholder">
      <h1>Statistics</h1>
      <p>Your puzzle stats and achievements.</p>
      <Button to="/" variant="secondary">Back to Menu</Button>
    </div>
  );
}
