import { Client, Callbacks } from "@colyseus/sdk";
const client = new Client("http://localhost:2567");

// Recommended Reading:
// - https://docs.colyseus.io/state
// - https://docs.colyseus.io/sdk#joining-rooms
// - https://docs.colyseus.io/sdk#state-synchronization

// Note:
// you should probably implement the Colyseus room before implementing this component.

export default function Counter() {
  return (
    <div className="counter">
      <h2>Counter</h2>
      {/* Counter UI goes here */}
    </div>
  );
}
