export default function Todo() {
  // Example of fetching todos from the API
  try {
    fetch("/todos")
      .then((response) => response.json())
      .then((data) => {
        console.log("Todos:", data);
      });
  } catch (error) {
    console.error("Error fetching todos:", error);
  }

  return (
    <div className="todo">
      <h2>Todo List</h2>
      {/* Todo list UI goes here */}
    </div>
  );
}
