import { Button } from '../components/Button';
import './PagePlaceholder.css';

export function Multiplayer() {
  return (
    <div className="page-placeholder">
      <h1>Multiplayer</h1>
      <p>Room browser and matchmaking will go here.</p>
      <Button to="/" variant="secondary">Back to Menu</Button>
    </div>
  );
}
