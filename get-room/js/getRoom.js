import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const createErrorResponse = (message) => {
  return { message };
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

const getRoomById = async (id) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { id },
  };

  const dataFromDatabase = await dynamo.send(new GetCommand(params));
  return dataFromDatabase.Item ? dataFromDatabase.Item : null;
};

const getRoomByName = async (name) => {
  console.log(name);
  const params = {
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

const getRoomResource = async (uniqueIdentifier) => {
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

export const lambdaHandler = async (event) => {
  try {
    console.log('pathParameters: ', event.pathParameters);
    console.log('event: ', event);
    if (event.pathParameters && event.pathParameters.uniqueIdentifier) {
      const { uniqueIdentifier } = event.pathParameters;
      const roomResource = await getRoomResource(uniqueIdentifier);
      if (roomResource) {
        return {
          statusCode: 200,
          body: JSON.stringify(roomResource),
        };
      } else {
        return {
          statusCode: 404,
          body: JSON.stringify(createErrorResponse(`Room ${uniqueIdentifier} does not exist.`)),
        };
      }
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify(
          createErrorResponse('No room ID or room name specified. Please check your request and try again'),
        ),
      };
    }
  } catch (err) {
    console.log(err);
    return {
      statusCode: 500,
      body: JSON.stringify(createErrorResponse('Error when creating the new room. Please try again.')),
    };
  }
};
