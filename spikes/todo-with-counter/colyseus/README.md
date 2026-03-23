# Colyseus 

This service is built with [Colyseus](https://colyseus.io/) (real-time state synchronization with websockets).

We recommend reading through the Colyseus documentation (specifically on state synchronization and messaging) to understand how to implement the room logic for the synchronized counter.

This service is dockerized (See `Dockerfile`), and as such we recommend running it with `docker compose` as described in the main `README.md`. However, you can also run it locally with the following commands if you prefer (requires Node.js and npm to be installed):

```sh
cd colyseus
npm install
npm start
```




## License

MIT
