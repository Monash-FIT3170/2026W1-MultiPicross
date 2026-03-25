import { useState } from "react";
import Counter from "./components/Counter.tsx";
import Todo from "./components/Todo.tsx";

function App() {
  // TODO:
  // - [ ] Implement Todo list fetching and UI
  // - [ ] Implement form to create new todos
  // - [ ] Implement functionality to mark todos as completed

  // - [ ] Implement Counter UI & functionality

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-start gap-6 p-8">
      <Todo />
      <Counter />
    </div>
  );
}

export default App;
