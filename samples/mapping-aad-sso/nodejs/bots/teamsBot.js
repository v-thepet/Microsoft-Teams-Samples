// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { DialogBot } = require('./dialogBot');
const { tokenExchangeOperationName } = require('botbuilder');
const { SsoOAuthHelpler } = require('../SsoOAuthHelpler');
const { CardFactory} = require('botbuilder');
const { SimpleGraphClient } = require('../simpleGraphClient.js');
const axios = require('axios')

class TeamsBot extends DialogBot {
    /**
    *
    * @param {ConversationState} conversationState
    * @param {UserState} userState
    * @param {Dialog} dialog
    */
    constructor(conversationState, userState, dialog) {
        super(conversationState, userState, dialog);
        this._ssoOAuthHelper = new SsoOAuthHelpler(process.env.ConnectionName, conversationState);
        this.connectionName = process.env.ConnectionName;
        this.fbconnectionName = process.env.FBConnectionName;
        this.baseUrl = process.env.ApplicationBaseUrl;
        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            for (let member = 0; member < membersAdded.length; member++) {
                if (membersAdded[member].id !== context.activity.recipient.id) {
                    await context.sendActivity("Hello and welcome! Please type 'login' for initiating the authentication flow.");
                    await this.dialog.run(context, this.dialogState);
                }
            }

            await next();
        });
    }

    async onTokenResponseEvent(context) {
        console.log('Running dialog with Token Response Event Activity.');

        // Run the Dialog with the new Token Response Event Activity.
        await this.dialog.run(context, this.dialogState);
    }
    
    async handleTeamsSigninVerifyState(context, query) {
        console.log('Running dialog with signin/verifystate from an Invoke Activity.');
        await this.dialog.run(context, this.dialogState);
    }

    async handleTeamsMessagingExtensionFetchTask(context, action) {
        const userTokenClient = context.turnState.get(context.adapter.UserTokenClientKey);

        if (action.commandId === 'SSO') {
            const magicCode =
                action.state && Number.isInteger(Number(action.state))
                    ? action.state
                    : '';

            const tokenResponse = await userTokenClient.getUserToken(
                context.activity.from.id,
                this.connectionName,
                context.activity.channelId,
                magicCode
            );

            if (!tokenResponse || !tokenResponse.token) {
                // There is no token, so the user has not signed in yet.
                // Retrieve the OAuth Sign in Link to use in the MessagingExtensionResult Suggested Actions

                const { signInLink } = await userTokenClient.getSignInResource(
                    this.connectionName,
                    context.activity
                );

                return {
                    composeExtension: {
                        type: 'auth',
                        suggestedActions: {
                            actions: [
                                {
                                    type: 'openUrl',
                                    value: signInLink,
                                    title: 'Bot Service OAuth'
                                },
                            ],
                        },
                    },
                };
            }
            const graphClient = new SimpleGraphClient(tokenResponse.token);
            const profile = await graphClient.getMeAsync();
            var userImage = await graphClient.getUserPhoto()
            var imageString = "";
            var img2 = "";
            await userImage.arrayBuffer().then(result => {
                imageString = Buffer.from(result).toString('base64');
                img2 = "data:image/png;base64," + imageString;
            })
            const profileCard = CardFactory.adaptiveCard({
                version: '1.0.0',
                type: 'AdaptiveCard',
                body: [
                    {
                        type: "TextBlock",
                        size: "Medium",
                        weight: "Bolder",
                        text: "User profile details are"
                    },
                    {
                        type: "Image",
                        size: "Medium",
                        url: img2
                    },
                    {
                        type: "TextBlock",
                        size: "Medium",
                        weight: "Bolder",
                        wrap: true,
                        text: `Hello! ${profile.displayName}`
                    },
                    {
                        type: "TextBlock",
                        size: "Medium",
                        weight: "Bolder",
                        text: `Job title: ${profile.jobDetails ? profile.jobDetails : "Unknown"}`
                    },
                    {
                        type: "TextBlock",
                        size: "Medium",
                        weight: "Bolder",
                        text: `Email: ${profile.userPrincipalName}`
                    },
                ],
            });
            return {
                task: {
                    type: 'continue',
                    value: {
                        card: profileCard,
                        heigth: 250,
                        width: 400,
                        title: 'Show Profile Card'
                    },
                },
            };
        }
        if (action.commandId === 'FacebookLogin') {
            const magicCode =
                action.state && Number.isInteger(Number(action.state))
                    ? action.state
                    : '';

            const tokenResponse = await userTokenClient.getUserToken(
                context.activity.from.id,
                this.fbconnectionName,
                context.activity.channelId,
                magicCode
            );

            if (!tokenResponse || !tokenResponse.token) {
                // There is no token, so the user has not signed in yet.
                // Retrieve the OAuth Sign in Link to use in the MessagingExtensionResult Suggested Actions

                const { signInLink } = await userTokenClient.getSignInResource(
                    this.fbconnectionName,
                    context.activity
                );

                return {
                    composeExtension: {
                        type: 'auth',
                        suggestedActions: {
                            actions: [
                                {
                                    type: 'openUrl',
                                    value: signInLink,
                                    title: 'Bot Service OAuth'
                                },
                            ],
                        },
                    },
                };
            }

            var facbookProfile = await this.getFacebookUserData(tokenResponse.token);
            const profileCard = CardFactory.adaptiveCard({
                version: '1.0.0',
                type: 'AdaptiveCard',
                body: [
                    {
                        type: "Image",
                        size: "Medium",
                        url: facbookProfile.picture.data.url
                    },
                    {
                        type: 'TextBlock',
                        text: 'Hello: ' + facbookProfile.name,
                    },
                ],
            });

            return {
                task: {
                    type: 'continue',
                    value: {
                        card: profileCard,
                        heigth: 250,
                        width: 400,
                        title: 'Show Profile Card'
                    },
                },
            };
        }
        if (action.commandId === 'LogoutSSO') {
            await userTokenClient.signOutUser(context.activity.from.id, this.connectionName, context.activity.channelId);

            const card = CardFactory.adaptiveCard({
                version: '1.0.0',
                type: 'AdaptiveCard',
                body: [
                    {
                        type: 'TextBlock',
                        text: 'You have been signed out.'
                    },
                ],
            });

            return {
                task: {
                    type: 'continue',
                    value: {
                        card: card,
                        heigth: 200,
                        width: 400,
                        title: 'Adaptive Card: Inputs'
                    },
                },
            };
        }
        if (action.commandId === 'LogoutFacebook') {
            await userTokenClient.signOutUser(context.activity.from.id, this.fbconnectionName, context.activity.channelId);

            const card = CardFactory.adaptiveCard({
                version: '1.0.0',
                type: 'AdaptiveCard',
                body: [
                    {
                        type: 'TextBlock',
                        text: 'You have been signed out.'
                    },
                ]
            });

            return {
                task: {
                    type: 'continue',
                    value: {
                        card: card,
                        heigth: 200,
                        width: 400,
                        title: 'Adaptive Card: Inputs'
                    },
                },
            };
        }
        if (action.commandId === 'UserCredentials'){
            if(action.state == undefined)
            {
                return {
                    composeExtension: {
                        type: 'config',
                        suggestedActions: {
                            actions: [
                                {
                                    type: 'openUrl',
                                    value: this.baseUrl +'/popUpSignIn'
                                },
                            ],
                        },
                    },
                };
            }
            else{
                var data = JSON.parse(action.state);
                if(data.userName == "test" && data.password == "test") {
                    const card = CardFactory.adaptiveCard(this.getAdaptiveCardUserDetails());
        
                    return {
                        task: {
                            type: 'continue',
                            value: {
                                card: card,
                                heigth: 200,
                                width: 400,
                                title: 'Using credentials'
                            },
                        },
                    };
                }
                else {
                    const card = CardFactory.adaptiveCard({
                        version: '1.0.0',
                        type: 'AdaptiveCard',
                        body: [
                            {
                                type: 'TextBlock',
                                text: "Invalid username password."
                            },
                        ]
                    });
        
                    return {
                        task: {
                            type: 'continue',
                            value: {
                                card: card,
                                heigth: 200,
                                width: 400,
                                title: 'Using credentials'
                            },
                        },
                    };
                }
            } 
        }
        return null;
    }

    async getFacebookUserData(access_token) {
        const { data } = await axios({
            url: 'https://graph.facebook.com/v2.6/me',
            method: 'get',
            params: {
                fields: ['name','picture'].join(','),
                access_token: access_token,
            },
        });
        return data;
    };

    getAdaptiveCardUserDetails = () => ({
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        body: [
            {
                type: "TextBlock",
                size: "Medium",
                weight: "Bolder",
                text: "User profile details are"
            },
            {
                type: "Image",
                size: "Medium",
                url: "https://pbs.twimg.com/profile_images/3647943215/d7f12830b3c17a5a9e4afcc370e3a37e_400x400.jpeg"
            },
            {
                type: "TextBlock",
                size: "Medium",
                weight: "Bolder",
                wrap: true,
                text: "Hello! Test user"
            },
            {
                type: "TextBlock",
                size: "Medium",
                weight: "Bolder",
                text: "Job title: Data scientist"
            },
            {
                type: "TextBlock",
                size: "Medium",
                weight: "Bolder",
                text: 'Email: testaccount@test123.onmicrosoft.com'
            }
        ],
        type: 'AdaptiveCard',
        version: '1.4'
    });
}

module.exports.TeamsBot = TeamsBot;