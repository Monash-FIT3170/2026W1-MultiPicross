import { Button } from '../components/Button';
import './PagePlaceholder.css';

export function Tutorial() {
  return (
    <div className="page-placeholder">
      <h1>Tutorial</h1>
      <p>Learn how to play Picross.</p>
      <Button to="/" variant="secondary">Back to Menu</Button>
    </div>
  );
}
