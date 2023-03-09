import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

const TABLE_NAME = process.env.CONNECTION_TABLE;
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

export const handler = async function (event) {
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

  if (message.type === "requestConnectionId") {
    const connectionId = event.requestContext.connectionId;
    const messageToSelf = {
      type: "connectionId",
      payload: connectionId,
    };
    await callbackAPI.send(
      constructResponseCommand(connectionId, messageToSelf)
    );
    console.log("sent out my Peer Id to myself");
  } else if (message.type === "joinOrCreate") {
    const source = event.requestContext.connectionId;
    const destination = message.payload;

    console.log("source and destination", source, destination);

    const targetItem = connections.Items.filter(
      ({ roomId }) => roomId === destination
    )[0]; // find row where roomId exists

    console.log("line 42 targetItem", targetItem);
    const targetConnectionId = targetItem && targetItem.connectionId;

    try {
      await dynamo.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            connectionId: source,
            roomId: destination,
          },
        })
      );
      console.log("Room was joined by ", source);
    } catch (err) {
      return {
        statusCode: 500,
      };
    }

    // if peer in room exists
    if (targetConnectionId) {
      const messageToSelf = {
        type: "roomId",
        payload: targetConnectionId,
      };
      await callbackAPI.send(constructResponseCommand(source, messageToSelf));
      console.log("sent out my Peer Id to myself line 74");

      const messageToPeer = {
        type: "startConnection",
        payload: source,
      };

      console.log(messageToPeer);

      try {
        await callbackAPI.send(
          constructResponseCommand(targetConnectionId, messageToPeer)
        );
        console.log("sent out message to the other peer line 90");
      } catch (E) {
        console.log(E);
      }
    } else {
      const messageToSelf = {
        type: "roomId",
        payload: `Room ${message.payload} created`,
      };
      await callbackAPI.send(constructResponseCommand(source, messageToSelf));
      console.log("sent out message to myself that room was created line 107");
    }
  } else {
    const source = event.requestContext.connectionId;

    if (message.type === "endConnection") {
      const destination = message.payload;
      await callbackAPI.send(constructResponseCommand(destination, message));
      console.log("sent out message to the other peer line 120");
      return { statusCode: 200 };
    }

    const targetItem = connections.Items.filter(
      ({ connectionId }) => connectionId === source
    )[0];

    const room = targetItem.roomId;

    if (!room) {
      console.log("Not in a room!", targetItem, source);
      return { statusCode: 200 };
    }

    console.log("found room, now finding peer", room);

    let targetConnectionId = connections.Items.filter(
      ({ connectionId, roomId }) => roomId === room && connectionId !== source
    )[0];

    targetConnectionId = targetConnectionId && targetConnectionId.connectionId;

    console.log("found targetConnectionId", targetConnectionId);

    if (targetConnectionId) {
      await callbackAPI.send(
        constructResponseCommand(targetConnectionId, message)
      );
      console.log("sent out message to the other peer");
    }
  }
  return { statusCode: 200 };
};
