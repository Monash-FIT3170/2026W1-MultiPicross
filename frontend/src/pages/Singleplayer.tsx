import Board from '../components/Board';
import './PagePlaceholder.css';

export function Singleplayer() {
  return (
    <div className="page-placeholder">
      <h1>Singleplayer</h1>
      <p>Puzzle selection will go here.</p>

       <div className="ticks"></div>
      
            <section id="next-steps">
              <div id="docs">
                <h2>Board desc</h2>
                <p>Left click to fill/unfill. Right click to place/remove a cross.</p>
              </div>
              <div id="social">
                <Board />
              </div>
            </section>
      
            <div className="ticks"></div>
            <section id="spacer"></section>
    </div>
  );
}
