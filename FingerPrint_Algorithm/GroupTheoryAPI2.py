import tkinter as tk
from tkinter import ttk
from itertools import chain
import json

def load_glossary_data(file_path):
    """ Load the glossary data from a JSON file. """
    try:
        with open(file_path, "r") as file:
            data = json.load(file)
            return data
    except FileNotFoundError:
        print(f"Error: File {file_path} not found.")
        return {}
    except json.JSONDecodeError:
        print(f"Error: Failed to decode JSON from {file_path}.")
        return {}



import math
from itertools import chain
from dataclasses import dataclass

class GroupHierarchy:
    """Class for building and managing hierarchical group relationships."""

    @dataclass
    class CostParams:
        """Parameters for cost calculation."""
        lambda_breadth: float = 0.5
        mu_imbalance: float = 0.5
        nu_depth: float = 0.3
        omega_coherence: float = 3.0
        relevance_threshold: float = 0.6

    def __init__(self, groups=None):
        """Initialize the GroupHierarchy with optional groups."""
        self.params = GroupHierarchy.CostParams()
        self.reset(groups if groups else {})

    def reset(self, groups):
        """Reset the hierarchy with a new set of groups."""
        self.groups = self._process_groups(groups)
        self.hierarchical_relationships = {}
        self.independent_groups = set()

    def _process_groups(self, groups):
        """Process groups into sets for easier calculations."""
        return {
            key: set(chain.from_iterable(value if isinstance(value[0], list) else [value]))
            for key, value in groups.items()
        }

    @staticmethod
    def precompute_groups(groups):
        """Precompute sets and sizes for all groups."""
        group_sets = {group: set(members) for group, members in groups.items()}
        group_sizes = {group: len(members) for group, members in group_sets.items()}
        return group_sets, group_sizes

    @staticmethod
    def cached_overlap(parent_set, child_set, cache):
        """Calculate and cache the overlap between two sets."""
        key = (id(parent_set), id(child_set))
        if key not in cache:
            cache[key] = len(parent_set & child_set)
        return cache[key]

    def calculate_cost(self, parent_set, child_set, parent_size, child_size, overlap_cache):
        """Calculate the hierarchical cost between a parent and child group."""
        # Relevance check
        overlap = self.cached_overlap(parent_set, child_set, overlap_cache)
        if overlap == 0 or child_size == 0:
            return math.inf  # Irrelevant pairs
        relevance = overlap / child_size
        if relevance <= self.params.relevance_threshold:
            return math.inf

        # Penalties
        breadth_penalty = self.params.lambda_breadth * max(parent_size / child_size, 1)
        coherence_penalty = self.params.omega_coherence * max(overlap / max(parent_size, child_size), 1e-5)

        # Final cost
        return (1 / relevance) + breadth_penalty + coherence_penalty

    def build_hierarchy(self):
        """Construct the group hierarchy based on cost calculations."""
        hierarchy, assigned_children = {}, set()
        group_sets, group_sizes = self.precompute_groups(self.groups)
        overlap_cache = {}
        depth_tracker = {group: 0 for group in self.groups}

        # Sort groups by size in ascending order
        sorted_groups = sorted(self.groups.keys(), key=lambda x: group_sizes[x])

        # Main hierarchy-building loop
        for child in sorted_groups:
            child_set = group_sets[child]
            child_size = group_sizes[child]
            min_cost, best_parent = math.inf, None

            for parent in sorted_groups:
                if parent == child or group_sizes[parent] <= child_size:
                    continue  # Skip invalid parents

                # Calculate cost
                cost = self.calculate_cost(group_sets[parent], child_set, group_sizes[parent], child_size, overlap_cache)
                if cost < min_cost:
                    min_cost, best_parent = cost, parent

                    # Early exit if cost is "good enough"
                    #if cost < 5.0:
                    #    break

            # Assign child to best parent
            if best_parent:
                hierarchy.setdefault(best_parent, {"subgroups": []})
                hierarchy[best_parent]["subgroups"].append(child)
                assigned_children.add(child)
                depth_tracker[child] = depth_tracker[best_parent] + 1

        # Add unassigned groups
        for group in self.groups:
            if group not in assigned_children:
                hierarchy.setdefault(group, {"subgroups": []})

        self.hierarchical_relationships = hierarchy
        return hierarchy

    def get_hierarchy(self):
        """Return the current hierarchical relationships."""
        return self.hierarchical_relationships


class GroupHierarchyWithTreeview(GroupHierarchy):
    def __init__(self, groups):
        super().__init__(groups)

    def populate_treeview(self, tree):
        """ Populate the Treeview with hierarchical relationships. """
        added_groups = set()
        
        for group in self.independent_groups:
            if group not in added_groups:
                tree.insert("", "end", group, text=group)
                added_groups.add(group)
        
        for group_name, relationship in self.hierarchical_relationships.items():
            if not tree.exists(group_name):
                tree.insert("", "end", group_name, text=group_name)
            
            for subgroup in relationship["subgroups"]:
                if tree.exists(subgroup):
                    tree.move(subgroup, group_name, "end")
                else:
                    tree.insert(group_name, "end", subgroup, text=subgroup)

def update_clustering(tree,slider_value,custom_groups = None):
    """ Update clustering based on the slider value. """
    global groups
    print("UPdated CLUSTERINGGGGGGGGGGG")
    if custom_groups is not None:

        group_hierarchy.reset( custom_groups)
    # Recompute hierarchy with new slider value
    group_hierarchy.build_hierarchy()
    # Clear and repopulate Treeview
    for item in tree.get_children():
        tree.delete(item)
    group_hierarchy.populate_treeview(tree)


# Define file path for glossary data
file_path = "glossary.json"

# Load group data from the JSON file
groups = load_glossary_data(file_path)

if not groups:
    print("No valid group data found. Exiting...")
    
# Initialize the group hierarchy with loaded data
group_hierarchy = GroupHierarchyWithTreeview(groups)


def main():
    # Define file path for glossary data
    file_path = "glossary.json"
    
    # Load group data from the JSON file
    groups = load_glossary_data(file_path)
    
    if not groups:
        print("No valid group data found. Exiting...")
        return
    
    global group_hierarchy
    global tree
    
    # Initialize the group hierarchy with loaded data
    group_hierarchy = GroupHierarchyWithTreeview(groups)
    
    # Create a Tkinter window
    root = tk.Tk()
    root.title("Group Hierarchy Viewer")


    # Create a frame to contain the widgets
    graph_frame = tk.Frame(root)
    graph_frame.pack(fill="both", expand=True)

    # Create a Treeview widget
    tree = ttk.Treeview(graph_frame)
    tree.heading("#0", text="Group Hierarchy", anchor="w")
    tree.pack(fill="both", expand=True)

    # Create a slider widget
    slider = tk.Scale(graph_frame, from_=0.0, to=1.0, orient='horizontal', resolution=0.01,
                    label="Clustering Sensitivity", command=lambda val: update_clustering(float(val)))
    slider.pack(fill="x")

    root.mainloop()

if __name__ == "__main__":
    main()
