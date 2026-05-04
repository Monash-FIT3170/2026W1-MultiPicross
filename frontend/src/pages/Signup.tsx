import { Button } from '../components/Button';
import './PagePlaceholder.css';

export function SignUp() {
  return (
    <div className="page-placeholder">
      <h1>Sign Up</h1>
      <p>Registration form will go here.</p>
      <Button to="/" variant="secondary">Back to Menu</Button>
    </div>
  );
}
