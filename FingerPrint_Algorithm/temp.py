def hex_to_formatted_binary(hex_string):
    # Remove any whitespace from the input
    hex_string = hex_string.strip().replace(" ", "").replace("\n", "")
    
    # Process the hex string in chunks of 4 characters (16 bits each)
    formatted_binaries = []
    for i in range(0, len(hex_string), 4):
        hex_chunk = hex_string[i:i+4]  # Take 4 hex characters
        # Convert the chunk to binary and format it
        binary_representation = bin(int(hex_chunk, 16))[2:].zfill(16)
        formatted_binary = " ".join([binary_representation[j:j+4] for j in range(0, 16, 4)])
        formatted_binaries.append(formatted_binary)
    
    # Join all formatted binary chunks with newlines for readability
    return "\n".join(formatted_binaries)

# Example usage
hex_string = "300054a059202614e2fc604008011480126119211b360bf974c0220b54a0604006039c3f0403148012610ff974c1f02540003200"
formatted_binary = hex_to_formatted_binary(hex_string)
print(formatted_binary)
