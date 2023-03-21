import {
  APIGatewayAuthorizerEvent,
  APIGatewayEvent,
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewaySimpleAuthorizerResult,
} from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommandInput } from '@aws-sdk/lib-dynamodb';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import jwt from 'jsonwebtoken';

const TABLE_NAME = 'APIKeyTable';
const REGION = process.env.AWS_REGION || 'us-east-2';
const marshallOptions = {
  removeUndefinedValues: true, // false, by default.
};

const client = new DynamoDBClient({ region: REGION });
const dynamo = DynamoDBDocumentClient.from(client, {
  marshallOptions,
});
const allow = {
  isAuthorized: true,
};
const deny = {
  isAuthorized: false,
};

const getApiKey = async () => {
  const params: GetCommandInput = {
    TableName: TABLE_NAME,
    Key: { user: 'otter-admin' },
  };

  const response = await dynamo.send(new GetCommand(params));
  const apiKey = response.Item?.apiKey;
  return apiKey;
};

export const lambdaHandler = async (event: APIGatewayProxyEventV2): Promise<APIGatewaySimpleAuthorizerResult> => {
  if (event.routeKey.includes('/createRoom')) {
    // createRoom route, authenticate API Key
    const apiKey = await getApiKey(); // fetch ApiKey from database
    if (apiKey && event.headers.authorization === apiKey) {
      return allow;
    } else {
      // API Key does not match, deny
      return deny;
    }
  } else {
    // all other routes, authenticate jwt token
    const token = event.queryStringParameters?.token;
    const apiKey = await getApiKey();
    try {
      if (token) jwt.verify(token, apiKey);
    } catch (err) {
      // if token is not valid, deny
      return deny;
    }

    return allow;
  }
};
