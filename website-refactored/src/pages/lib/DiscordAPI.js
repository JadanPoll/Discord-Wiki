// this class is for downloading messages.
/* global BigInt */

export class DiscordAPI {
    constructor(authToken) {
        this.DISCORD_EPOCH = 1420070400000n;
        this.setAuthorization(authToken);
    }
    setAuthorization(token) {
        this.authToken = token;
    }

    //Snowflake is a epoch-based way of calculating timestamps with more information
    convertTimestampToSnowflake(timestamp) {
        return ((BigInt(new Date(timestamp).getTime()) - this.DISCORD_EPOCH) << 22n).toString();
    }

    constructSearchParams(options) {
        const params = new URLSearchParams();
        if (options.author_id) params.append('author_id', options.author_id);
        if (options.mentions) params.append('mentions', options.mentions);
        if (options.has && options.has.length > 0) params.append('has', options.has.join(','));
        if (options.pinned) params.append('pinned', 'true');
        if (options.before) params.append('before', options.before);
        if (options.after) params.append('after', options.after);
        return params.toString();
    }



    async fetchMessages(apiUrl) {
        try {
            // First attempt using the cors-bypass path
            // @Kyubin Short-circuited to direct route
            //const response = await fetch(`/cors-bypass/${apiUrl}`, {
            const response = await fetch(`${apiUrl}`, {

                method: 'GET',
                headers: {
                    Authorization: this.authToken,  // Make sure this.authToken is set properly
                    'Content-Type': 'application/json'
                }
            });

            // Check if the response is successful
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }

            return await response.json();  // Return the parsed JSON response
        }
        catch (error) {
            console.log('Trying different route:', error.message);

            try {
                // If first attempt fails, try the direct API route

                // Reversed for glitch.me. Now this has tthe cors-bypass
                //const response = await fetch(`${apiUrl}`, {
                const response = await fetch(`/cors-bypass/${apiUrl}`, {
                    method: 'GET',
                    headers: {
                        Authorization: this.authToken,  // Ensure the token is available
                        'Content-Type': 'application/json'
                    }
                });

                // Check if the second response is successful
                if (!response.ok) {
                    throw new Error(`Request failed with status ${response.status}`);
                }

                return await response.json();
            }
            catch (error) {
                // Log any final error that occurs
                console.error('Error fetching messages on second attempt:', error.message);
                return [];  // Return an empty array on failure
            }
        }
    }


    async fetchChannelMessages(channelId, options, ondownloadcallback = (msgLength, totalmsg) => {}) {

        //TODO: add some logic that verifies channel (or just use response code?)
        // ondownloadcallback(msgLength, totalsg): callback function to do something with downloaded msg so far
        const allMessages = [];
        let startTime, endTime;
        options.limit = options.limit || 100;

        // Start timing
        startTime = performance.now();

        while (options.limit > 0) {
            const apiUrl = `https://discord.com/api/v9/channels/${channelId}/messages?limit=${Math.min(options.limit, 100)}&${this.constructSearchParams(options)}`;
            console.log(`Performing API call to ${apiUrl}`);
            const messages = await this.fetchMessages(apiUrl);
            allMessages.push(...messages);

            if (messages.length < 100) break;

            const lastMessage = messages[messages.length - 1];

            options.before = this.convertTimestampToSnowflake(lastMessage.timestamp);
            options.limit -= messages.length;

            ondownloadcallback(messages.length, options.limit)
        }

        // End timing
        endTime = performance.now();
        console.log(`Time taken: ${(endTime - startTime).toFixed(2)} milliseconds`);

        console.log(`Fetched ${allMessages.length} messages`);
        return allMessages;
    }



    /*async saveMessagesToFile(channelId, messages) {
        // ask for nickname
        let nickname = ""

        document.getElementById("prgsbarModalLabel").innerHTML = "Saving...";
        document.getElementById("dlprgsbar").setAttribute('aria-valuenow', 60);
        document.getElementById("dlprgsbar").style.width = "60%";

        while (true) {
            nickname = prompt("What name would you like to give to this file? You may only use alphanumerics and underbars(_).")
            if (/^\w*$/.test(nickname)) break;
            alert("You may only use alphanumerics and underbars(_).");
        }

        if (nickname === null) nickname = "" //empty name denotes using file name, but the server will do that thing

        // determine file name
        let filename = `${channelId}_${Date.now()}`
        console.log(`saving as ${filename}`)

        // send data in max 1.44MB
        let messagesStr = JSON.stringify(messages);
        let len = messagesStr.length;
        let ptr = 0;

        const PAYLOADSZ = 368640

        while (ptr < len) {
            let to = Math.min(len, ptr + PAYLOADSZ);

            let status = "continued";
            if (ptr == 0) status = "new";
            if (ptr + PAYLOADSZ >= len) status = "last";

            // SAVE TO SESSION
            let response = await fetch("/savedata", {
                method: "POST",
                body: JSON.stringify({
                    nickname: nickname,
                    filename: filename,
                    status: status,
                    data: messagesStr.substring(ptr, to)
                }),
                headers: {
                    "Content-type": "application/json; charset=UTF-8"
                }
            });
            if (!response.ok) {
                alert("There was an error saving the file. Please check your internet connection or try again with a different file.");
                return;
            }
            ptr = to;
        }

        // todo: check whether response is OK

        console.log("Analysing data...");

        document.getElementById("prgsbarModalLabel").innerHTML = "Analysing Conversation...";
        document.getElementById("dlprgsbar").setAttribute('aria-valuenow', 80);
        document.getElementById("dlprgsbar").style.width = "80%";

        // for some reason loadConversation() complains if messages isn't JSON.
        let analysisRes = await loadConversation(JSON.stringify(messages), filename);
        if (analysisRes.status == true) {
            document.getElementById("prgsbarModalLabel").innerHTML = "Completed!";
            document.getElementById("dlprgsbar").setAttribute('aria-valuenow', 100);
            document.getElementById("dlprgsbar").style.width = "100%";

            alert("Data loaded. You will be redirected to the main page.")

            // redirect to main page
            document.location.href = "/";
        }
        else {
            alert("Error:" + analysisRes.message);
        }
    }*/


}