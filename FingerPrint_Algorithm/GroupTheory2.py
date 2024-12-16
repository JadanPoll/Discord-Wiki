import tkinter as tk
from tkinter import ttk
import networkx as nx
import numpy as np

class GroupHierarchy:
    def __init__(self, groups):
        """
        Initialize the group hierarchy.
        :param groups: A dictionary where keys are group names and values are multi-array groups (arrays of subgroups).
        """
        self.groups = groups
        self.graph = nx.DiGraph()
        self.hierarchy = {}
        self.independent_groups = set()

    def flatten_groups(self):
        """
        Flatten multi-array groups into a single set for each group.
        :return: A dictionary with group names as keys and flattened sets of elements as values.
        """
        return {group: set(el for subgroup in subgroups for el in subgroup)
                for group, subgroups in self.groups.items()}

    def check_independence(self, group_name, group_elements, all_elements):
        """
        Check if a group is independent by determining if more than 50% of its elements
        are unique compared to all other groups.
        :param group_name: Name of the group to check.
        :param group_elements: Set of elements for the group.
        :param all_elements: Set of all elements from other groups.
        :return: True if the group is independent, False otherwise.
        """
        unique_elements = group_elements - all_elements
        unique_percentage = len(unique_elements) / len(group_elements)
        return unique_percentage > 0.5

    def compute_hierarchy(self):
        """
        Compute the hierarchical structure using PageRank and identify independent groups.
        """
        group_elements = self.flatten_groups()

        # Build the directed graph based on group intersections
        for g1, elements1 in group_elements.items():
            for g2, elements2 in group_elements.items():
                if g1 != g2:
                    # Calculate the weight as the size of the intersection
                    weight = len(elements1 & elements2)
                    if weight > 0:
                        self.graph.add_edge(g1, g2, weight=weight)

        # Compute PageRank to determine importance scores
        pagerank_scores = nx.pagerank(self.graph, weight='weight')

        # Build the hierarchy based on PageRank scores
        self.hierarchy = self._build_hierarchy(pagerank_scores)

        # Identify independent groups
        all_elements = set(el for elements in group_elements.values() for el in elements)
        for group_name, elements in group_elements.items():
            other_elements = all_elements - elements
            if self.check_independence(group_name, elements, other_elements):
                self.independent_groups.add(group_name)

    def _build_hierarchy(self, pagerank_scores):
        """
        Build the hierarchy using PageRank scores.
        :param pagerank_scores: Dictionary of PageRank scores for each group.
        :return: A dictionary representing the hierarchical relationships.
        """
        sorted_groups = sorted(pagerank_scores.items(), key=lambda x: x[1], reverse=True)

        hierarchy = {group: [] for group, _ in sorted_groups}
        for i, (parent, _) in enumerate(sorted_groups):
            for child, _ in sorted_groups[i + 1:]:
                if self.graph.has_edge(parent, child):
                    hierarchy[parent].append(child)

        return {parent: children for parent, children in hierarchy.items() if children}

    def get_hierarchy_for_treeview(self):
        """
        Return the hierarchy and independent groups in a format suitable for Treeview.
        """
        return self.hierarchy, list(self.independent_groups)

# Tkinter setup to display the group hierarchy using Treeview
def display_hierarchy(groups):
    # Initialize the GroupHierarchy class
    group_hierarchy = GroupHierarchy(groups)
    group_hierarchy.compute_hierarchy()
    hierarchy, independent_groups = group_hierarchy.get_hierarchy_for_treeview()

    # Create the Tkinter window
    window = tk.Tk()
    window.title("Group Hierarchy")

    # Create a frame and Treeview
    frame = tk.Frame(window)
    frame.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)

    treeview = ttk.Treeview(frame, columns=("Subgroups"), show="tree")
    treeview.pack(fill=tk.BOTH, expand=True)

    # Add scrollbar
    scrollbar = ttk.Scrollbar(frame, orient="vertical", command=treeview.yview)
    scrollbar.pack(side="right", fill="y")
    treeview.configure(yscrollcommand=scrollbar.set)

    # Insert groups into the Treeview
    for group_name, subgroups in hierarchy.items():
        parent_id = treeview.insert("", "end", text=group_name, open=False)
        for subgroup in subgroups:
            treeview.insert(parent_id, "end", text=subgroup)

    # Add independent groups
    if independent_groups:
        independent_id = treeview.insert("", "end", text="Independent Groups", open=False)
        for group in independent_groups:
            treeview.insert(independent_id, "end", text=group)

    # Run the Tkinter main loop
    window.mainloop()


# Example groups and their elements (multi-array format with arrays of subgroups)
groups = {
    "G": [[1, 2, 3, 4], [5, 6]],
    "A": [[4, 5], [6, 7]],
    "H": [[2, 3], [7, 8]],
    "I": [[8, 9], [10]],
}

# Run the Tkinter display
display_hierarchy(groups)
