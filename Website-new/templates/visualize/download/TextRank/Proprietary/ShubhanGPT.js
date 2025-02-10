/**
 * Initializes the API client with one or more API keys.
 *
 * @param {string|string[]} apiKeys - A single API key or an array of API keys.
 * @returns {object} An object with methods to register message handlers and send messages.
 */
export function initializeAPI(apiKeys) {
    // Normalize apiKeys into an array.
    if (!apiKeys) {
      throw new Error("At least one API key is required to initialize the API client.");
    }
    if (typeof apiKeys === "string") {
      apiKeys = [apiKeys];
    }
    if (!Array.isArray(apiKeys) || apiKeys.length === 0) {
      throw new Error("At least one valid API key is required.");
    }
  
    // Index of the last successfully used API key.
    let currentKeyIndex = 0;
  
    // Store unique message handler callbacks.
    const messageHandlers = new Set();
  
    /**
     * Registers a message handler callback.
     *
     * @param {Function} callback - A function to be called with the API response message.
     */
    function registerMessageHandler(callback) {
      if (typeof callback === "function") {
        messageHandlers.add(callback);
      } else {
        console.error("Handler must be a function.");
      }
    }
  
    /**
     * Sends a message to the API. If a 429 error is encountered, it will try the next API key.
     * When a request succeeds, the current API key index is updated so that future calls start from it.
     *
     * @param {string} type - A descriptor for the request (e.g., "summary").
     * @param {string} chain_msg - The conversation chain to send.
     * @returns {Promise<void>}
     */
    async function sendMessage(type, chain_msg) {
      const url = "https://api.groq.com/openai/v1/chat/completions"; // Replace with your actual API URL
      const body = JSON.stringify({
        messages: [
          {
            role: "user",
            content: chain_msg,
          },
        ],
        model: "llama-3.3-70b-versatile",
      });
  
      const numKeys = apiKeys.length;
  
      // Try each API key starting from the last known good index.
      for (let offset = 0; offset < numKeys; offset++) {
        const keyIndex = (currentKeyIndex + offset) % numKeys;
        const apiKey = apiKeys[keyIndex];
  
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
            },
            body,
          });
  
          // If the response is successful, update the currentKeyIndex and process the response.
          if (response.ok) {
            // Remember this key for future calls.
            currentKeyIndex = keyIndex;
  
            const chatCompletion = await response.json();
            const messageContent = chatCompletion.choices[0].message.content;
  
  
            // Notify all registered message handlers.
            messageHandlers.forEach((handler) => {
              try {
                handler(messageContent);
              } catch (handlerError) {
                console.error("Error executing handler:", handlerError);
              }
            });
  
            console.log(`Type: ${type}\nContent: ${messageContent}`);
            return; // Successfully processed the request.
          }
  
          // If a 429 error is received, log and try the next key.
          if (response.status === 429) {
            const errorData = await response.json();
            alert(
              `Rate limit encountered with API key at index ${keyIndex}:\nCode: ${errorData.error.code}\nMessage: ${errorData.error.message}`
            );
            // Continue to the next key.
            continue;
          } else {
            // For non-429 errors, throw an error.
            const errorData = await response.json();
            alert(`Error Code: ${error.error.code}\nMessage: ${error.error.message}`);
            throw new Error(
              `POST ${url} ${response.status} (${response.statusText}): ${errorData.error.message}`
            );
          }
        } catch (error) {
          console.error(`Error using API key at index ${keyIndex}:`, error);
          // Continue to the next key if there's an error (e.g., network error).
          continue;
        }
      }
  
      // If none of the API keys worked, throw an error.
      throw new Error("All API keys have been exhausted or encountered errors.");
    }
  
    // Return an object exposing the public methods.
    return {
      registerMessageHandler,
      sendMessage,
    };
  }
  