'use strict';
const AWS = require('aws-sdk');
const dynamoDb = new AWS.DynamoDB.DocumentClient();
AWS.config.setPromisesDependency(require('bluebird'));
const { uuid } = require('uuidv4');
const TableName = process.env.TABLE;

const getCurrentDate = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
};

const isEmpty = obj => Object.keys(obj).length === 0 && obj.constructor === Object;

const sendResponse = (data, callback) => {
    if (data.code === 'ConditionalCheckFailedException') {
        data = {message: 'Not found', statusCode: 404};
    }

    callback(null, {
        statusCode: data.statusCode || 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify(data)
    });
};

////////////////////////////////// CREATE USER //////////////////////////////////

module.exports.createUser = (event, context, callback) => {
    const body = JSON.parse(event.body) || {};
    const { userEmail, userName } = body;
    const userId = uuid();

    if (typeof userName !== 'string' || typeof userEmail !== 'string') {
        return sendResponse({message: 'Missing required params from body', statusCode: 400}, callback);
    }

    const params = {
        TableName,
        Item: {
            userId,
            userName,
            userEmail,
            userCreated: getCurrentDate()
        }
    };

    dynamoDb
        .put(params)
        .promise()
        .then(() => sendResponse({message: 'The request has succeeded', user: params.Item}, callback))
        .catch(error => sendResponse(error, callback));
};

////////////////////////////////// GET USER BY ID //////////////////////////////////

module.exports.getUserById = (event, context, callback) => {
    const { userId } = event.pathParameters || {};

    const params = {
        TableName,
        Key: { userId },
        ConditionExpression: 'attribute_exists(userId)'
    };

    dynamoDb
        .get(params)
        .promise()
        .then(({Item} = {}) => {
            if (!Item || isEmpty(Item)) {
                return sendResponse({message: 'Not found', statusCode: 400}, callback);
            } else {
                return sendResponse(Item, callback);
            }
        })
        .catch(error => sendResponse(error, callback));
};

////////////////////////////////// UPDATE USER //////////////////////////////////

module.exports.updateUser = (event, context, callback) => {
    const { userEmail, userName } = JSON.parse(event.body) || {};
    const { userId } = event.pathParameters || {};

    if (![userName, userEmail].length) {
        return sendResponse({message: 'Please use the allowed parameters only', statusCode: 400}, callback);
    }

    let UpdateExpression = 'set userUpdated = :uu';
    const ExpressionAttributeValues = {
        ':uu' : getCurrentDate()
    }

    if (userName) {
        UpdateExpression += ', userName = :un';
        ExpressionAttributeValues[':un'] = userName;
    }

    if (userEmail) {
        UpdateExpression += ', userEmail = :ue';
        ExpressionAttributeValues[':ue'] = userEmail;
    }

    const params = {
        TableName,
        Key: { userId },
        UpdateExpression,
        ConditionExpression: 'attribute_exists(userId)',
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW'
    };

    dynamoDb
        .update(params)
        .promise()
        .then(({Attributes}) => sendResponse({message: 'The request has succeeded', Attributes}, callback))
        .catch(error => sendResponse(error, callback));
};

////////////////////////////////// DELETE USER //////////////////////////////////

module.exports.deleteUser = (event, context, callback) => {
    const { userId } = event.pathParameters || {};

    const params = {
        TableName,
        Key: { userId },
        ConditionExpression: 'attribute_exists(userId)',
        ReturnValues: 'ALL_OLD'
    };

    dynamoDb
        .delete(params)
        .promise()
        .then(() => sendResponse({message: 'The request has succeeded', userId}, callback))
        .catch(error => sendResponse(error, callback));
};
