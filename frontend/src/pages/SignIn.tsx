import { Button } from '../components/Button';
import './PagePlaceholder.css';

export function SignIn() {
  return (
    <div className="page-placeholder">
      <h1>Sign In</h1>
      <p>Login form will go here.</p>
      <Button to="/" variant="secondary">Back to Menu</Button>
    </div>
  );
}
