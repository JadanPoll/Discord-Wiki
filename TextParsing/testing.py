import re

def parse_multiline_messages(filename):
    messages = []
    current_name = None
    current_message = []

    with open(filename, "r") as file:
        for line in file:
            line = line.strip()  # Remove any leading/trailing whitespace
            
            # Check if the line starts with a "name: message" pattern
            if re.match(r"^[^:]+:", line):
                # If we already have a message, save it before starting a new one
                if current_name and current_message:
                    messages.append((current_name, ' '.join(current_message)))
                
                # Start a new name and message
                name, message_part = line.split(":", 1)
                current_name = name.strip()
                current_message = [message_part.strip()]
            else:
                # Add to the current message if it's a continuation line
                current_message.append(line)

        # Append the last message if there is one
        if current_name and current_message:
            messages.append((current_name, ' '.join(current_message)))
    
    return messages

# Example usage
filename = "/Users/shubhan/Discord-Wiki-1/TextParsing/discord_messages.txt"
parsed_messages = parse_multiline_messages(filename)
for name, message in parsed_messages:
    print(f"Name: {name}, Message: {message}")
    tokens = re.findall(r'\b\w+\b', message)
    print(tokens)