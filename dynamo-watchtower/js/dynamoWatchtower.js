import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const getNewStatusOnConnect = (prevStatus) => {
  let newStatus;
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

const getNewStatusOnDisconnect = (prevStatus) => {
  let newStatus;
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

const TABLE_NAME = 'rooms';
const REGION = process.env.AWS_REGION || 'us-east-2';
const marshallOptions = {
  removeUndefinedValues: true, // false, by default.
};

const client = new DynamoDBClient({ region: REGION });
const dynamo = DynamoDBDocumentClient.from(client, {
  marshallOptions,
});

const updateRoomStatusById = async (id, status) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { id },
    UpdateExpression: 'set #current_status = :s',
    ExpressionAttributeNames: { '#current_status': 'status' },
    ExpressionAttributeValues: { ':s': status },
  };

  await dynamo.send(new UpdateCommand(params));
};

const getRoomStatusById = async (id) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { id },
  };
  console.log('inside getRoomStatusById, params:', params);

  const dataFromDatabase = await dynamo.send(new GetCommand(params));
  console.log('Item: ', dataFromDatabase.Item);
  const roomResource = dataFromDatabase.Item ? dataFromDatabase.Item : null;

  if (roomResource && roomResource.status) return roomResource.status;

  return null;
};

const extractRecordData = (record) => {
  let dynamoDbRecord;
  if (record.eventName === 'INSERT' || record.eventName === 'MODIFY') {
    dynamoDbRecord = record.dynamodb.NewImage;
  } else {
    dynamoDbRecord = record.dynamodb.OldImage;
  }

  return unmarshall(dynamoDbRecord);
};

export const lambdaHandler = async (event) => {
  const record = event.Records[0];

  console.log('event: ', event);
  console.log('records:', event.Records);
  console.log('record length:', event.Records.length);
  console.log('Event name:', record.eventName);
  console.log('new image: ', record.dynamodb.NewImage);
  console.log('old image: ', record.dynamodb.OldImage);

  const recordData = extractRecordData(record);
  const { roomId } = recordData;
  // Guard clauses before talking with db
  if (record.eventName === 'INSERT') return;
  if (!roomId) {
    console.log('Database change does not have a room ID attach to it. Abort.');
    return;
  }

  console.log('ROOM ID CAPTURED: ', roomId);

  try {
    const prevStatus = await getRoomStatusById(roomId);
    console.log('prevStatus: ', prevStatus);
    if (!prevStatus) {
      console.log(`The status of the room ${roomId} is missing. Abort.`);
      return;
    }

    let newStatus;

    switch (record.eventName) {
      case 'MODIFY':
        // a peer connected with a specific room
        newStatus = getNewStatusOnConnect(prevStatus);
        break;
      case 'REMOVE':
        // a peer disconnect from a specific room
        newStatus = getNewStatusOnDisconnect(prevStatus);
        break;
      default:
        return;
    }
    await updateRoomStatusById(roomId, newStatus);
    console.log('Room status updated!');
  } catch (err) {
    console.log('Error while updating the database:', err);
  }
};