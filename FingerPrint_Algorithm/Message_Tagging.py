import json
filename = "filename"
tagged_message_json = {}
tagged_message_json[filename] = {}

# Assuming 'messages' is a list of message objects and each message has 'id' and 'topic' attributes
tagged_message_json[filename]['topic'] = [message.id for message in messages if message.topic == topic]

# Write the tagged_message_json to a file
with open("Messages_Tagged.json", "w") as file:
    json.dump(tagged_message_json, file, indent=4)
