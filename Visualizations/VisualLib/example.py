import matplotlib.pyplot as plt
import pandas as pd
import numpy as np

def main():
    # Example data generation
    x = np.linspace(0, 10, 100)
    y = np.sin(x)

    # Creating a plot
    plt.figure(figsize=(10, 6))
    plt.plot(x, y, label='sin(x)')
    plt.title('Sine Wave')
    plt.xlabel('x-axis')
    plt.ylabel('y-axis')
    plt.grid(True)
    plt.legend()

    # Show the plot
    plt.show()
