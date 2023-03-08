import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { createErrorResponse } from './utils';

const TABLE_NAME = 'rooms';
const REGION = process.env.AWS_REGION || 'us-east-2';
const marshallOptions = {
  removeUndefinedValues: true, // false, by default.
};

const client = new DynamoDBClient({ region: REGION });
const dynamo = DynamoDBDocumentClient.from(client, {
  marshallOptions,
});

const getRoomById = async (id: string): Promise<Record<string, any> | null> => {
  const params = {
    TableName: TABLE_NAME,
    Key: { id },
  };

  const dataFromDatabase = await dynamo.send(new GetCommand(params));
  return dataFromDatabase.Item ? dataFromDatabase.Item : null;
};

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (event.pathParameters && event.pathParameters.uniqueIdentifier) {
      const { uniqueIdentifier } = event.pathParameters;
      const roomResource = await getRoomById(uniqueIdentifier);
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
