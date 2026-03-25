import { Schema, type } from "@colyseus/schema";

export class MyRoomState extends Schema {
  @type("number") counter: number = 0;
}
