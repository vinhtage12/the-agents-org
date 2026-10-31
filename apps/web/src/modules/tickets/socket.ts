import { type Socket, io } from 'socket.io-client';

import { BASE_API_URL, BASE_API_VERSION } from '#constants/env';

import { BOARD_EVENT } from './constants';

const version = BASE_API_VERSION.replace(/^\/+|\/+$/g, '');

export const openBoardEvents = (
  onChanged: (projectId: number) => void
): Socket => {
  const socket = io(`${BASE_API_URL.replace(/\/$/, '')}/${version}/board`, {
    path: `/${version}/socket.io`,
    transports: ['websocket']
  });
  socket.on(BOARD_EVENT, (event: { projectId?: unknown }) => {
    if (typeof event?.projectId === 'number') {
      onChanged(event.projectId);
    }
  });
  return socket;
};
