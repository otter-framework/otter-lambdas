export type RoomConfig = {
  uniqueName?: string;
};

export type Room = {
  id: string;
  unique_name: string;
  created_at: string;
  updated_at: string;
  status: RoomStatus;
};

export enum RoomStatus {
  Open = 'open',
  Closed = 'closed',
  Occupied = 'occupied',
  Full = 'full',
}
