export const getNewStatusOnConnect = (prevStatus: string): string => {
  let newStatus: string;
  switch (prevStatus) {
    case 'open':
      newStatus = 'occupied';
      break;
    case 'occupied':
      newStatus = 'full';
      break;
    default:
      throw new Error(`Cannot change the status from ${prevStatus}`);
  }

  return newStatus;
};

export const getNewStatusOnDisconnect = (prevStatus: string): string => {
  let newStatus: string;
  switch (prevStatus) {
    case 'full':
      newStatus = 'occupied';
      break;
    case 'occupied':
      newStatus = 'closed';
      break;
    default:
      throw new Error(`Cannot change the status from ${prevStatus}`);
  }

  return newStatus;
};
