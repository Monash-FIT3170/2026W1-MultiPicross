import { Button } from '../components/Button';
import './PagePlaceholder.css';

export function Singleplayer() {
  return (
    <div className="page-placeholder">
      <h1>Singleplayer</h1>
      <p>Puzzle selection will go here.</p>
      <Button to="/" variant="secondary">Back to Menu</Button>
    </div>
  );
}
