import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { PutCommand, GetCommand, ScanCommand, ScanCommandInput } from '@aws-sdk/lib-dynamodb';
import { Room, RoomConfig } from './types';
import { generateRoomId, createErrorResponse } from './utils';
import jwt from 'jsonwebtoken';

const TABLE_NAME = 'RoomCountsTable2301';
const REGION = process.env.AWS_REGION || 'us-east-2';
const marshallOptions = {
  removeUndefinedValues: true, // false, by default.
};

const client = new DynamoDBClient({ region: REGION });
const dynamo = DynamoDBDocumentClient.from(client, {
  marshallOptions,
});

const getSecret = async () => {
  const params = {
    TableName: 'APIKeyTable',
    Key: { user: 'otter-admin' },
  };

  const dataFromDatabase = await dynamo.send(new GetCommand(params));
  const secret = dataFromDatabase.Item?.apiKey;
  return secret;
};

const getDomain = async () => {
  const params = {
    TableName: 'ConfigTable',
    Key: { user: 'otter-admin' },
  };

  const dataFromDatabase = await dynamo.send(new GetCommand(params));
  const domain = dataFromDatabase.Item?.domain;
  return domain;
};

const generateToken = (key: string, roomId: string) => {
  const token = jwt.sign(
    {
      data: roomId,
    },
    key,
    { expiresIn: '48h' },
  );
  return token;
};

const constructRoomResource = async (config: RoomConfig, domainUrl: string) => {
  const roomId = generateRoomId();
  const now = new Date();
  const utc = now.toUTCString();
  const secret = await getSecret();
  if (!secret) {
    return Promise.reject('Cannot generate room token.');
  } else {
    const token = generateToken(secret, roomId);
    const url = domainUrl + '/otter-meet/' + (config.uniqueName || roomId) + `?token=${token}`;
    const roomResource = {
      roomId,
      unique_name: config.uniqueName || '',
      created_at: utc,
      updated_at: utc,
      status: 'open',
      url,
    };

    return roomResource;
  }
};

const createRoom = async (roomResource: Room) => {
  const params = {
    TableName: TABLE_NAME,
    Item: roomResource,
  };
  await dynamo.send(new PutCommand(params));
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
  console.log(event);
  try {
    const config = event.body ? JSON.parse(event.body) : {};
    const uniqueIdentifier = config.uniqueName;
    // check whether the roomId/name exists or not
    roomResource = await getRoomResource(uniqueIdentifier);
    console.log('roomResource: ', roomResource);
    // create the room if it doesn't exist
    if (!roomResource || roomResource.roomId === undefined) {
      const domain = await getDomain();
      roomResource = await constructRoomResource(config, domain);
      await createRoom(roomResource);
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
