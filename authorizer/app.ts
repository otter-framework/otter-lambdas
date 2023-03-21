import {
  APIGatewayAuthorizerEvent,
  APIGatewayAuthorizerResult,
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

// Helper function to generate an IAM policy
const generatePolicy = function (principalId: string, effect: string, resource: string) {
  // Required output:
  const statementOne = {
    Action: 'execute-api:Invoke',
    Effect: effect,
    Resource: resource,
  };
  const policyDocument = {
    Version: '2012-10-17',
    Statement: [statementOne],
  };
  const authResponse = {
    principalId,
    policyDocument,
  };
  return authResponse;
};

const generateAllow = function (principalId: string, resource: string) {
  return generatePolicy(principalId, 'Allow', resource);
};

const generateDeny = function (principalId: string, resource: string) {
  return generatePolicy(principalId, 'Deny', resource);
};

export const lambdaHandler = async (
  event: any,
): Promise<APIGatewayAuthorizerResult | APIGatewaySimpleAuthorizerResult | undefined> => {
  const apiKey = await getApiKey(); // fetch ApiKey from database

  if (event.routeKey) {
    if (event.routeKey.includes('/createRoom')) {
      // createRoom route, authenticate API Key
      if (apiKey && event.headers.authorization === apiKey) {
        return allow;
      } else {
        // API Key does not match, deny
        return deny;
      }
    } else {
      // all other routes, authenticate jwt token
      const token = event.queryStringParameters?.token;
      try {
        if (token) jwt.verify(token, apiKey);
      } catch (err) {
        // if token is not valid, deny
        return deny;
      }
      return allow;
    }
  }

  if (event.methodArn) {
    // webSocket connections need policy returned

    // Retrieve request parameters from the Lambda function input:
    const token = event.queryStringParameters?.token;

    try {
      if (!token) throw new Error();
      jwt.verify(token, apiKey);
      return generateAllow('me', event.methodArn);
    } catch (e) {
      return generateDeny('Unauthorized', event.methodArn);
    }
  }

  return undefined;
};
