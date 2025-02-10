import asyncio

class AsyncChatClient:
    def __init__(self, api_key, model="deepseek-r1-distill-llama-70b"):
        self.api_key = api_key
        self.model = model
        self.callbacks = []

    def register_callback(self, callback):
        """ Register a callback function that will be called when the response is available. """
        self.callbacks.append(callback)

    async def send_message(self, chain_msg):
        """ Send a message asynchronously and trigger the callbacks once a response is available. """
        # Simulating asynchronous request to a chat service like Groq
        print("Sending message...")

        # Simulate an asynchronous call (this could be a real API call in a real scenario)
        await asyncio.sleep(2)  # Simulating network latency or API processing time

        # Sample response simulation (Replace this with actual client.chat.completions.create)
        chat_completion = {
            "choices": [
                {"message": {"content": f"Summarized conversation based on: {chain_msg}"}}  # Placeholder for response content
            ]
        }

        # Call the registered callbacks with the chat response
        self._trigger_callbacks(chat_completion)

    def _trigger_callbacks(self, response):
        """ Trigger all registered callbacks with the given response. """
        for callback in self.callbacks:
            callback(response)

# Example callback function
def handle_response(response):
    print(f"Received response: {response['choices'][0]['message']['content']}")
