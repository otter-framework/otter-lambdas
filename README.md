# Otter Lambdas

This repo contains source code and supporting files for Otter Lambda functions. You can deploy these functions with the Serverless Application Model Command Line Interface [(SAM CLI)](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html).

## Quick start

Each lambda function has its own dedicated folder and a SAM template file being created already. Making sure the AWS credentials are already setup on your local machine, then navigate to the root folder of the function and run

```bash
sam build && sam deply
```

The first command will build the source of the lambda. The second command will package and deploy the lambda to AWS.

Here are some other cool things you can do with SAM:

## Use the SAM CLI to build and test locally

Build the lambda with the `sam build` command.

```bash
sam build
```

The SAM CLI installs dependencies defined in `package.json`, compiles TypeScript with esbuild, creates a deployment package, and saves it in the `.aws-sam/build` folder.

Test a single function by invoking it directly with a test event. An event is a JSON document that represents the input that the function receives from the event source. Test events are included in the `events` folder.

(Requires Docker) Run functions locally and invoke them with the `sam local invoke` command.

## Unit tests

Tests are defined in `/tests` in each lambda's folder. Use NPM to install the [Jest test framework](https://jestjs.io/) and run unit tests. For example:

```bash
cd create-room
npm install
npm run test
```
