# websocket_client.py

import asyncio
import aiohttp
import json
import threading
from bs4 import BeautifulSoup
import re
import base64
from io import BytesIO
from PIL import Image
import functools
from halo import Halo
import time

def halo_spinner(text="Loading", spinner="dots", color="cyan"):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            spinner_instance = Halo(text=text, spinner=spinner, color=color)
            spinner_instance.start()
            try:
                return func(*args, **kwargs)
            finally:
                print(f"HALO: Finished {text}")
                spinner_instance.stop()

        return wrapper

    return decorator



def async_halo_spinner(text="Loading", spinner="dots", color="cyan"):
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            spinner_instance = Halo(text=text, spinner=spinner, color=color)
            spinner_instance.start()
            try:
                result = await func(*args, **kwargs)
                return result
            except Exception as e:
                raise e
            finally:
                spinner_instance.stop()

        return wrapper

    return decorator
PROMPT_JSON = """
Convert the provided response into a structured JSON format that organizes the content into topics and their respective subtopics. Each topic should be an object with a "topic" key and a "subtopics" key containing an array of related subtopics. Optionally, add a "content" key to the subtopics for more detailed information if the information is valuable.

JSON Structure Requirements:

[
    {
        "topic": "Topic 1",
        "subtopics": [
            {
                "subtopic": "Subtopic 1",
                "content": "Optional detailed content for Subtopic 1"
            },
            {
                "subtopic": "Subtopic 2",
                "content": "Optional detailed content for Subtopic 2"
            },
            ...
        ]
    }
    
]
"topic": A string representing the main topic/category.
"subtopics": An array of objects, each containing:
"subtopic": A string representing the subtopic unique to the topic(can't just be for example "Definition").
"content": (Optional) A string with  a lot of additional information about the subtopic.
Respond ONLY in the JSON format.
ABSOLUTELY DO NOT RESPOND GENERICALLY BUT WITH A HIGH DEGREE OF SPECIFICITY
"""
PROMPT_JSON=""
class WebSocketClientApp:
    def __init__(self, base_url):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        self.loop_thread = threading.Thread(target=self.run_event_loop)
        self.loop_thread.daemon = True
        self.loop_thread.start()
        print(self,base_url)
        self.websocket_client = FetchWebSocket(self, base_url)
        self._learn = False
        self.TotalHTML = ''
        self.images = []
        self.current_image_index = 0
        self.callbacks = []

    def run_event_loop(self):
        self.loop.run_forever()

    def register_callback(self, callback):
        """Register a callback to handle incoming messages."""
        self.callbacks.append(callback)

    @halo_spinner(text="Sending Message", spinner="dots12", color="magenta")
    def send_message(self, message_type, input_data, learn=False):
        """Send a message with optional learning prompt."""
        if learn:
            input_data =  input_data+PROMPT_JSON

        if not input_data:
            return

        caesar_shifted_data = self.caesar_shift(input_data, 7)
        message = json.dumps({"type": message_type, "data": caesar_shifted_data})
        print("Message sent!",message)
        asyncio.run_coroutine_threadsafe(self.websocket_client.send(message), self.loop)

    @halo_spinner(text="Receiving Message", spinner="dots12", color="magenta")
    def handle_message(self, message):

        """Handle incoming messages by calling registered callbacks."""

        message_data = json.loads(message)
        content = message_data.get("content", "")

        if content.startswith("json"):
            self._learn = False


        # Parse the HTML content
        soup = BeautifulSoup(content, 'html.parser')


        ################################################
        tags_to_retain = {
            'title', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
            'strong', 'em', 'b', 'i', 'mark', 'small', 'del', 'ins', 'a',
            'ul', 'ol', 'li', 'table', 'tr', 'th', 'td', 'caption', 'thead',
            'tbody', 'tfoot','header','section','article','blockquote','code'
        }
        def retain_tags(soup, tags_to_retain):
            for tag in soup.find_all(True):
                if tag.name not in tags_to_retain:
                    tag.unwrap()
            return soup
        soup = retain_tags(soup, tags_to_retain)

        ###############################################################

        #message=soup.get_text()
        message=soup.prettify()
        print(message)
        print('-'*50)
        print("Incoming message stream. Halo")
        print('-'*50)


        for callback in self.callbacks:
            callback(message)

    def display_html_message(self, message):
        try:
            message_data = json.loads(message)
            content = message_data.get("content", "")

            if content.startswith("json"):
                self._learn = False

            # Parse the HTML content
            soup = BeautifulSoup(content, 'html.parser')

            if self._learn:
                self.send_message("sendGPT", content, learn=True)
                self._learn = False

        except json.JSONDecodeError:
            print("Invalid JSON format")

    def display_base64_image(self, data_uri):
        base64_str = data_uri.split('base64,')[1]
        image_data = base64.b64decode(base64_str)
        image = Image.open(BytesIO(image_data))
        self.images.append(image)
        self.current_image_index = len(self.images) - 1

    def caesar_shift(self, text, shift):
        shifted = []
        for char in text:
            if char.isalpha():
                shifted_code = ord(char) + shift
                if char.islower():
                    if shifted_code > ord('z'):
                        shifted_code -= 26
                    elif shifted_code < ord('a'):
                        shifted_code += 26
                elif char.isupper():
                    if shifted_code > ord('Z'):
                        shifted_code -= 26
                    elif shifted_code < ord('A'):
                        shifted_code += 26
                shifted.append(chr(shifted_code))
            else:
                shifted.append(char)
        return ''.join(shifted)

    def shutdown(self):
        self.websocket_client.disconnect()
        self.loop.call_soon_threadsafe(self.loop.stop)
        self.loop_thread.join()


