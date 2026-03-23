import { Hono } from "hono";
import { db } from "../db/index.js";
import { todos as todosTable } from "../db/schema.js";

const todos = new Hono();

todos.get("/", async (c) => {
  const allTodos = await db.select().from(todosTable);
  return c.json(allTodos);
});

todos.post("/", async (c) => {
  // TODO: parse and validate request body
  return c.json({ message: "created" }, 201);
});

// TODO: implement DELETE /todos/:id

// TODO: implement PATCH /todos/:id (e.g. to mark as completed)

export default todos;
