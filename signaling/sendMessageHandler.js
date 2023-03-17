const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");

const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");

const TABLE_NAME = process.env.table || "ConnectionsTable2301"; // TODO: Remove hard coded table later
const REGION = process.env.AWS_REGION || "us-east-2";
const marshallOptions = {
  removeUndefinedValues: true, // false, by default.
};

const client = new DynamoDBClient({ region: REGION });
const dynamo = DynamoDBDocumentClient.from(client, {
  marshallOptions,
});

const constructResponseCommand = (connectionId, jsonData) => {
  return new PostToConnectionCommand({
    ConnectionId: connectionId,
    Data: JSON.stringify(jsonData),
  });
};

exports.handler = async function (event, context) {
  console.log("Lambda is invoked!");
  let connections;
  try {
    console.log("Start Db scan...");
    console.log("dynamo object: ", dynamo);
    console.log("table name: ", TABLE_NAME);
    connections = await dynamo.send(new ScanCommand({ TableName: TABLE_NAME }));
    console.log("Db scan complete");
  } catch (err) {
    return {
      statusCode: 500,
    };
  }
  const callbackAPI = new ApiGatewayManagementApiClient({
    endpoint:
      "https://" +
      event.requestContext.domainName +
      "/" +
      event.requestContext.stage,
  });

  const message = JSON.parse(event.body).message;

  console.log(event, context);

  const source = event.requestContext.connectionId;
  let sessionData = message;

  console.log("message payload", sessionData);

  let destination = sessionData.destination;
  let room = sessionData.roomId;
  sessionData.source = source;

  if (!destination) {
    // destination DOES NOT EXIST: find in database

    const targetItem = connections.Items.filter(
      ({ connectionId, roomId }) => roomId === room && connectionId !== source
    )[0]; // find row where peer exists given our room

    console.log("line 72 targetItem", targetItem);
    const targetConnectionId = targetItem && targetItem.connectionId;

    if (targetConnectionId) {
      sessionData = {
        ...sessionData,
        destination: targetConnectionId,
      };

      try {
        await callbackAPI.send(
          constructResponseCommand(targetConnectionId, sessionData)
        );
      } catch (e) {
        console.log("Could not send to peer", e, sessionData);
      }
      console.log("Response was sent to peer!", sessionData);
    }
  } else {
    // destination exists and we can send message AS IS
    try {
      await callbackAPI.send(
        constructResponseCommand(destination, sessionData)
      );
      console.log("sent out message to the other peer");
    } catch (e) {
      console.log(
        "Not able to send message to peer but destination was not null",
        e
      );
    }
  }

  return { statusCode: 200 };
};
