import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
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

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const config: RoomConfig = event.body ? JSON.parse(event.body) : {};
    const roomResource = await createRoom(config);
    return {
      statusCode: 200,
      body: JSON.stringify(roomResource),
    };
  } catch (err) {
    console.log(err);
    return {
      statusCode: 500,
      body: JSON.stringify(createErrorResponse('Error when creating the new room. Please try again.')),
    };
  }
};
