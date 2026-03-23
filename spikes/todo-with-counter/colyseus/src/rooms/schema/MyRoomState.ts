import { Schema, type } from "@colyseus/schema";

export class MyRoomState extends Schema {
  @type("string") mySynchronizedProperty: string = "Hello world";

  // TODO: Add a counter property that can be incremented/decremented by clients.
}
