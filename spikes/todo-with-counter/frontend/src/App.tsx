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
    <>
      <Todo />
      <Counter />
    </>
  );
}

export default App;
