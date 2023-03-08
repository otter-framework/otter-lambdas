import { nanoid } from 'nanoid';

const createErrorResponse = (message: string) => {
  return { message };
};

const generateRoomId = (): string => {
  const id = 'rm_' + nanoid(10);
  return id;
};

export { createErrorResponse, generateRoomId };
