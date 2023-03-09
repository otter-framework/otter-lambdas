const AWS = require("aws-sdk");
const ddb = new AWS.DynamoDB.DocumentClient();

exports.handler = async function (event, context) {
  let connections;
  try {
    connections = await ddb.scan({ TableName: process.env.table }).promise();
  } catch (err) {
    return {
      statusCode: 500,
    };
  }
  const callbackAPI = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint:
      event.requestContext.domainName + "/" + event.requestContext.stage,
  });

  const message = JSON.parse(event.body).message;

  if (message.type === "requestConnectionId") {
    const messageToSelf = {
      type: "connectionId",
      payload: event.requestContext.connectionId,
    };
    await callbackAPI
      .postToConnection({
        ConnectionId: event.requestContext.connectionId,
        Data: JSON.stringify(messageToSelf),
      })
      .promise();
    console.log("sent out my Peer Id to myself line 32");
  } else if (message.type === "joinOrCreate") {
    const source = event.requestContext.connectionId;
    const destination = message.payload;

    console.log("line 37 source and destination", source, destination);

    const targetItem = connections.Items.filter(
      ({ peerId }) => peerId === destination
    )[0]; // find row where roomId exists

    console.log("line 42 targetItem", targetItem);
    const targetConnectionId = targetItem && targetItem.connectionId;

    try {
      await ddb
        .put({
          TableName: process.env.table,
          Item: {
            connectionId: source,
            peerId: destination,
          },
        })
        .promise();
      console.log("Room was joined by ", source);
    } catch (err) {
      return {
        statusCode: 500,
      };
    }

    // if peer in room exists
    if (targetConnectionId) {
      const messageToSelf = {
        type: "peerId",
        payload: targetConnectionId,
      };
      await callbackAPI
        .postToConnection({
          ConnectionId: source,
          Data: JSON.stringify(messageToSelf),
        })
        .promise();
      console.log("sent out my Peer Id to myself line 74");

      const messageToPeer = {
        type: "startConnection",
        payload: source,
      };

      console.log(messageToPeer);

      try {
        await callbackAPI
          .postToConnection({
            ConnectionId: targetConnectionId,
            Data: JSON.stringify(messageToPeer),
          })
          .promise();
        console.log("sent out message to the other peer line 90");
      } catch (E) {
        console.log(E);
      }
    } else {
      const messageToSelf = {
        type: "roomId",
        payload: `Room ${message.payload} created`,
      };
      await callbackAPI
        .postToConnection({
          ConnectionId: source,
          Data: JSON.stringify(messageToSelf),
        })
        .promise();
      console.log("sent out message to myself that room was created line 107");
    }
  } else {
    const source = event.requestContext.connectionId;

    if (message.type === "endConnection") {
      const destination = message.payload;
      await callbackAPI
        .postToConnection({
          ConnectionId: destination,
          Data: JSON.stringify(message),
        })
        .promise();
      console.log("sent out message to the other peer line 120");
      return { statusCode: 200 };
    }

    const targetItem = connections.Items.filter(
      ({ connectionId }) => connectionId === source
    )[0];

    const room = targetItem.peerId;

    if (!room) {
      console.log("Not in a room!", targetItem, source);
      return { statusCode: 200 };
    }

    console.log("found room, now finding peer", room);

    let targetConnectionId = connections.Items.filter(
      ({ connectionId, peerId }) => peerId === room && connectionId !== source
    )[0];

    targetConnectionId = targetConnectionId && targetConnectionId.connectionId;

    console.log("found targetConnectionId", targetConnectionId);

    if (targetConnectionId) {
      await callbackAPI
        .postToConnection({
          ConnectionId: targetConnectionId,
          Data: JSON.stringify(message),
        })
        .promise();
      console.log("sent out message to the other peer");
    }
  }
  return { statusCode: 200 };
};
