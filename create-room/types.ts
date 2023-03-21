export type RoomConfig = {
  uniqueName?: string;
};

export type Room = {
  roomId: string;
  unique_name: string;
  created_at: string;
  updated_at: string;
  status: string;
  url: string;
};

// export enum RoomStatus {
//   Open = 'open',
//   Closed = 'closed',
//   Occupied = 'occupied',
//   Full = 'full',
// }
