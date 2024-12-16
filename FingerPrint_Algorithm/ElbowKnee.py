import numpy as np
import matplotlib.pyplot as plt
from kneed import KneeLocator

# Example data (a decreasing curve to simulate an elbow plot)
x = np.arange(1, 11)  # x values (e.g., number of components)
y = [100, 90, 80, 70, 60, 50, 40, 0, 0, 0]  # y values (e.g., explained variance)

# Create KneeLocator object to find the elbow point
kneedle = KneeLocator(x, y, curve="convex", direction="decreasing")

# Find the "elbow" or knee
elbow = kneedle.elbow or len(y)
print(elbow)
# Plot the curve
plt.plot(x, y, label="Curve (e.g., Explained Variance)", marker='o')

# Highlight the elbow point
plt.scatter(elbow, y[elbow-1], color='red', label=f'Elbow at x={elbow}', zorder=5)

# Add labels and title
plt.xlabel("X (e.g., Number of Components)")
plt.ylabel("Y (e.g., Explained Variance)")
plt.title("Elbow Method for Optimal Keywords/Components")

# Show legend
plt.legend()

# Display the plot
plt.show()
