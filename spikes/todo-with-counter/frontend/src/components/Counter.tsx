import { useState, useEffect } from "react";
import { Client } from "@colyseus/sdk";
import type { Room } from "@colyseus/sdk";

const client = new Client("http://localhost:2567");

export default function Counter() {
  const [room, setRoom] = useState<Room | null>(null);
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    let joinedRoom: Room;

    client.joinOrCreate("my_room").then((r) => {
      joinedRoom = r;
      setRoom(r);

      r.onStateChange((state) => {
        setCounter(state.counter);
      });
    }).catch(console.error);

    return () => {
      joinedRoom?.leave();
    };
  }, []);

  function increment() {
    room?.send("increment");
  }

  function decrement() {
    room?.send("decrement");
  }

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 w-full max-w-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Synchronized Counter</h2>
      <div className="flex items-center justify-center gap-6">
        <button
          onClick={decrement}
          className="w-12 h-12 rounded-full bg-red-100 hover:bg-red-200 text-red-600 text-2xl font-bold transition-colors"
        >
          −
        </button>
        <span className="text-5xl font-mono font-bold text-gray-800 w-20 text-center">
          {counter}
        </span>
        <button
          onClick={increment}
          className="w-12 h-12 rounded-full bg-green-100 hover:bg-green-200 text-green-600 text-2xl font-bold transition-colors"
        >
          +
        </button>
      </div>
      <p className="text-xs text-gray-400 text-center mt-4">
        {room ? `Connected · Room ${room.roomId}` : "Connecting..."}
      </p>
    </div>
  );
}
