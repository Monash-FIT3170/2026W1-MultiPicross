import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { todos as todosTable } from "../db/schema.js";
const todos = new Hono();
todos.get("/", async (c) => {
    const allTodos = await db.select().from(todosTable);
    return c.json(allTodos);
});
todos.post("/", async (c) => {
    const { title } = await c.req.json();
    const [created] = await db.insert(todosTable).values({ title }).returning();
    return c.json(created, 201);
});
todos.delete("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    await db.delete(todosTable).where(eq(todosTable.id, id));
    return c.json({ message: "deleted" }, 200);
});
todos.patch("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const { completed } = await c.req.json();
    const [updated] = await db
        .update(todosTable)
        .set({ completed })
        .where(eq(todosTable.id, id))
        .returning();
    return c.json(updated);
});
export default todos;
