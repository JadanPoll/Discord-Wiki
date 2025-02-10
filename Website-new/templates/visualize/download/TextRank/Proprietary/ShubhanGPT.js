// apiClient.js

/**
 * Initializes the API client with the given API key.
 * Returns an object with methods to register message handlers and call the API.
 *
 * @param {string} apiKey - Your API key.
 * @returns {object} An object with `registerMessageHandler` and `summarize` functions.
 */
export function initializeAPI(apiKey) {
    if (!apiKey) {
      throw new Error("API key is required to initialize the API client.");
    }
  
    // Use a Set to store unique message handlers
    const messageHandlers = new Set();
  
    /**
     * Registers a message handler callback.
     *
     * @param {Function} callback - A function to be called with the API response message.
     */
    function registerMessageHandler(callback) {
      if (typeof callback === 'function') {
        messageHandlers.add(callback);
      } else {
        console.error('Handler must be a function.');
      }
    }
  
    /**
     * Calls the external API to summarize the conversation chain.
     *
     * @param {string} chain_msg - The conversation chain to summarize.
     * @returns {Promise<string>} The content of the summary message.
     */
    async function sendMessage(type,chain_msg) {
      const url = "https://api.groq.com/openai/v1/chat/completions"; // Replace with the actual Groq API URL
  
      // Build the request body. Adjust the prompt and model as needed.
      const body = JSON.stringify({
        messages: [
          {
            role: "user",
            content: `${chain_msg}`
          }
        ],
        model: "llama-3.3-70b-versatile"
      });
  
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      };
  
      try {
        const response = await fetch(url, {
          method: "POST",
          headers,
          body
        });
  
        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.statusText}`);
        }
  
        // Parse the JSON response from the API
        const chatCompletion = await response.json();
  
        // Extract the message content (adjust path if needed)
        const messageContent = chatCompletion.choices[0].message.content;
  
        // Call each registered message handler with the message content
        messageHandlers.forEach(handler => {
          try {
            handler(messageContent);
          } catch (handlerError) {
            console.error("Error executing handler:", handlerError);
          }
        });
  
        // Log the type and content for debugging purposes
  
      } catch (error) {
        console.error("Error in summarize:", error);
        throw error;
      }
    }
  
    // Return an object exposing the methods for external use.
    return {
      registerMessageHandler,
      sendMessage,
    };
  }
  