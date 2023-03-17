const AWS = require("aws-sdk");
const ddb = new AWS.DynamoDB.DocumentClient();
exports.handler = async function (event, context) {
  console.log(event, context);
  const source = event.requestContext.connectionId;

  // set up connections object so we can scan the table
  console.log("before setting up connection to table");
  let connections;
  try {
    connections = await ddb.scan({ TableName: process.env.table }).promise();
  } catch (err) {
    console.log("could not connect to db table");
    return {
      statusCode: 500,
    };
  }

  // before we delete...grab the room we are in (if we are in one)
  const row = connections.Items.filter(
    ({ connectionId }) => connectionId === source
  )[0]; // find row where roomId exists

  console.log("line 24 row", row);
  const myRoomId = row && row.roomId;

  if (myRoomId) {
    // send message to peer in same room (if there is one)
    const row = connections.Items.filter(
      ({ roomId, connectionId }) =>
        roomId === myRoomId && connectionId !== source // make sure we are not sending to ourself
    )[0];
    const targetConnectionId = row && row.connectionId;
    console.log("inside room, targetConnection in row", row);
    if (targetConnectionId) {
      const callbackAPI = new AWS.ApiGatewayManagementApi({
        apiVersion: "2018-11-29",
        endpoint:
          event.requestContext.domainName + "/" + event.requestContext.stage,
      });
      try {
        await callbackAPI
          .postToConnection({
            ConnectionId: targetConnectionId,
            Data: JSON.stringify({
              source: null,
              destination: targetConnectionId,
            }),
          })
          .promise();
      } catch (e) {
        console.log("Error in posting callback endconnection to peer", e);
      }
    }
  }

  console.log("deleting key", source);
  await ddb
    .delete({
      TableName: process.env.table,
      Key: {
        connectionId: source,
      },
    })
    .promise();
  return {
    statusCode: 200,
  };
};
