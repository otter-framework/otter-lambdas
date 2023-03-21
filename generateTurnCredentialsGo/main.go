package main

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

func main() {
	lambda.Start(handler)
}

func handler(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	log.Println("hey")

	secret_key := "OTTER-WebRTC-2023"
	rest_api_separator := "-:-"
	name := "defaultName"

	unixTime := time.Now().Unix() + 24 * 3600
	unixTimeString := strconv.FormatInt(unixTime, 10)
	username := strings.Join([]string{unixTimeString, name}, rest_api_separator)

	hmac_val := hmac.New(sha1.New, []byte(secret_key))
	hmac_val.Write([]byte(username))
	encoded := base64.StdEncoding.EncodeToString(hmac_val.Sum(nil))

	credentials := map[string]string{"username": username, "password": encoded}
	responseData, _ := json.Marshal(credentials)

	response := events.APIGatewayProxyResponse{
		StatusCode: 200,
		Body: string(responseData),
	}

	return response, nil
}