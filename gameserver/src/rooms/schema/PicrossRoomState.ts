import { Schema, type } from "@colyseus/schema";

export class PicrossRoomState extends Schema {
  @type("string") phase: string = "waiting";
  @type("string") inviteCode: string = "";
}
