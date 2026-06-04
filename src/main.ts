import { createGame } from './app/game';
import { GAME_PARENT_ID } from './app/config';

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
createGame();
