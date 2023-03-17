const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
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
  const source = event.requestContext.connectionId;
  const roomIdParam = event.queryStringParameters.roomId;

  const callbackAPI = new ApiGatewayManagementApiClient({
    endpoint:
      "https://" +
      event.requestContext.domainName +
      "/" +
      event.requestContext.stage,
  });

  try {
    console.log(event, context);
    console.log(event.queryStringParameters);
    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          connectionId: source,
          roomId: roomIdParam,
        },
      })
    );
  } catch (err) {
    return {
      statusCode: 500,
    };
  }

  // check if both peers are present
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

  const peersInRoom = connections.Items.filter(
    ({ roomId }) => roomId === roomIdParam
  ); // find peers in roomId

  if (peersInRoom.length === 2) {
    console.log("peers", peersInRoom);

    let peerConnectionId = peersInRoom.find(
      ({ connectionId }) => connectionId !== source
    ).connectionId;

    console.log(peerConnectionId);

    let messageToPeer = {
      source: source,
      destination: peerConnectionId,
      polite: true,
      payload: null,
    };

    try {
      // send message to peer
      await callbackAPI.send(
        constructResponseCommand(peerConnectionId, messageToPeer)
      );
    } catch (e) {
      console.log("Could not send messages to peer", e);
    }
  }

  return {
    statusCode: 200,
  };
};
