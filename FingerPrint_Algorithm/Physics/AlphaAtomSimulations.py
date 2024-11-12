import networkx as nx
import matplotlib.pyplot as plt

# Create a random graph
G_spectral = nx.erdos_renyi_graph(20, 0.2)

# Position nodes using spectral layout
pos_spectral = nx.spectral_layout(G_spectral)

# Draw the graph
plt.figure(figsize=(8, 6))
nx.draw(G_spectral, pos_spectral, with_labels=True, node_color='lightcoral', node_size=1000, font_size=12, font_weight='bold')
plt.title("Spectral Layout")
plt.show()
