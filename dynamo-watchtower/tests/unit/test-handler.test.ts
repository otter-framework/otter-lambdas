import { DynamoDBStreamEvent } from 'aws-lambda';
import { lambdaHandler } from '../../app';

describe('Unit test for app handler', function () {
  test('verifies successful status change', async () => {
    const event: DynamoDBStreamEvent = {
      Records: [
        {
          eventName: 'INSERT',
          dynamodb: {
            NewImage: { roomId: { S: 'rm_5AMgkm9eMD' } },
          },
        },
      ],
    };
    await lambdaHandler(event);
  });
});
