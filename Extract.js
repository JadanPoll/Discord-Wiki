// This code is responsible for extracting messages from the discord.
(()=>
{

// This code is responsible for extracting messages from the discord.

class DiscordAPI {

    constructor(authToken) {
        this.DISCORD_EPOCH = 1420070400000n;
        this.setAuthorization(authToken);
    }
    setAuthorization(token)
    {
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
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': this.authToken,
                    'Content-Type': 'application/json'
                }
            });
            return await response.json();
        } catch (error) {
            console.error('Error fetching messages:', error);
            return [];
        }
    }

    indexChannelElements() {
        const channelContainer = document.querySelector('ul[aria-label="Channels"]');
        if (!channelContainer) {
            console.log("Channel container not found");
            return {};
        }

        const channelElements = channelContainer.querySelectorAll('[data-dnd-name]');
        const indexedChannels = {};

        channelElements.forEach((element, index) => {
            const channelName = element.getAttribute('data-dnd-name');
            indexedChannels[channelName] = {
                element,
                index,
                url: element.getAttribute('href') || element.querySelector('a')?.getAttribute('href') || element.querySelector('[href]')?.getAttribute('href')
            };
        });

        console.log("Indexed Channels:", indexedChannels);
        return indexedChannels;
    }

    async fetchChannelMessages(channelName, options) {
        const channels = this.indexChannelElements();
        const channel = channels[channelName];

        if (channel) {
            console.log(`Channel: ${channelName}, Index: ${channel.index}, URL: ${channel.url || 'N/A'}`);
            const channelId = channel.url?.split('/').pop();
            const allMessages = [];
            let startTime, endTime;

            if (channelId) {
                options.limit = options.limit || 100;

                // Start timing
                startTime = performance.now();

                while (options.limit > 0) {
                    const apiUrl = `https://discord.com/api/v9/channels/${channelId}/messages?limit=${Math.min(options.limit, 100)}&${this.constructSearchParams(options)}`;
                    console.log(`API URL: ${apiUrl}`);
                    const messages = await this.fetchMessages(apiUrl);
                    allMessages.push(...messages);

                    if (messages.length < 100) break;

                    const lastMessage = messages[messages.length - 1];
                    options.before = this.convertTimestampToSnowflake(lastMessage.timestamp);
                    options.limit -= messages.length;
                }

                // End timing
                endTime = performance.now();
                console.log(`Time taken: ${(endTime - startTime).toFixed(2)} milliseconds`);

                console.log(`Fetched ${allMessages.length} messages`);
                return allMessages;
            } else {
                console.error(`Channel "${channelName}" not found.`);
            }
        }
    }

    saveMessagesToFile(messages) {
        // Reverse the order of the messages
        const reversedMessages = messages.reverse().map(message => `${message.author.username}: ${message.content}`).join('\n');

        // Create a Blob from the reversed messages
        const blob = new Blob([reversedMessages], { type: 'text/plain' });

        // Create a link element
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'discord_messages.txt';

        // Append the link to the document and trigger the download
        document.body.appendChild(a);
        a.click();

        // Remove the link from the document
        document.body.removeChild(a);

        console.log('Messages saved to discord_messages.txt in reversed order.');
    }
}

// Example usage
const AUTHORIZATION_KEY="YOUR_DISCORD_TOKEN";
const discordAPI = new DiscordAPI(AUTHORIZATION_KEY);
const searchOptions = {
    author_id: null,   
    mentions: null,    
    has: [],           
    pinned: false,     
    before: null,      
    after: null,       
    limit: 1000        
};

discordAPI.fetchChannelMessages('announcements', searchOptions).then(messages => {
    console.log(messages);
    discordAPI.saveMessagesToFile(messages);
});
})();

//Extensions 