class FetchWebSocket:
    def __init__(self, app, base_url):
        self.app = app
        self.base_url = base_url
        self.client_id = None
        self.is_connected = False

        # Connect and start polling
        asyncio.run_coroutine_threadsafe(self.connect(), self.app.loop)

    async def connect(self):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f'{self.base_url}/connect') as response:
                    if response.status not in (200, 201):
                        raise Exception('Network response was not ok')
                    data = await response.json()
                    self.client_id = data['clientId']
                    self.is_connected = True
                    asyncio.create_task(self.poll())
        except Exception as e:

            print("Trying again in two seconds")
            time.sleep(7)
            self.handle_error(e)

    def disconnect(self):
        self.is_connected = False
        asyncio.run_coroutine_threadsafe(self._disconnect(), self.app.loop)

    async def _disconnect(self):
        async with aiohttp.ClientSession() as session:
            await session.post(f'{self.base_url}/disconnect', json={'clientId': self.client_id})

    @async_halo_spinner(text="polling...", spinner="dots12", color="magenta")
    async def poll(self):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f'{self.base_url}/poll?clientId={self.client_id}') as response:
                    if response.status != 200:
                        raise Exception('Network response was not ok')
                    data = await response.json()
                    self.app.handle_message(data['message'])
                    asyncio.create_task(self.poll())
        except Exception as e:
            self.handle_error(e)

    async def send(self, message):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(f'{self.base_url}/send', json={'clientId': self.client_id, 'message': message}) as response:
                    if response.status not in (200, 201):
                        raise Exception('Network response was not ok')
        except Exception as e:
            self.handle_error(e)

    def handle_error(self, error):
        print('Fetch error:', error)
        self.disconnect()
        asyncio.run_coroutine_threadsafe(self.connect(), self.app.loop)

def extract_structured_json(message):
    """
    Callback function to extract structured JSON from the message.
    """
    try:
        # Load the JSON message
        content=message
        # Regular expression to extract structured JSON format
        pattern = re.compile(r'\[\s*\{\s*"topic"\s*:\s*".*?\}\s*\]', re.DOTALL)
        match = pattern.search(content)
        
        if match:
            extracted_text = match.group(0).strip()
            # Print or process the extracted text
            print("Extracted Text:", extracted_text)
            
            # Parse the extracted text as JSON
            try:
                extracted_json = json.loads(extracted_text)
                print("Extracted JSON:", json.dumps(extracted_json, indent=4))
            except json.JSONDecodeError:
                print("Failed to parse extracted text as JSON")
            
        else:
            print("No match found for the pattern")
    
    except json.JSONDecodeError:
        print("Invalid JSON format in the message")

# main.py


def custom_callback(message):
    """Custom callback function to process received messages."""
    print("Custom callback received message:", message)

if __name__ == "__main__":
    app = WebSocketClientApp("https://superb-shared-crow.glitch.me")

    # Register the custom callback
    #app.register_callback(extract_structured_json)

    # Send a test message
    time.sleep(5)
    app.send_message("sendPhind", "Talk abount Kai Cenat",learn=True)

    while True:
        time.sleep(50)
    # Shutdown the app gracefully
    app.shutdown()
