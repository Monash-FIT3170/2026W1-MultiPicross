import { useState, useEffect } from "react";

type Todo = {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
};

export default function Todo() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    fetch("/todos")
      .then((res) => {
        if (!res.ok) throw new Error(`GET /todos failed: ${res.status}`);
        return res.json();
      })
      .then(setTodos)
      .catch(console.error);
  }, []);

  async function createTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const res = await fetch("/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    if (!res.ok) throw new Error(`POST /todos failed: ${res.status}`);
    const created: Todo = await res.json();
    setTodos((prev) => [...prev, created]);
    setNewTitle("");
  }

  async function toggleTodo(todo: Todo) {
    const res = await fetch(`/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !todo.completed }),
    });
    if (!res.ok) throw new Error(`PATCH /todos/${todo.id} failed: ${res.status}`);
    const updated: Todo = await res.json();
    setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  async function deleteTodo(id: number) {
    await fetch(`/todos/${id}`, { method: "DELETE" });
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 w-full max-w-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Todo List</h2>
      <form onSubmit={createTodo} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New todo..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Add
        </button>
      </form>
      <ul className="space-y-2">
        {todos.map((todo) => (
          <li
            key={todo.id}
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo)}
              className="w-4 h-4 accent-blue-500 cursor-pointer"
            />
            <span
              className={`flex-1 text-sm ${todo.completed ? "line-through text-gray-400" : "text-gray-700"}`}
            >
              {todo.title}
            </span>
            <button
              onClick={() => deleteTodo(todo.id)}
              className="text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              Delete
            </button>
          </li>
        ))}
        {todos.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No todos yet. Add one above!</p>
        )}
      </ul>
    </div>
  );
}
