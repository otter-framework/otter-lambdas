import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { PutCommand, GetCommand, ScanCommand, ScanCommandInput } from '@aws-sdk/lib-dynamodb';
import { Room, RoomStatus, RoomConfig } from './types';
import { generateRoomId, createErrorResponse } from './utils';

const TABLE_NAME = 'rooms';
const REGION = process.env.AWS_REGION || 'us-east-2';
const marshallOptions = {
  removeUndefinedValues: true, // false, by default.
};

const client = new DynamoDBClient({ region: REGION });
const dynamo = DynamoDBDocumentClient.from(client, {
  marshallOptions,
});

const createRoom = async (config: RoomConfig): Promise<Room> => {
  const roomId = generateRoomId(); // create room id with length of 10
  const now = new Date();
  const utc = now.toUTCString();
  const roomResource = {
    id: roomId,
    unique_name: config.uniqueName || '',
    created_at: utc,
    updated_at: utc,
    status: RoomStatus.Open,
  };
  const params = {
    TableName: TABLE_NAME,
    Item: roomResource,
  };
  await dynamo.send(new PutCommand(params));
  return roomResource;
};

const getRoomById = async (id: string): Promise<Record<string, any> | null> => {
  const params = {
    TableName: TABLE_NAME,
    Key: { id },
  };

  const dataFromDatabase = await dynamo.send(new GetCommand(params));
  return dataFromDatabase.Item ? dataFromDatabase.Item : null;
};

const getRoomByName = async (name: string): Promise<Record<string, any> | null> => {
  console.log(name);
  const params: ScanCommandInput = {
    TableName: TABLE_NAME,
    FilterExpression: '#unique = :name',
    ExpressionAttributeValues: {
      ':name': name,
    },
    ExpressionAttributeNames: { '#unique': 'unique_name' },
  };

  const dataFromDatabase = await dynamo.send(new ScanCommand(params));
  const item = dataFromDatabase.Items ? dataFromDatabase.Items[0] : null;

  return item;
};

const getRoomResource = async (uniqueIdentifier: string | undefined): Promise<Record<string, any> | null> => {
  let roomResource = null;
  if (uniqueIdentifier) {
    if (uniqueIdentifier.startsWith('rm_')) {
      roomResource = await getRoomById(uniqueIdentifier);
    } else {
      roomResource = await getRoomByName(uniqueIdentifier);
    }
  }

  return roomResource;
};

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  let roomResource;
  try {
    const config: RoomConfig = event.body ? JSON.parse(event.body) : {};
    const uniqueIdentifier = config.uniqueName;
    // check whether the roomId/name exists or not
    roomResource = await getRoomResource(uniqueIdentifier);
    // create the room if it doesn't exist
    if (!roomResource || roomResource.id === undefined) {
      roomResource = await createRoom(config);
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST',
      },
      body: JSON.stringify(roomResource),
    };
  } catch (err) {
    console.log(err);
    return {
      statusCode: 500,
      body: JSON.stringify(createErrorResponse('Error when getting or creating the new room. Please try again.')),
    };
  }
};
