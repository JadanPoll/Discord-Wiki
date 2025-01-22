import time

# Python Timer Code
start_time = time.time()

def sum_of_squares(n):
    sum = 0
    for i in range(n):
        sum += i * i
    return sum

# Call the function with a large number to simulate a CPU-bound operation
sum_of_squares(1000000)

end_time = time.time()
execution_time = end_time - start_time
print(f"Execution Time: {execution_time:.6f} seconds")
