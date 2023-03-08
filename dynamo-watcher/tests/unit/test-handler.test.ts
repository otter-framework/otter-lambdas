import { DynamoDBStreamEvent } from 'aws-lambda';
import { lambdaHandler } from '../../app';

describe('Unit test for app handler', function () {
  test('verifies successful status change', async () => {
    const event: DynamoDBStreamEvent = {
      Records: [
        {
          eventName: 'REMOVE',
          dynamodb: {
            NewImage: { peerId: { S: 'rm_xH-keatc0_' } },
          },
        },
      ],
    };
    await lambdaHandler(event);
  });
});
