import { createGame } from './app/game';
import { GAME_PARENT_ID } from './app/config';
import { installCrispText } from './app/crispText';

const ensureGameRoot = (): HTMLElement => {
  const existingRoot = document.getElementById(GAME_PARENT_ID);

  if (existingRoot instanceof HTMLElement) {
    return existingRoot;
  }

  const gameRoot = document.createElement('div');
  gameRoot.id = GAME_PARENT_ID;
  document.body.appendChild(gameRoot);

  return gameRoot;
};

ensureGameRoot();
// Must run before the game is built: scenes create text during boot.
installCrispText();
createGame();
